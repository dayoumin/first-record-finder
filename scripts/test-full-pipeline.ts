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

// 테스트 대상 종 목록
const TEST_SPECIES_LIST = [
  { name: 'Nitzschia bizertensis', synonyms: [], koreanName: '니치아 비제르텐시스 (규조류)' },
  { name: 'Nannochloropsis granulata', synonyms: [], koreanName: '난노클로롭시스 그라눌라타 (미세조류)' },
  { name: 'Grateloupia filicina', synonyms: ['Grateloupia asiatica'], koreanName: '지누아리 (홍조류)' },
  { name: 'Sciaenops ocellatus', synonyms: [], koreanName: '레드드럼 (어류)' },
  { name: 'Sphyraena arabiansis', synonyms: [], koreanName: '아라비안바라쿠다 (어류)' },
];

// LLM 설정 (OpenRouter 무료 모델)
const LLM_CONFIG: LLMConfig = {
  provider: 'openrouter',
  model: process.env.OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
  apiKey: process.env.OPENROUTER_API_KEY,
};

async function testSingleSpecies(species: { name: string; synonyms: string[]; koreanName: string }) {
  console.log('\n' + '═'.repeat(70));
  console.log(`종: ${species.name} (${species.koreanName})`);
  console.log('═'.repeat(70));

  const startTime = Date.now();

  try {
    // 1. 문헌 검색
    console.log('\n[1단계] 문헌 검색...');
    const searchResult = await searchLiterature({
      scientificName: species.name,
      synonyms: species.synonyms,
      maxResults: 20,
      searchStrategy: 'both',
    });

    console.log(`검색 결과: ${searchResult.totalFound}건`);
    if (searchResult.totalFound === 0) {
      console.log('⚠️ 검색 결과 없음 - 다음 종으로 이동');
      return null;
    }
    console.log(`연도 범위: ${searchResult.items[0]?.year || '?'} ~ ${searchResult.items[searchResult.items.length - 1]?.year || '?'}`);

    // 2. 분석 파이프라인 실행 (Docling 없이 메타데이터/초록만으로 분석)
    console.log('\n[2단계] 배치별 순차 분석 (메타데이터/초록)...');
    const pipelineResult = await runAnalysisPipeline(searchResult, {
      batchSize: 3,
      maxBatches: 2,
      llmConfig: LLM_CONFIG,
      stopOnFirstRecord: true,
    });

    // 3. 결과 출력
    console.log('\n[분석 결과]');
    console.log(`총 검색: ${pipelineResult.totalSearched}건, 분석: ${pipelineResult.totalAnalyzed}건`);

    for (const item of pipelineResult.analyzedItems) {
      const status = item.analysis?.hasKoreaRecord
        ? '✅ 한국 기록'
        : item.analysis?.hasKoreaRecord === false
          ? '❌ 한국 기록 없음'
          : '❓ 불확실';

      const sourceLabel = item.analysis?.analysisSource === 'pdf_fulltext'
        ? '[PDF]'
        : item.analysis?.analysisSource === 'abstract_only'
          ? '[📋초록]'
          : '[⚠️메타]';

      console.log(`  ${item.year || '????'}: ${sourceLabel} ${item.title.slice(0, 40)}...`);
      console.log(`    ${status} (신뢰도: ${((item.analysis?.confidence || 0) * 100).toFixed(0)}%)`);
    }

    // 최초 기록
    if (pipelineResult.firstKoreaRecord) {
      console.log('\n★ 최초 한국 기록 발견 ★');
      const first = pipelineResult.firstKoreaRecord;
      console.log(`  연도: ${first.year}`);
      console.log(`  제목: ${first.title}`);
      console.log(`  출처: ${first.source}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n소요 시간: ${elapsed}초`);

    // 결과 저장
    const excelPath = saveAnalysisReport(pipelineResult);
    const jsonPath = saveAnalysisJSON(pipelineResult);
    console.log(`결과 저장: ${jsonPath}`);

    return pipelineResult;

  } catch (error) {
    console.error('파이프라인 실패:', error);
    return null;
  }
}

async function testFullPipeline() {
  console.log('═'.repeat(70));
  console.log('전체 파이프라인 테스트 (5개 종)');
  console.log('═'.repeat(70));
  console.log(`LLM: ${LLM_CONFIG.provider}/${LLM_CONFIG.model}`);
  console.log(`테스트 종 수: ${TEST_SPECIES_LIST.length}`);

  const totalStartTime = Date.now();
  const results: { species: string; found: number; koreaRecord: boolean }[] = [];

  for (let i = 0; i < TEST_SPECIES_LIST.length; i++) {
    const species = TEST_SPECIES_LIST[i];
    console.log(`\n[${ i + 1 }/${TEST_SPECIES_LIST.length}] ${species.name}`);

    const result = await testSingleSpecies(species);

    results.push({
      species: species.name,
      found: result?.totalSearched || 0,
      koreaRecord: !!result?.firstKoreaRecord,
    });

    // Rate limit 방지를 위한 딜레이
    if (i < TEST_SPECIES_LIST.length - 1) {
      console.log('\n⏳ 다음 종 검색 전 3초 대기...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 최종 요약
  console.log('\n' + '═'.repeat(70));
  console.log('최종 요약');
  console.log('═'.repeat(70));

  for (const r of results) {
    const status = r.koreaRecord ? '✅ 한국기록 발견' : r.found > 0 ? '❌ 한국기록 없음' : '⚠️ 검색결과 없음';
    console.log(`  ${r.species}: ${status} (검색: ${r.found}건)`);
  }

  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(1);
  console.log(`\n총 소요 시간: ${totalElapsed}초`);
  console.log('═'.repeat(70));
}

testFullPipeline().catch(console.error);
