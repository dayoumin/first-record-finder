/**
 * 검색 결과 수 테스트
 * 많이 연구된 종으로 검색해서 결과 수 확인
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchLiterature } from '../src/literature/collector';

// 테스트 대상 종 (많이 연구된 종)
const TEST_SPECIES = [
  {
    name: 'Anguilla japonica',  // 뱀장어 - 양식/생태 연구 많음
    synonyms: ['Anguilla japonica Temminck & Schlegel, 1846'],
  },
  {
    name: 'Pagrus major',  // 참돔 - 양식 연구 많음
    synonyms: ['Chrysophrys major', 'Pagrosomus major'],
  },
  {
    name: 'Ditrema temminckii',  // 망상어 - 이전 테스트 종
    synonyms: ['Ditrema laeve', 'Embiotoca temminckii'],
  },
];

async function testSearchVolume() {
  console.log('='.repeat(70));
  console.log('검색 결과 수 테스트');
  console.log('='.repeat(70));

  for (const species of TEST_SPECIES) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`종: ${species.name}`);
    console.log(`${'─'.repeat(70)}`);

    const startTime = Date.now();

    try {
      const result = await searchLiterature({
        scientificName: species.name,
        synonyms: species.synonyms,
        maxResults: 50,  // 상한 높여서 테스트
        searchStrategy: 'both',
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n[결과 요약]`);
      console.log(`  총 결과: ${result.totalFound}건`);
      console.log(`  소요 시간: ${elapsed}초`);
      console.log(`  에러: ${result.errors.length}건`);

      // 소스별 결과 수
      const bySource: Record<string, number> = {};
      for (const item of result.items) {
        bySource[item.source] = (bySource[item.source] || 0) + 1;
      }
      console.log(`\n[소스별 결과]`);
      for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${source}: ${count}건`);
      }

      // 연도 분포
      const years = result.items.filter(i => i.year).map(i => i.year!);
      if (years.length > 0) {
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        console.log(`\n[연도 범위]`);
        console.log(`  ${minYear} ~ ${maxYear}`);
      }

      // 상위 5건 출력
      console.log(`\n[상위 5건 (오래된 순)]`);
      result.items.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i + 1}. [${item.year || '????'}] ${item.source}: ${item.title.slice(0, 60)}...`);
      });

      if (result.errors.length > 0) {
        console.log(`\n[에러 목록]`);
        result.errors.forEach(e => {
          console.log(`  - ${e.source}: ${e.error}`);
        });
      }

    } catch (error) {
      console.error(`검색 실패:`, error);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('테스트 완료');
}

testSearchVolume().catch(console.error);
