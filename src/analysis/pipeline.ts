/**
 * 문헌 분석 파이프라인
 *
 * 검색 결과 → PDF 다운로드 → 텍스트 추출 → LLM 분석
 * 연도순으로 순차 분석하여 최초 기록 찾기
 */

import * as fs from 'fs';
import * as path from 'path';
import { LiteratureItem, LiteratureSearchResult, AnalysisSource, LiteratureAnalysis } from '../literature/types';
import { downloadPdfs } from '../literature/collector';
import { createDoclingClient } from '../pdf/docling-client';
import { createLLMClient, loadLLMConfigFromEnv } from '../llm';
import { LiteratureAnalysisResult, LLMConfig } from '../llm/types';
import { DoclingResult } from '../pdf/types';

/** 분석 결과 (확장) */
export interface AnalyzedLiterature extends LiteratureItem {
  analysis?: LiteratureAnalysis;  // literature/types.ts의 LiteratureAnalysis 사용
  extractedText?: string;
  analysisError?: string;
}

/** 파이프라인 결과 */
export interface PipelineResult {
  scientificName: string;
  totalSearched: number;
  totalAnalyzed: number;
  analyzedItems: AnalyzedLiterature[];
  firstKoreaRecord?: AnalyzedLiterature;
  itemsNeedingManualReview: AnalyzedLiterature[];  // 수동 확인 필요 목록
  errors: string[];
  stoppedEarly: boolean;  // 한국 기록 찾아서 조기 종료했는지
}

/** 파이프라인 옵션 */
export interface PipelineOptions {
  batchSize?: number;         // 한 번에 분석할 문헌 수 (기본: 3)
  maxBatches?: number;        // 최대 배치 수 (기본: 5, 총 15건)
  llmConfig?: LLMConfig;      // LLM 설정
  skipDownloaded?: boolean;   // 이미 다운로드된 PDF 재사용
  textCacheDir?: string;      // 추출된 텍스트 캐시 디렉토리
  stopOnFirstRecord?: boolean; // 첫 한국 기록 발견 시 중단 (기본: true)
}

/** 기본 옵션 */
const DEFAULT_OPTIONS: Required<PipelineOptions> = {
  batchSize: 3,
  maxBatches: 5,
  llmConfig: loadLLMConfigFromEnv(),
  skipDownloaded: true,
  textCacheDir: path.join(process.cwd(), 'data', 'text_cache'),
  stopOnFirstRecord: true,
};

/**
 * 문헌 분석 파이프라인 실행
 *
 * 순차 분석 전략:
 * 1. 연도순 상위 N건 분석
 * 2. 한국 기록 없으면 다음 N건으로 이동
 * 3. 한국 기록 발견 시 중단 (또는 계속)
 * 4. 최대 배치 수까지 반복
 */
