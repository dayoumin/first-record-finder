/**
 * 문헌 수집 클라이언트 테스트 스크립트
 *
 * 각 API 클라이언트가 정상적으로 작동하는지 확인
 * 실행: npx tsx scripts/test-literature-clients.ts
 */

import {
  JStageClient,
  CiNiiClient,
  GBIFClient,
  OBISClient,
  BhlClient,
  SemanticScholarClient,
  getAvailableSources,
} from '../src/literature';

// 테스트용 학명 (조피볼락 - 한국에서 흔한 어종)
const TEST_SPECIES = 'Sebastes schlegelii';

// 결과 요약용 인터페이스
interface TestResult {
  client: string;
  success: boolean;
  count: number;
  error?: string;
  sampleTitles?: string[];
}

/**
 * 클라이언트별 테스트 실행
 */
async function testClient(
  name: string,
  testFn: () => Promise<{ count: number; titles: string[] }>
): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log('='.repeat(60));

  try {
    const startTime = Date.now();
    const result = await testFn();
    const elapsed = Date.now() - startTime;

    console.log(`✅ ${name}: ${result.count} results found (${elapsed}ms)`);

    return {
      client: name,
      success: true,
      count: result.count,
      sampleTitles: result.titles.slice(0, 3),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ ${name}: ${errorMessage}`);

    return {
      client: name,
      success: false,
      count: 0,
      error: errorMessage,
    };
  }
}

/**
 * J-STAGE 테스트
 */
async function testJStage(): Promise<{ count: number; titles: string[] }> {
  const client = new JStageClient();
  const results = await client.search(TEST_SPECIES, {
    maxResults: 10,
    includeKoreaKeyword: true,
  });

  console.log(`  Found ${results.length} items`);
  for (const item of results.slice(0, 3)) {
    console.log(`  - [${item.year || 'N/A'}] ${item.title.slice(0, 60)}...`);
  }

  return {
    count: results.length,
    titles: results.map(r => r.title),
  };
}

/**
 * CiNii 테스트
 */
async function testCiNii(): Promise<{ count: number; titles: string[] }> {
  const client = new CiNiiClient();
  const results = await client.search(TEST_SPECIES, {
    maxResults: 10,
    includeKoreaKeyword: true,
  });

  console.log(`  Found ${results.length} items`);
  for (const item of results.slice(0, 3)) {
    console.log(`  - [${item.year || 'N/A'}] ${item.title.slice(0, 60)}...`);
  }

  return {
    count: results.length,
    titles: results.map(r => r.title),
  };
}

/**
 * GBIF 테스트
 */
async function testGBIF(): Promise<{ count: number; titles: string[] }> {
  const client = new GBIFClient();
  const results = await client.search(TEST_SPECIES, {
    maxResults: 10,
  });

  console.log(`  Found ${results.length} specimen records`);
  for (const item of results.slice(0, 3)) {
    console.log(`  - [${item.year || 'N/A'}] ${item.title.slice(0, 60)}...`);
    if (item.snippet) {
      console.log(`    ${item.snippet}`);
    }
  }

  return {
    count: results.length,
    titles: results.map(r => r.title),
  };
}

/**
 * OBIS 테스트
 */
async function testOBIS(): Promise<{ count: number; titles: string[] }> {
  const client = new OBISClient();
  const results = await client.search(TEST_SPECIES, {
    maxResults: 10,
  });

  console.log(`  Found ${results.length} occurrence records`);
  for (const item of results.slice(0, 3)) {
    console.log(`  - [${item.year || 'N/A'}] ${item.title.slice(0, 60)}...`);
    if (item.snippet) {
      console.log(`    ${item.snippet}`);
    }
  }

  return {
    count: results.length,
    titles: results.map(r => r.title),
  };
}

/**
 * BHL 테스트 (API 키 필요)
 */
async function testBHL(): Promise<{ count: number; titles: string[] }> {
  const apiKey = process.env.BHL_API_KEY;
  if (!apiKey) {
    throw new Error('BHL_API_KEY not set. Skipping BHL test.');
  }

  const client = new BhlClient();
  const results = await client.search(TEST_SPECIES, {
    maxResults: 10,
    yearFrom: 1800,
    yearTo: 1970,
  });

  console.log(`  Found ${results.length} items`);
  for (const item of results.slice(0, 3)) {
    console.log(`  - [${item.year || 'N/A'}] ${item.title.slice(0, 60)}...`);
  }

  return {
    count: results.length,
    titles: results.map(r => r.title),
  };
}

/**
 * Semantic Scholar 테스트
 */
async function testSemanticScholar(): Promise<{ count: number; titles: string[] }> {
  const client = new SemanticScholarClient();
  const results = await client.search(TEST_SPECIES, {
    maxResults: 10,
    includeKoreaKeyword: true,
  });

  console.log(`  Found ${results.length} items`);
  for (const item of results.slice(0, 3)) {
    console.log(`  - [${item.year || 'N/A'}] ${item.title.slice(0, 60)}...`);
  }

  return {
    count: results.length,
    titles: results.map(r => r.title),
  };
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Literature Client Integration Test                    ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Test Species: ${TEST_SPECIES.padEnd(43)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 사용 가능한 소스 확인
  const availableSources = getAvailableSources();
  console.log(`\nAvailable sources: ${availableSources.join(', ')}`);

  const results: TestResult[] = [];

  // 각 클라이언트 테스트 (순차 실행 - rate limiting 존중)
  results.push(await testClient('J-STAGE', testJStage));
  results.push(await testClient('CiNii', testCiNii));
  results.push(await testClient('GBIF', testGBIF));
  results.push(await testClient('OBIS', testOBIS));
  results.push(await testClient('Semantic Scholar', testSemanticScholar));
  results.push(await testClient('BHL', testBHL));

  // 결과 요약
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                     Test Summary                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const countInfo = result.success ? `${result.count} results` : result.error?.slice(0, 30);
    console.log(`║ ${status} ${result.client.padEnd(20)} ${String(countInfo).padEnd(30)}║`);
  }

  console.log('╚════════════════════════════════════════════════════════════╝');

  // 전체 성공/실패 통계
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  // 샘플 결과 출력
  console.log('\n--- Sample Results ---');
  for (const result of results) {
    if (result.success && result.sampleTitles && result.sampleTitles.length > 0) {
      console.log(`\n[${result.client}]`);
      for (const title of result.sampleTitles) {
        console.log(`  • ${title.slice(0, 70)}${title.length > 70 ? '...' : ''}`);
      }
    }
  }

  // 종료 코드
  process.exit(failed > 0 ? 1 : 0);
}

// 실행
main().catch(console.error);
