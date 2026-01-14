/**
 * 넙치(Paralichthys olivaceus) 시뮬레이션 테스트
 *
 * 전체 검색 파이프라인 테스트
 * 실행: npx tsx scripts/test-flounder-simulation.ts
 */

import {
  JStageClient,
  CiNiiClient,
  GBIFClient,
  OBISClient,
  BhlClient,
  SemanticScholarClient,
  LiteratureItem,
  searchLiterature,
} from '../src/literature';

// 넙치 학명 및 이명
const FLOUNDER = {
  scientificName: 'Paralichthys olivaceus',
  koreanName: '넙치',
  synonyms: [
    'Hippoglossus olivaceus',      // 원기재명
    'Pseudorhombus olivaceus',
    'Paralichthys olivaceus',
  ],
};

interface TestResult {
  source: string;
  success: boolean;
  count: number;
  oldestYear: number | null;
  newestYear: number | null;
  error?: string;
  items: LiteratureItem[];
}

/**
 * 개별 클라이언트 테스트
 */
async function testIndividualClients(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log('\n📚 Individual Client Tests');
  console.log('='.repeat(60));

  // J-STAGE
  console.log('\n[J-STAGE] Testing...');
  try {
    const client = new JStageClient();
    const items = await client.search(FLOUNDER.scientificName, {
      maxResults: 15,
      includeKoreaKeyword: true,
    });
    const years = items.map(i => i.year).filter((y): y is number => y !== null);
    results.push({
      source: 'J-STAGE',
      success: true,
      count: items.length,
      oldestYear: years.length > 0 ? Math.min(...years) : null,
      newestYear: years.length > 0 ? Math.max(...years) : null,
      items,
    });
    console.log(`  ✅ ${items.length} results (${years.length > 0 ? Math.min(...years) : 'N/A'} ~ ${years.length > 0 ? Math.max(...years) : 'N/A'})`);
  } catch (error) {
    results.push({
      source: 'J-STAGE',
      success: false,
      count: 0,
      oldestYear: null,
      newestYear: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    });
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // CiNii
  console.log('\n[CiNii] Testing...');
  try {
    const client = new CiNiiClient();
    const items = await client.search(FLOUNDER.scientificName, {
      maxResults: 15,
      includeKoreaKeyword: true,
    });
    const years = items.map(i => i.year).filter((y): y is number => y !== null);
    results.push({
      source: 'CiNii',
      success: true,
      count: items.length,
      oldestYear: years.length > 0 ? Math.min(...years) : null,
      newestYear: years.length > 0 ? Math.max(...years) : null,
      items,
    });
    console.log(`  ✅ ${items.length} results (${years.length > 0 ? Math.min(...years) : 'N/A'} ~ ${years.length > 0 ? Math.max(...years) : 'N/A'})`);
  } catch (error) {
    results.push({
      source: 'CiNii',
      success: false,
      count: 0,
      oldestYear: null,
      newestYear: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    });
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // GBIF
  console.log('\n[GBIF] Testing...');
  try {
    const client = new GBIFClient();
    const items = await client.search(FLOUNDER.scientificName, {
      maxResults: 15,
    });
    const years = items.map(i => i.year).filter((y): y is number => y !== null);
    results.push({
      source: 'GBIF',
      success: true,
      count: items.length,
      oldestYear: years.length > 0 ? Math.min(...years) : null,
      newestYear: years.length > 0 ? Math.max(...years) : null,
      items,
    });
    console.log(`  ✅ ${items.length} results (${years.length > 0 ? Math.min(...years) : 'N/A'} ~ ${years.length > 0 ? Math.max(...years) : 'N/A'})`);
  } catch (error) {
    results.push({
      source: 'GBIF',
      success: false,
      count: 0,
      oldestYear: null,
      newestYear: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    });
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // OBIS
  console.log('\n[OBIS] Testing...');
  try {
    const client = new OBISClient();
    const items = await client.search(FLOUNDER.scientificName, {
      maxResults: 15,
    });
    const years = items.map(i => i.year).filter((y): y is number => y !== null);
    results.push({
      source: 'OBIS',
      success: true,
      count: items.length,
      oldestYear: years.length > 0 ? Math.min(...years) : null,
      newestYear: years.length > 0 ? Math.max(...years) : null,
      items,
    });
    console.log(`  ✅ ${items.length} results (${years.length > 0 ? Math.min(...years) : 'N/A'} ~ ${years.length > 0 ? Math.max(...years) : 'N/A'})`);
  } catch (error) {
    results.push({
      source: 'OBIS',
      success: false,
      count: 0,
      oldestYear: null,
      newestYear: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    });
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // BHL (API 키 필요)
  console.log('\n[BHL] Testing...');
  if (process.env.BHL_API_KEY) {
    try {
      const client = new BhlClient();
      const items = await client.search(FLOUNDER.scientificName, {
        maxResults: 15,
        yearFrom: 1800,
        yearTo: 1970,
      });
      const years = items.map(i => i.year).filter((y): y is number => y !== null);
      results.push({
        source: 'BHL',
        success: true,
        count: items.length,
        oldestYear: years.length > 0 ? Math.min(...years) : null,
        newestYear: years.length > 0 ? Math.max(...years) : null,
        items,
      });
      console.log(`  ✅ ${items.length} results (${years.length > 0 ? Math.min(...years) : 'N/A'} ~ ${years.length > 0 ? Math.max(...years) : 'N/A'})`);
    } catch (error) {
      results.push({
        source: 'BHL',
        success: false,
        count: 0,
        oldestYear: null,
        newestYear: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        items: [],
      });
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  } else {
    results.push({
      source: 'BHL',
      success: false,
      count: 0,
      oldestYear: null,
      newestYear: null,
      error: '⚠️ BHL_API_KEY not set',
      items: [],
    });
    console.log('  ⚠️ Skipped (BHL_API_KEY not set)');
  }

  // Semantic Scholar
  console.log('\n[Semantic Scholar] Testing...');
  try {
    const client = new SemanticScholarClient();
    const items = await client.search(FLOUNDER.scientificName, {
      maxResults: 10,
      includeKoreaKeyword: true,
    });
    const years = items.map(i => i.year).filter((y): y is number => y !== null);
    results.push({
      source: 'Semantic Scholar',
      success: true,
      count: items.length,
      oldestYear: years.length > 0 ? Math.min(...years) : null,
      newestYear: years.length > 0 ? Math.max(...years) : null,
      items,
    });
    console.log(`  ✅ ${items.length} results (${years.length > 0 ? Math.min(...years) : 'N/A'} ~ ${years.length > 0 ? Math.max(...years) : 'N/A'})`);
  } catch (error) {
    results.push({
      source: 'Semantic Scholar',
      success: false,
      count: 0,
      oldestYear: null,
      newestYear: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    });
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return results;
}

/**
 * 통합 검색 테스트 (collector 사용)
 */
async function testIntegratedSearch(): Promise<void> {
  console.log('\n\n📦 Integrated Search Test (collector.searchLiterature)');
  console.log('='.repeat(60));

  try {
    // API 키가 없는 소스 제외
    const sources: ('jstage' | 'cinii' | 'gbif' | 'obis')[] = ['jstage', 'cinii', 'gbif', 'obis'];

    console.log(`\nSearching: ${FLOUNDER.scientificName}`);
    console.log(`Synonyms: ${FLOUNDER.synonyms.join(', ')}`);
    console.log(`Sources: ${sources.join(', ')}`);
    console.log(`Strategy: both (historical + korea)`);

    const startTime = Date.now();

    const result = await searchLiterature(
      {
        scientificName: FLOUNDER.scientificName,
        synonyms: FLOUNDER.synonyms,
        sources,
        maxResults: 30,
        searchStrategy: 'both',
      },
      (progress) => {
        if (progress.currentItem) {
          process.stdout.write(`\r  Searching: ${progress.currentSource} - ${progress.currentItem.slice(0, 40)}...`);
        }
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`\n\n  Total time: ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`  Total results: ${result.totalFound}`);

    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.map(e => `${e.source}: ${e.error}`).join(', ')}`);
    }

    // 연도별 분포
    const yearDistribution: Record<string, number> = {};
    for (const item of result.items) {
      const decade = item.year ? `${Math.floor(item.year / 10) * 10}s` : 'Unknown';
      yearDistribution[decade] = (yearDistribution[decade] || 0) + 1;
    }

    console.log('\n  Year distribution:');
    const sortedDecades = Object.keys(yearDistribution).sort();
    for (const decade of sortedDecades) {
      console.log(`    ${decade}: ${yearDistribution[decade]}`);
    }

    // 소스별 분포
    const sourceDistribution: Record<string, number> = {};
    for (const item of result.items) {
      sourceDistribution[item.source] = (sourceDistribution[item.source] || 0) + 1;
    }

    console.log('\n  Source distribution:');
    for (const [source, count] of Object.entries(sourceDistribution)) {
      console.log(`    ${source}: ${count}`);
    }

    // 가장 오래된 기록 5개
    console.log('\n  Oldest records:');
    const sortedByYear = [...result.items]
      .filter(i => i.year !== null)
      .sort((a, b) => (a.year || 9999) - (b.year || 9999));

    for (const item of sortedByYear.slice(0, 5)) {
      console.log(`    [${item.year}] [${item.source}] ${item.title.slice(0, 50)}...`);
    }

  } catch (error) {
    console.error(`\n  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * 문제점 분석
 */
function analyzeIssues(results: TestResult[]): void {
  console.log('\n\n🔍 Issue Analysis');
  console.log('='.repeat(60));

  const issues: string[] = [];

  // API 키 관련
  const bhlResult = results.find(r => r.source === 'BHL');
  if (bhlResult && !bhlResult.success && bhlResult.error?.includes('API_KEY')) {
    issues.push('⚠️ BHL API 키 미설정 - 1800년대 원기재 논문 검색 불가');
  }

  const semanticResult = results.find(r => r.source === 'Semantic Scholar');
  if (semanticResult && !semanticResult.success && semanticResult.error?.includes('429')) {
    issues.push('⚠️ Semantic Scholar Rate Limit - API 키 없이 사용 시 제한됨');
  }

  // 결과 없음
  for (const result of results) {
    if (result.success && result.count === 0) {
      issues.push(`ℹ️ ${result.source}: 결과 없음 (한국 기록이 없거나 검색어 불일치)`);
    }
  }

  // GBIF 한국 데이터 부족
  const gbifResult = results.find(r => r.source === 'GBIF');
  if (gbifResult && gbifResult.success && gbifResult.count === 0) {
    issues.push('ℹ️ GBIF: 한국(KR) 표본 데이터 없음 - 다른 국가 코드 필요할 수 있음');
  }

  // 오래된 기록 부족
  const allYears = results
    .flatMap(r => r.items.map(i => i.year))
    .filter((y): y is number => y !== null);

  if (allYears.length > 0) {
    const oldestYear = Math.min(...allYears);
    if (oldestYear > 1950) {
      issues.push(`⚠️ 가장 오래된 기록이 ${oldestYear}년 - BHL 없이는 역사적 문헌 검색 제한`);
    }
  }

  if (issues.length === 0) {
    console.log('  ✅ 특별한 문제점 없음');
  } else {
    for (const issue of issues) {
      console.log(`  ${issue}`);
    }
  }

  // 권장 사항
  console.log('\n📋 Recommendations:');
  if (!process.env.BHL_API_KEY) {
    console.log('  1. BHL API 키 발급: https://www.biodiversitylibrary.org/api2/key');
    console.log('     → .env.local에 BHL_API_KEY=xxx 추가');
  }
  if (semanticResult && !semanticResult.success) {
    console.log('  2. Semantic Scholar API 키 발급: https://www.semanticscholar.org/product/api');
    console.log('     → .env.local에 SEMANTIC_SCHOLAR_API_KEY=xxx 추가');
  }
}

/**
 * 메인 함수
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     넙치 (Paralichthys olivaceus) 검색 시뮬레이션          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ 학명: ${FLOUNDER.scientificName.padEnd(51)}║`);
  console.log(`║ 국명: ${FLOUNDER.koreanName.padEnd(51)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 환경 변수 확인
  console.log('\n🔑 API Keys:');
  console.log(`  BHL_API_KEY: ${process.env.BHL_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  SEMANTIC_SCHOLAR_API_KEY: ${process.env.SEMANTIC_SCHOLAR_API_KEY ? '✅ Set' : '⚠️ Not set (rate limited)'}`);

  // 개별 클라이언트 테스트
  const results = await testIndividualClients();

  // 통합 검색 테스트
  await testIntegratedSearch();

  // 문제점 분석
  analyzeIssues(results);

  // 요약
  console.log('\n\n📊 Summary');
  console.log('='.repeat(60));
  console.log('| Source           | Status | Count | Oldest | Newest |');
  console.log('|------------------|--------|-------|--------|--------|');
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`| ${r.source.padEnd(16)} | ${status}     | ${String(r.count).padStart(5)} | ${String(r.oldestYear || '-').padStart(6)} | ${String(r.newestYear || '-').padStart(6)} |`);
  }
  console.log('');
}

main().catch(console.error);
