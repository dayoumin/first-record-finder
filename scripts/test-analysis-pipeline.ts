/**
 * 분석 파이프라인 테스트
 *
 * 문헌 검색 → PDF 다운로드 → Docling 추출 → LLM 분석
 */

import { extractSynonyms } from '../src/worms';
import {
  searchLiterature,
  analyzeLiteratureItems,
  summarizeAnalysisResults,
  LiteratureItem,
} from '../src/literature';
import { LLMConfig } from '../src/llm/types';

// 테스트 설정
const TEST_SPECIES = {
  koreanName: '망상어',
  scientificName: 'Ditrema temminckii',
};

// LLM 설정 (Ollama 로컬 모델)
const LLM_CONFIG: LLMConfig = {
  provider: 'ollama',
  model: process.env.OLLAMA_MODEL || 'qwen3:4b',
  baseUrl: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
};

async function testAnalysisPipeline() {
  console.log('='.repeat(60));
  console.log('분석 파이프라인 테스트');
  console.log('='.repeat(60));

  // 1. Ollama 연결 확인
  console.log(`\n[0] Ollama 연결 확인: ${LLM_CONFIG.baseUrl}`);
  try {
    const response = await fetch(`${LLM_CONFIG.baseUrl}/api/tags`);
    if (!response.ok) throw new Error('Ollama not responding');
    console.log(`✅ Ollama 연결됨 (모델: ${LLM_CONFIG.model})`);
  } catch (err) {
    console.error('\n❌ Ollama에 연결할 수 없습니다.');
    console.error('   에러:', err instanceof Error ? err.message : err);
    console.log('   ollama serve 실행 필요');
    return;
  }

  // 2. WoRMS 이명 추출
  console.log(`\n[1] WoRMS 이명 추출: ${TEST_SPECIES.scientificName}`);
  console.log('-'.repeat(40));

  const wormsResult = await extractSynonyms(TEST_SPECIES.scientificName);
  if (!wormsResult.success) {
    console.error('❌ WoRMS 조회 실패:', wormsResult.error);
    return;
  }

  console.log(`  유효명: ${wormsResult.acceptedName}`);
  console.log(`  이명 수: ${wormsResult.synonyms.length}개`);
  const synonymNames = wormsResult.synonyms.map(s => s.name);

  // 3. 문헌 검색 (PDF 있는 것 위주)
  console.log(`\n[2] 문헌 검색`);
  console.log('-'.repeat(40));

  const searchResult = await searchLiterature({
    scientificName: wormsResult.acceptedName!,
    synonyms: synonymNames.slice(0, 3),
    maxResults: 5,
    sources: ['openalex'],  // OpenAlex만 (PDF 제공 가능성 높음)
  });

  console.log(`  검색 결과: ${searchResult.totalFound}건`);

  // PDF URL이 있는 항목 필터링
  const itemsWithPdf = searchResult.items.filter(item => item.pdfUrl);
  console.log(`  PDF 있는 문헌: ${itemsWithPdf.length}건`);

  if (itemsWithPdf.length === 0) {
    console.log('\n⚠️ PDF가 있는 문헌이 없습니다. 테스트 종료.');
    return;
  }

  // 상위 1개만 테스트
  let testItems = itemsWithPdf.slice(0, 1);

  // 이미 다운로드된 PDF가 있으면 사용
  const existingPdfPath = 'd:/Projects/first-record-finder/data/pdfs/openalex_Variations_in_species_composition_of_demersal_orga_1768378484575.pdf';
  if (testItems.length > 0 && require('fs').existsSync(existingPdfPath)) {
    testItems[0] = {
      ...testItems[0],
      pdfDownloaded: true,
      pdfPath: existingPdfPath,
    };
    console.log(`\n  ✅ 기존 PDF 파일 사용: ${existingPdfPath}`);
  }

  console.log(`\n  테스트 대상:`);
  testItems.forEach((item, i) => {
    console.log(`    ${i + 1}. ${item.title.slice(0, 50)}...`);
    console.log(`       ${item.authors.slice(0, 2).join(', ')} (${item.year})`);
    console.log(`       PDF: ${item.pdfPath || item.pdfUrl?.slice(0, 60)}...`);
  });

  // 4. 분석 파이프라인 실행
  console.log(`\n[3] 분석 파이프라인 실행`);
  console.log('-'.repeat(40));

  const analyzedItems = await analyzeLiteratureItems(
    testItems,
    wormsResult.acceptedName!,
    synonymNames,
    {
      llmConfig: LLM_CONFIG,
      onProgress: (progress) => {
        const phaseEmoji: Record<string, string> = {
          downloading: '📥',
          extracting: '📄',
          analyzing: '🤖',
          completed: '✅',
          error: '❌',
        };
        console.log(`  ${phaseEmoji[progress.phase] || '•'} ${progress.message}`);
      },
    }
  );

  // 5. 결과 요약
  console.log(`\n[4] 분석 결과`);
  console.log('-'.repeat(40));

  const summary = summarizeAnalysisResults(analyzedItems);
  console.log(`  총 문헌: ${summary.total}건`);
  console.log(`  분석 완료: ${summary.analyzed}건`);
  console.log(`  한국 기록 있음: ${summary.withKoreaRecord}건`);
  console.log(`  한국 기록 없음: ${summary.withoutKoreaRecord}건`);
  console.log(`  불확실: ${summary.uncertain}건`);

  if (summary.earliestKoreaRecord) {
    console.log(`\n  📌 최초 한국 기록 후보:`);
    console.log(`     ${summary.earliestKoreaRecord.title}`);
    console.log(`     연도: ${summary.earliestKoreaRecord.year}`);
  }

  // 상세 분석 결과 출력
  for (const item of analyzedItems) {
    if (item.analysisResult) {
      console.log(`\n  📑 ${item.title.slice(0, 50)}...`);
      console.log(`     한국 기록: ${item.analysisResult.hasKoreaRecord}`);
      console.log(`     신뢰도: ${(item.analysisResult.confidence * 100).toFixed(0)}%`);
      if (item.analysisResult.locality) {
        console.log(`     채집지: ${item.analysisResult.locality}`);
      }
      if (item.analysisResult.relevantQuotes.length > 0) {
        console.log(`     관련 인용:`);
        item.analysisResult.relevantQuotes.slice(0, 2).forEach(q => {
          console.log(`       "${q.slice(0, 80)}..."`);
        });
      }
      console.log(`     판단 근거: ${item.analysisResult.reasoning.slice(0, 100)}...`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('테스트 완료');
  console.log('='.repeat(60));
}

// 실행
testAnalysisPipeline().catch(console.error);
