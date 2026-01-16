/**
 * 10종 배치 테스트
 *
 * 실제 종으로 전체 파이프라인 테스트 후 통합 엑셀 생성
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchLiterature } from '../src/literature/collector';
import { runAnalysisPipeline, PipelineResult } from '../src/analysis/pipeline';
import { LLMConfig } from '../src/llm/types';
import { saveCombinedReport, saveAnalysisReport } from '../src/output/analysis-report';

// 테스트 대상 종 (10종)
const TEST_SPECIES = [
  { name: 'Ditrema temminckii', koreanName: '망상어', synonyms: ['Ditrema laeve', 'Embiotoca temminckii'] },
  { name: 'Anguilla japonica', koreanName: '뱀장어', synonyms: [] },
  { name: 'Pagrus major', koreanName: '참돔', synonyms: ['Chrysophrys major'] },
  { name: 'Sebastes schlegelii', koreanName: '조피볼락', synonyms: ['Sebastes schlegeli'] },
  { name: 'Paralichthys olivaceus', koreanName: '넙치', synonyms: [] },
  { name: 'Takifugu rubripes', koreanName: '자주복', synonyms: ['Fugu rubripes'] },
  { name: 'Mugil cephalus', koreanName: '숭어', synonyms: [] },
  { name: 'Lateolabrax japonicus', koreanName: '농어', synonyms: [] },
  { name: 'Scomber japonicus', koreanName: '고등어', synonyms: [] },
  { name: 'Engraulis japonicus', koreanName: '멸치', synonyms: [] },
];

// LLM 설정 (OpenRouter 무료 모델)
const LLM_CONFIG: LLMConfig = {
  provider: 'openrouter',
  model: process.env.OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
  apiKey: process.env.OPENROUTER_API_KEY,
};

async function testBatchSpecies() {
  console.log('='.repeat(70));
  console.log('10종 배치 테스트');
  console.log('='.repeat(70));
  console.log(`LLM: ${LLM_CONFIG.provider}/${LLM_CONFIG.model}`);
  console.log(`테스트 종 수: ${TEST_SPECIES.length}`);

  const startTime = Date.now();
  const allResults: PipelineResult[] = [];
  const summary: Array<{
    species: string;
    koreanName: string;
    searched: number;
    analyzed: number;
    hasKoreaRecord: boolean;
    firstRecordYear?: number;
    manualReviewCount: number;
    elapsed: number;
  }> = [];

  for (let i = 0; i < TEST_SPECIES.length; i++) {
    const species = TEST_SPECIES[i];

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`[${i + 1}/${TEST_SPECIES.length}] ${species.name} (${species.koreanName})`);
    console.log(`${'═'.repeat(70)}`);

    const speciesStartTime = Date.now();

    try {
      // 1. 문헌 검색
      console.log(`\n[검색 중...]`);
      const searchResult = await searchLiterature({
        scientificName: species.name,
        synonyms: species.synonyms,
        maxResults: 20,
        searchStrategy: 'both',
      });

      console.log(`검색 결과: ${searchResult.totalFound}건`);

      // 2. 분석 파이프라인 (배치 2개, 각 3건 = 최대 6건)
      console.log(`\n[분석 중...]`);
      const pipelineResult = await runAnalysisPipeline(searchResult, {
        batchSize: 3,
        maxBatches: 2,
        llmConfig: LLM_CONFIG,
        stopOnFirstRecord: true,
      });

      allResults.push(pipelineResult);

      // 3. 개별 결과 저장
      saveAnalysisReport(pipelineResult);

      const speciesElapsed = (Date.now() - speciesStartTime) / 1000;

      // 4. 요약 정보
      summary.push({
        species: species.name,
        koreanName: species.koreanName,
        searched: pipelineResult.totalSearched,
        analyzed: pipelineResult.totalAnalyzed,
        hasKoreaRecord: !!pipelineResult.firstKoreaRecord,
        firstRecordYear: pipelineResult.firstKoreaRecord?.year || undefined,
        manualReviewCount: pipelineResult.itemsNeedingManualReview.length,
        elapsed: speciesElapsed,
      });

      // 결과 출력
      console.log(`\n[결과]`);
      console.log(`  검색: ${pipelineResult.totalSearched}건, 분석: ${pipelineResult.totalAnalyzed}건`);
      console.log(`  한국 기록: ${pipelineResult.firstKoreaRecord ? `있음 (${pipelineResult.firstKoreaRecord.year}년)` : '없음'}`);
      console.log(`  수동 확인 필요: ${pipelineResult.itemsNeedingManualReview.length}건`);
      console.log(`  소요 시간: ${speciesElapsed.toFixed(1)}초`);

    } catch (error) {
      console.error(`[오류] ${species.name}:`, error);
      summary.push({
        species: species.name,
        koreanName: species.koreanName,
        searched: 0,
        analyzed: 0,
        hasKoreaRecord: false,
        manualReviewCount: 0,
        elapsed: (Date.now() - speciesStartTime) / 1000,
      });
    }

    // Rate limit 대기 (API 부하 방지)
    if (i < TEST_SPECIES.length - 1) {
      console.log(`\n[다음 종까지 5초 대기...]`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 5. 통합 리포트 생성
  console.log(`\n${'═'.repeat(70)}`);
  console.log('통합 리포트 생성');
  console.log(`${'═'.repeat(70)}`);

  const combinedPath = saveCombinedReport(allResults);

  // 6. 전체 요약
  const totalElapsed = (Date.now() - startTime) / 1000;

  console.log(`\n${'═'.repeat(70)}`);
  console.log('전체 요약');
  console.log(`${'═'.repeat(70)}`);

  console.log(`\n| 종명 | 국명 | 검색 | 분석 | 한국기록 | 최초연도 | 수동확인 | 시간 |`);
  console.log(`|------|------|------|------|----------|----------|----------|------|`);

  for (const s of summary) {
    console.log(
      `| ${s.species.slice(0, 25).padEnd(25)} | ${s.koreanName.padEnd(6)} | ${String(s.searched).padStart(4)} | ${String(s.analyzed).padStart(4)} | ${s.hasKoreaRecord ? '✅' : '❌'}        | ${s.firstRecordYear || '-'.padStart(4)}     | ${String(s.manualReviewCount).padStart(8)} | ${s.elapsed.toFixed(0).padStart(4)}s |`
    );
  }

  const foundCount = summary.filter(s => s.hasKoreaRecord).length;
  const totalManualReview = summary.reduce((sum, s) => sum + s.manualReviewCount, 0);

  console.log(`\n[통계]`);
  console.log(`  총 종 수: ${TEST_SPECIES.length}`);
  console.log(`  한국 기록 발견: ${foundCount}종`);
  console.log(`  수동 확인 필요: ${totalManualReview}건`);
  console.log(`  총 소요 시간: ${(totalElapsed / 60).toFixed(1)}분`);
  console.log(`\n[통합 리포트]`);
  console.log(`  ${combinedPath}`);

  console.log(`\n${'═'.repeat(70)}`);
  console.log('테스트 완료');
  console.log(`${'═'.repeat(70)}`);
}

testBatchSpecies().catch(console.error);
