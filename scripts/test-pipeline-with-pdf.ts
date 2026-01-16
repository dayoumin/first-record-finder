/**
 * PDF가 있는 문헌만 대상으로 파이프라인 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchLiterature } from '../src/literature/collector';
import { runAnalysisPipeline } from '../src/analysis/pipeline';
import { LLMConfig } from '../src/llm/types';

// 테스트 대상 종 (OpenAlex에서 많이 나오는 종)
const TEST_SPECIES = {
  name: 'Anguilla japonica',  // 뱀장어 - 논문 많음
  synonyms: [],
};

// LLM 설정
const LLM_CONFIG: LLMConfig = {
  provider: 'openrouter',
  model: process.env.OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
  apiKey: process.env.OPENROUTER_API_KEY,
};

async function testPipelineWithPdf() {
  console.log('='.repeat(70));
  console.log('PDF 있는 문헌 파이프라인 테스트');
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
      maxResults: 50,  // 더 많이 검색
      searchStrategy: 'korea',  // 한국 기록만
    });

    console.log(`검색 결과: ${searchResult.totalFound}건`);

    // 2. PDF URL이 있는 문헌만 필터링
    const itemsWithPdfUrl = searchResult.items.filter(item => item.pdfUrl);
    console.log(`PDF URL 있는 문헌: ${itemsWithPdfUrl.length}건`);

    if (itemsWithPdfUrl.length === 0) {
      console.log('PDF URL이 있는 문헌이 없습니다.');
      return;
    }

    // 필터링된 결과로 새 검색 결과 생성
    const filteredResult = {
      ...searchResult,
      items: itemsWithPdfUrl,
      totalFound: itemsWithPdfUrl.length,
    };

    // 상위 3건 출력
    console.log('\n[PDF URL 있는 상위 문헌]');
    filteredResult.items.slice(0, 5).forEach((item, i) => {
      console.log(`  ${i + 1}. [${item.year || '????'}] ${item.title.slice(0, 50)}...`);
      console.log(`     PDF: ${item.pdfUrl?.slice(0, 60)}...`);
    });

    // 3. 분석 파이프라인 실행 (배치별 순차 분석)
    console.log('\n[2단계] 배치별 순차 분석...');
    const pipelineResult = await runAnalysisPipeline(filteredResult, {
      batchSize: 2,
      maxBatches: 2,
      llmConfig: LLM_CONFIG,
      stopOnFirstRecord: true,
    });

    // 4. 결과 출력
    console.log('\n' + '='.repeat(70));
    console.log('분석 결과');
    console.log('='.repeat(70));

    for (const item of pipelineResult.analyzedItems) {
      console.log(`\n[${item.year || '????'}] ${item.title.slice(0, 60)}...`);

      if (item.analysisError) {
        console.log(`  오류: ${item.analysisError}`);
        continue;
      }

      if (item.analysis) {
        const status = item.analysis.hasKoreaRecord
          ? '✅ 한국 기록 있음'
          : item.analysis.hasKoreaRecord === false
            ? '❌ 한국 기록 없음'
            : '❓ 불확실';

        console.log(`  ${status} (신뢰도: ${(item.analysis.confidence * 100).toFixed(0)}%)`);

        if (item.analysis.locality) {
          console.log(`  채집지: ${item.analysis.locality}`);
        }
        if (item.analysis.collectionDate) {
          console.log(`  채집일: ${item.analysis.collectionDate}`);
        }
        if (item.analysis.relevantQuotes.length > 0) {
          console.log(`  관련 인용:`);
          item.analysis.relevantQuotes.slice(0, 2).forEach(q => {
            console.log(`    "${q.slice(0, 80)}..."`);
          });
        }
        console.log(`  판단근거: ${item.analysis.reasoning.slice(0, 200)}...`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n총 소요 시간: ${elapsed}초`);

  } catch (error) {
    console.error('파이프라인 실패:', error);
  }

  console.log('\n' + '='.repeat(70));
  console.log('테스트 완료');
}

testPipelineWithPdf().catch(console.error);