export async function runAnalysisPipeline(
  searchResult: LiteratureSearchResult,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 텍스트 캐시 디렉토리 생성
  if (!fs.existsSync(opts.textCacheDir)) {
    fs.mkdirSync(opts.textCacheDir, { recursive: true });
  }

  const errors: string[] = [];
  const analyzedItems: AnalyzedLiterature[] = [];
  const itemsNeedingManualReview: AnalyzedLiterature[] = [];
  let firstKoreaRecord: AnalyzedLiterature | undefined;
  let stoppedEarly = false;

  // Docling & LLM 클라이언트 생성
  const doclingClient = createDoclingClient({ useApi: false });
  const llmClient = createLLMClient(opts.llmConfig);

  console.log(`\n[Pipeline] 총 검색 결과: ${searchResult.items.length}건`);
  console.log(`[Pipeline] 배치 크기: ${opts.batchSize}, 최대 배치: ${opts.maxBatches}`);
  console.log(`[Pipeline] LLM: ${opts.llmConfig.provider}/${opts.llmConfig.model}`);

  // 배치별 순차 분석
  for (let batch = 0; batch < opts.maxBatches; batch++) {
    const startIdx = batch * opts.batchSize;
    const endIdx = Math.min(startIdx + opts.batchSize, searchResult.items.length);

    if (startIdx >= searchResult.items.length) {
      console.log(`[Pipeline] 더 이상 분석할 문헌 없음`);
      break;
    }

    console.log(`\n[Pipeline] ════ 배치 ${batch + 1}/${opts.maxBatches} (${startIdx + 1}~${endIdx}건) ════`);

    const batchItems = searchResult.items.slice(startIdx, endIdx);

    // PDF 다운로드
    console.log(`[Pipeline] PDF 다운로드 중...`);
    const itemsWithPdf = await downloadPdfs(batchItems);

    // 각 문헌 분석
    for (let i = 0; i < itemsWithPdf.length; i++) {
      const item = itemsWithPdf[i];
      const globalIdx = startIdx + i + 1;

      console.log(`\n[Pipeline] ─── 분석 ${globalIdx}/${searchResult.items.length} ───`);
      console.log(`[Pipeline] ${item.year || '????'}: ${item.title.slice(0, 50)}...`);

      const analyzedItem: AnalyzedLiterature = { ...item };

      try {
        const analysisResult = await analyzeItem(
          item,
          searchResult.scientificName,
          doclingClient,
          llmClient,
          opts.textCacheDir
        );

        analyzedItem.analysis = analysisResult.analysis;
        analyzedItem.extractedText = analysisResult.extractedText;

        // 분석 소스 로깅
        const sourceLabel = getSourceLabel(analysisResult.analysis?.analysisSource);
        console.log(`[Pipeline] 분석 소스: ${sourceLabel}`);
        console.log(`[Pipeline] 결과: 한국기록=${analysisResult.analysis?.hasKoreaRecord}, 신뢰도=${((analysisResult.analysis?.confidence || 0) * 100).toFixed(0)}%`);

        // 수동 확인 필요 목록에 추가
        if (analysisResult.analysis?.needsManualReview) {
          itemsNeedingManualReview.push(analyzedItem);
          console.log(`[Pipeline] ⚠️ 수동 확인 필요 (${sourceLabel})`);
        }

        // 한국 기록 발견!
        if (analysisResult.analysis?.hasKoreaRecord === true) {
          if (!firstKoreaRecord || (analyzedItem.year && firstKoreaRecord.year && analyzedItem.year < firstKoreaRecord.year)) {
            // 더 오래된 기록이면 교체
            if (firstKoreaRecord) {
              console.log(`[Pipeline] ★ 더 오래된 한국 기록 발견! (${analyzedItem.year} < ${firstKoreaRecord.year}) ★`);
            } else {
              console.log(`[Pipeline] ★ 한국 기록 발견! ★`);
            }
            firstKoreaRecord = analyzedItem;
          }
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Pipeline] 분석 실패: ${errorMsg}`);
        analyzedItem.analysisError = errorMsg;
        errors.push(`${item.id}: ${errorMsg}`);
      }

      analyzedItems.push(analyzedItem);
    }

    // 배치 완료 후 한국 기록 발견 여부 확인
    const batchKoreaRecords = analyzedItems
      .slice(startIdx)
      .filter(item => item.analysis?.hasKoreaRecord === true);

    if (batchKoreaRecords.length > 0) {
      console.log(`\n[Pipeline] 배치 ${batch + 1}에서 한국 기록 ${batchKoreaRecords.length}건 발견`);

      // 조기 종료 옵션이 켜져 있으면 배치 완료 후 종료
      if (opts.stopOnFirstRecord && firstKoreaRecord) {
        console.log(`[Pipeline] 조기 종료 (한국 기록 발견, 배치 완료)`);
        stoppedEarly = true;
        break;
      }
    } else {
      console.log(`\n[Pipeline] 배치 ${batch + 1}에서 한국 기록 없음, 다음 배치로...`);
    }
  }

  // 결과 정리
  if (firstKoreaRecord) {
    console.log(`\n[Pipeline] ═══ 최초 한국 기록 ═══`);
    console.log(`[Pipeline] ${firstKoreaRecord.year}: ${firstKoreaRecord.title}`);
    console.log(`[Pipeline] 채집지: ${firstKoreaRecord.analysis?.locality || '불명'}`);
  } else {
    console.log(`\n[Pipeline] 한국 기록을 찾지 못했습니다.`);
  }

  if (itemsNeedingManualReview.length > 0) {
    console.log(`\n[Pipeline] ⚠️ 수동 확인 필요: ${itemsNeedingManualReview.length}건`);
  }

  return {
    scientificName: searchResult.scientificName,
    totalSearched: searchResult.items.length,
    totalAnalyzed: analyzedItems.length,
    analyzedItems,
    firstKoreaRecord,
    itemsNeedingManualReview,
    errors,
    stoppedEarly,
  };
}

/**
 * 단일 문헌 분석
 */
async function analyzeItem(
  item: LiteratureItem,
  scientificName: string,
  doclingClient: ReturnType<typeof createDoclingClient>,
  llmClient: ReturnType<typeof createLLMClient>,
  textCacheDir: string
): Promise<{
  analysis?: AnalyzedLiterature['analysis'];
  extractedText?: string;
}> {
  let textToAnalyze: string | undefined;
  let analysisSource: AnalysisSource = 'metadata_only';

  // 1. PDF 전문 시도
  if (item.pdfPath && fs.existsSync(item.pdfPath)) {
    // DOI 등 슬래시가 포함된 ID를 안전한 파일명으로 변환
    const safeId = item.id.replace(/[<>:"/\\|?*]/g, '_');
    const textCachePath = path.join(textCacheDir, `${safeId}.txt`);

    if (fs.existsSync(textCachePath)) {
      console.log(`[Pipeline] 캐시된 텍스트 사용`);
      textToAnalyze = fs.readFileSync(textCachePath, 'utf-8');
    } else {
      console.log(`[Pipeline] Docling으로 텍스트 추출 중...`);
      try {
        const doclingResult: DoclingResult = await doclingClient.processFile(item.pdfPath, {
          enableOCR: true,
          ocrLanguages: ['eng', 'jpn', 'kor'],
        });

        if (doclingResult.text && doclingResult.text.length > 100) {
          textToAnalyze = doclingResult.text;
          fs.writeFileSync(textCachePath, textToAnalyze, 'utf-8');
          console.log(`[Pipeline] 텍스트 추출 완료: ${textToAnalyze.length}자`);
        }
      } catch (err) {
        console.warn(`[Pipeline] Docling 실패:`, err);
      }
    }

    if (textToAnalyze && textToAnalyze.length > 100) {
      analysisSource = 'pdf_fulltext';
    }
  }

  // 2. PDF 없거나 추출 실패 → 초록 사용
  if (!textToAnalyze || textToAnalyze.length < 100) {
    if (item.snippet && item.snippet.length > 50) {
      console.log(`[Pipeline] PDF 없음, 초록으로 분석`);
      textToAnalyze = buildAbstractText(item);
      analysisSource = 'abstract_only';
    } else {
      console.log(`[Pipeline] 초록도 없음, 메타데이터만으로 분석`);
      textToAnalyze = buildMetadataText(item);
      analysisSource = 'metadata_only';
    }
  }

  // 3. LLM 분석
  console.log(`[Pipeline] LLM 분석 중... (소스: ${analysisSource})`);
  const llmResult = await llmClient.analyzeLiterature({
    text: textToAnalyze,
    scientificName,
    synonyms: [],
  });

  // 4. 수동 확인 필요 여부 결정
  const needsManualReview = shouldNeedManualReview(analysisSource, llmResult);

  return {
    analysis: {
      hasKoreaRecord: llmResult.hasKoreaRecord,
      confidence: llmResult.confidence,
      locality: llmResult.locality,
      collectionDate: llmResult.collectionDate,
      specimenInfo: llmResult.specimenInfo,
      relevantQuotes: llmResult.relevantQuotes,
      reasoning: llmResult.reasoning,
      analyzedAt: llmResult.processedAt,
      modelUsed: llmResult.modelUsed,
      analysisSource,
      needsManualReview,
      // LLM 디버깅 정보 포함
      llmDebug: llmResult.debug ? {
        inputText: llmResult.debug.inputTextPreview,
        inputLength: llmResult.debug.inputTextLength,
        rawResponse: llmResult.debug.rawResponse,
        promptUsed: llmResult.debug.promptUsed,
      } : undefined,
    },
    extractedText: textToAnalyze,
  };
}

/**
 * 초록 기반 텍스트 생성
 */
function buildAbstractText(item: LiteratureItem): string {
  const parts = [
    `Title: ${item.title}`,
    `Authors: ${item.authors?.join(', ') || 'Unknown'}`,
    `Year: ${item.year || 'Unknown'}`,
    `Journal: ${item.journal || 'Unknown'}`,
    '',
    'Abstract:',
    item.snippet || '',
  ];
  return parts.join('\n');
}

/**
 * 메타데이터 기반 텍스트 생성
 */
function buildMetadataText(item: LiteratureItem): string {
  return [
    `Title: ${item.title}`,
    `Authors: ${item.authors?.join(', ') || 'Unknown'}`,
    `Year: ${item.year || 'Unknown'}`,
    `Journal: ${item.journal || 'Unknown'}`,
    `Source: ${item.source}`,
  ].join('\n');
}

/**
 * 수동 확인 필요 여부 판단
 */
function shouldNeedManualReview(
  source: AnalysisSource,
  result: LiteratureAnalysisResult
): boolean {
  // PDF 전문이 아닌 경우 수동 확인 권장
  if (source !== 'pdf_fulltext') {
    // 한국 기록 있거나 불확실한 경우
    if (result.hasKoreaRecord === true || result.hasKoreaRecord === null) {
      return true;
    }
    // 신뢰도가 낮은 경우
    if (result.confidence < 0.7) {
      return true;
    }
  }
  return false;
}

/**
 * 분석 소스 라벨
 */
function getSourceLabel(source?: AnalysisSource): string {
  switch (source) {
    case 'pdf_fulltext': return 'PDF 전문';
    case 'abstract_only': return '📋 초록만';
    case 'metadata_only': return '⚠️ 메타데이터만';
    default: return '알 수 없음';
  }
}

/**
 * 간단한 분석 함수 (하위 호환)
 */
export async function analyzeTopResults(
  searchResult: LiteratureSearchResult,
  count: number = 3
): Promise<AnalyzedLiterature[]> {
  const result = await runAnalysisPipeline(searchResult, {
    batchSize: count,
    maxBatches: 1,
    stopOnFirstRecord: false,
  });
  return result.analyzedItems;
}
