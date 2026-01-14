/**
 * 문헌 분석 파이프라인
 *
 * PDF 다운로드 → Docling 텍스트 추출 → LLM 분석
 */

import * as fs from 'fs';
import * as path from 'path';
import { LiteratureItem, LiteratureAnalysis } from './types';
import { createDoclingClient } from '../pdf';
import { createLLMClient, loadLLMConfigFromEnv } from '../llm';
import { LLMConfig } from '../llm/types';

// PDF 저장 디렉토리
const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

/**
 * 분석 진행 상태
 */
export interface AnalysisProgress {
  phase: 'downloading' | 'extracting' | 'analyzing' | 'completed' | 'error';
  itemId: string;
  itemTitle: string;
  message?: string;
}

/**
 * 분석 옵션
 */
export interface AnalyzeOptions {
  llmConfig?: LLMConfig;
  skipDownloaded?: boolean;  // 이미 다운로드된 PDF 스킵
  onProgress?: (progress: AnalysisProgress) => void;
}

/**
 * 단일 문헌 분석
 */
export async function analyzeLiteratureItem(
  item: LiteratureItem,
  scientificName: string,
  synonyms: string[] = [],
  options: AnalyzeOptions = {}
): Promise<LiteratureItem> {
  const { onProgress } = options;
  const updatedItem = { ...item };

  try {
    // 1. PDF 다운로드 (URL이 있는 경우)
    if (item.pdfUrl && !item.pdfDownloaded) {
      onProgress?.({
        phase: 'downloading',
        itemId: item.id,
        itemTitle: item.title,
        message: 'PDF 다운로드 중...',
      });

      const pdfPath = await downloadPdf(item);
      if (pdfPath) {
        updatedItem.pdfDownloaded = true;
        updatedItem.pdfPath = pdfPath;
      }
    }

    // PDF가 없으면 분석 불가
    if (!updatedItem.pdfPath || !fs.existsSync(updatedItem.pdfPath)) {
      console.log(`[Analyzer] No PDF available for: ${item.title}`);
      return updatedItem;
    }

    // 2. Docling으로 텍스트 추출
    onProgress?.({
      phase: 'extracting',
      itemId: item.id,
      itemTitle: item.title,
      message: 'PDF 텍스트 추출 중...',
    });

    const doclingClient = createDoclingClient();
    const doclingResult = await doclingClient.processFile(updatedItem.pdfPath, {
      enableOCR: true,
      ocrLanguages: ['en', 'ko', 'ja'],
    });

    if (!doclingResult.text || doclingResult.text.trim().length === 0) {
      console.log(`[Analyzer] No text extracted from: ${item.title}`);
      return updatedItem;
    }

    // 3. LLM으로 분석
    onProgress?.({
      phase: 'analyzing',
      itemId: item.id,
      itemTitle: item.title,
      message: 'LLM 분석 중...',
    });

    const llmConfig = options.llmConfig || loadLLMConfigFromEnv();
    const llmClient = createLLMClient(llmConfig);

    const analysisResult = await llmClient.analyzeLiterature({
      text: doclingResult.text,
      scientificName,
      synonyms,
    });

    // 결과 저장
    updatedItem.analyzed = true;
    updatedItem.analysisResult = {
      hasKoreaRecord: analysisResult.hasKoreaRecord,
      confidence: analysisResult.confidence,
      locality: analysisResult.locality,
      collectionDate: analysisResult.collectionDate,
      specimenInfo: analysisResult.specimenInfo,
      relevantQuotes: analysisResult.relevantQuotes,
      reasoning: analysisResult.reasoning,
      analyzedAt: analysisResult.processedAt,
      modelUsed: analysisResult.modelUsed,
    };

    onProgress?.({
      phase: 'completed',
      itemId: item.id,
      itemTitle: item.title,
      message: `분석 완료: ${analysisResult.hasKoreaRecord ? '한국 기록 있음' : '한국 기록 없음'}`,
    });

    return updatedItem;

  } catch (error) {
    console.error(`[Analyzer] Error analyzing ${item.id}:`, error);

    onProgress?.({
      phase: 'error',
      itemId: item.id,
      itemTitle: item.title,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    return updatedItem;
  }
}

/**
 * 여러 문헌 일괄 분석
 */
export async function analyzeLiteratureItems(
  items: LiteratureItem[],
  scientificName: string,
  synonyms: string[] = [],
  options: AnalyzeOptions = {}
): Promise<LiteratureItem[]> {
  const results: LiteratureItem[] = [];

  // PDF URL이 있는 항목만 필터링
  const analyzableItems = items.filter(item =>
    item.pdfUrl || (item.pdfDownloaded && item.pdfPath)
  );

  console.log(`[Analyzer] Analyzing ${analyzableItems.length}/${items.length} items with PDF`);

  for (const item of analyzableItems) {
    const analyzed = await analyzeLiteratureItem(item, scientificName, synonyms, options);
    results.push(analyzed);

    // API rate limit 방지
    await delay(1000);
  }

  // PDF 없는 항목도 결과에 포함
  for (const item of items) {
    if (!results.find(r => r.id === item.id)) {
      results.push(item);
    }
  }

  return results;
}

/**
 * PDF 다운로드
 */
async function downloadPdf(item: LiteratureItem): Promise<string | null> {
  if (!item.pdfUrl) return null;

  try {
    // 저장 경로 생성
    const safeTitle = item.title
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .slice(0, 50);
    const fileName = `${item.source}_${safeTitle}_${Date.now()}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    // 디렉토리 생성
    if (!fs.existsSync(PDF_DIR)) {
      fs.mkdirSync(PDF_DIR, { recursive: true });
    }

    console.log(`[Analyzer] Downloading PDF: ${item.pdfUrl}`);

    const response = await fetch(item.pdfUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    console.log(`[Analyzer] PDF saved: ${filePath}`);
    return filePath;

  } catch (error) {
    console.error(`[Analyzer] PDF download error:`, error);
    return null;
  }
}

/**
 * 분석 결과 요약
 */
export function summarizeAnalysisResults(items: LiteratureItem[]): {
  total: number;
  analyzed: number;
  withKoreaRecord: number;
  withoutKoreaRecord: number;
  uncertain: number;
  earliestKoreaRecord: LiteratureItem | null;
} {
  const analyzed = items.filter(i => i.analyzed && i.analysisResult);
  const withKoreaRecord = analyzed.filter(i => i.analysisResult?.hasKoreaRecord === true);
  const withoutKoreaRecord = analyzed.filter(i => i.analysisResult?.hasKoreaRecord === false);
  const uncertain = analyzed.filter(i => i.analysisResult?.hasKoreaRecord === null);

  // 가장 오래된 한국 기록 찾기
  let earliestKoreaRecord: LiteratureItem | null = null;
  for (const item of withKoreaRecord) {
    if (item.year) {
      if (!earliestKoreaRecord || (earliestKoreaRecord.year && item.year < earliestKoreaRecord.year)) {
        earliestKoreaRecord = item;
      }
    }
  }

  return {
    total: items.length,
    analyzed: analyzed.length,
    withKoreaRecord: withKoreaRecord.length,
    withoutKoreaRecord: withoutKoreaRecord.length,
    uncertain: uncertain.length,
    earliestKoreaRecord,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
