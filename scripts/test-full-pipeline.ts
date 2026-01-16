/**
 * 전체 파이프라인 테스트
 *
 * 검색 → PDF 다운로드 → 텍스트 추출 → LLM 분석 → 최초 기록 찾기
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchLiterature } from '../src/literature/collector';
import { runAnalysisPipeline } from '../src/analysis/pipeline';
import { LLMConfig } from '../src/llm/types';
import { saveAnalysisReport, saveAnalysisJSON } from '../src/output/analysis-report';

// 테스트 대상 종
const TEST_SPECIES = {
  name: 'Ditrema temminckii',  // 망상어
  synonyms: ['Ditrema laeve', 'Embiotoca temminckii'],
};

// LLM 설정 (OpenRouter 무료 모델)
const LLM_CONFIG: LLMConfig = {
  provider: 'openrouter',
  model: process.env.OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
  apiKey: process.env.OPENROUTER_API_KEY,
};

async function testFullPipeline() {
  console.log('='.repeat(70));
  console.log('전체 파이프라인 테스트');
  console.log('='.repeat(70));
  console.log(`종: ${TEST_SPECIES.name}`);
  console.log(`LLM: ${LLM_CONFIG.provider}/${LLM_CONFIG.model}`);

  const startTime = Date.now();

  try {
    // 1. 문헌 검색
    console.log('\n[1단계] 문헌 검색...');
    const searchResult = await searchLiterature({
      scientificName: TEST_SPECIES.name,
      synonyms: TEST_SPECIES.synonyms,
      maxResults: 20,
      searchStrategy: 'both',
    });

    console.log(`검색 결과: ${searchResult.totalFound}건`);
    console.log(`연도 범위: ${searchResult.items[0]?.year || '?'} ~ ${searchResult.items[searchResult.items.length - 1]?.year || '?'}`);

    // 2. 분석 파이프라인 실행 (배치별 순차 분석)
    console.log('\n[2단계] 배치별 순차 분석...');
    const pipelineResult = await runAnalysisPipeline(searchResult, {
      batchSize: 3,
      maxBatches: 2,
      llmConfig: LLM_CONFIG,
      stopOnFirstRecord: true,
    });

    // 3. 결과 출력
    console.log('\n' + '='.repeat(70));
    console.log('분석 결과');
    console.log('='.repeat(70));

    console.log(`\n총 검색: ${pipelineResult.totalSearched}건`);
    console.log(`분석 완료: ${pipelineResult.totalAnalyzed}건`);

    console.log('\n[분석된 문헌]');
    for (const item of pipelineResult.analyzedItems) {
      const status = item.analysis?.hasKoreaRecord
        ? '✅ 한국 기록'
        : item.analysis?.hasKoreaRecord === false
          ? '❌ 한국 기록 없음'
          : '❓ 불확실';

      // 분석 소스 라벨
      const sourceLabel = item.analysis?.analysisSource === 'pdf_fulltext'
        ? '[PDF]'
        : item.analysis?.analysisSource === 'abstract_only'
          ? '[📋초록]'
          : '[⚠️메타]';

      console.log(`  ${item.year || '????'}: ${sourceLabel} ${item.title.slice(0, 45)}...`);
      console.log(`    ${status} (신뢰도: ${((item.analysis?.confidence || 0) * 100).toFixed(0)}%)`);

      if (item.analysis?.locality) {
        console.log(`    채집지: ${item.analysis.locality}`);
      }
      if (item.analysis?.needsManualReview) {
        console.log(`    ⚠️ 수동 확인 필요`);
      }
      if (item.analysisError) {
        console.log(`    오류: ${item.analysisError}`);
      }
    }

    // 수동 확인 필요 목록
    if (pipelineResult.itemsNeedingManualReview.length > 0) {
      console.log('\n[수동 확인 필요 목록]');
      pipelineResult.itemsNeedingManualReview.forEach((item, i) => {
        console.log(`  ${i + 1}. [${item.year}] ${item.title.slice(0, 50)}...`);
        console.log(`     URL: ${item.url}`);
      });
    }

    // 최초 기록
    if (pipelineResult.firstKoreaRecord) {
      console.log('\n' + '─'.repeat(70));
      console.log('★ 최초 한국 기록 ★');
      console.log('─'.repeat(70));
      const first = pipelineResult.firstKoreaRecord;
      console.log(`연도: ${first.year}`);
      console.log(`제목: ${first.title}`);
      console.log(`저자: ${first.authors?.join(', ') || '불명'}`);
      console.log(`출처: ${first.source}`);
      console.log(`채집지: ${first.analysis?.locality || '불명'}`);
      console.log(`채집일: ${first.analysis?.collectionDate || '불명'}`);
      console.log(`판단근거: ${first.analysis?.reasoning}`);
    }

    // 오류
    if (pipelineResult.errors.length > 0) {
      console.log('\n[오류]');
      pipelineResult.errors.forEach(e => console.log(`  - ${e}`));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n총 소요 시간: ${elapsed}초`);

    // 4. 결과 저장
    console.log('\n[3단계] 결과 저장...');
    const excelPath = saveAnalysisReport(pipelineResult);
    const jsonPath = saveAnalysisJSON(pipelineResult);
    console.log(`엑셀: ${excelPath}`);
    console.log(`JSON: ${jsonPath}`);

  } catch (error) {
    console.error('파이프라인 실패:', error);
  }

  console.log('\n' + '='.repeat(70));
  console.log('테스트 완료');
}

testFullPipeline().catch(console.error);
