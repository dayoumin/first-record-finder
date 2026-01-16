/**
 * 문헌 검색 테스트 스크립트
 * API 키 없이 사용 가능한 소스만 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchLiterature } from '../src/literature/collector';
import { LiteratureSource } from '../src/literature/types';

// API 키 없이 사용 가능한 소스
const AVAILABLE_SOURCES: LiteratureSource[] = [
  'bhl',      // BHL (API 키 있음)
  'openalex', // OpenAlex (API 키 불필요)
  'jstage',   // J-STAGE (API 키 불필요)
  'cinii',    // CiNii (API 키 불필요)
];

// 테스트 학명 목록
const TEST_SPECIES = [
  { name: 'Grateloupia filicina', synonyms: ['Grateloupia asiatica'] },
  { name: 'Sciaenops ocellatus', synonyms: [] },
  { name: 'Nannochloropsis granulata', synonyms: [] },
];

async function main() {
  console.log('='.repeat(60));
  console.log('문헌 검색 테스트 (API 키 없이 사용 가능한 소스)');
  console.log('소스:', AVAILABLE_SOURCES.join(', '));
  console.log('='.repeat(60));

  for (const species of TEST_SPECIES) {
    console.log(`\n\n${'#'.repeat(60)}`);
    console.log(`# 학명: ${species.name}`);
    console.log(`# 이명: ${species.synonyms.join(', ') || '없음'}`);
    console.log('#'.repeat(60));

    try {
      const result = await searchLiterature({
        scientificName: species.name,
        synonyms: species.synonyms,
        sources: AVAILABLE_SOURCES,
        maxResults: 10,
        searchStrategy: 'both',
      });

      console.log(`\n총 ${result.totalFound}건 발견\n`);

      if (result.items.length > 0) {
        console.log('--- 검색 결과 (연도순) ---');
        result.items.forEach((item, i) => {
          console.log(`\n[${i + 1}] ${item.title}`);
          console.log(`    소스: ${item.source} | 연도: ${item.year || '불명'}`);
          console.log(`    저자: ${item.authors.slice(0, 3).join(', ')}${item.authors.length > 3 ? ' 외' : ''}`);
          console.log(`    저널: ${item.journal || '-'}`);
          console.log(`    URL: ${item.url}`);
          if (item.pdfUrl) {
            console.log(`    PDF: ${item.pdfUrl}`);
          }
        });
      }

      if (result.errors.length > 0) {
        console.log('\n--- 에러 ---');
        result.errors.forEach(err => {
          console.log(`  ${err.source}: ${err.error}`);
        });
      }

    } catch (error) {
      console.error(`에러 발생:`, error);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('테스트 완료');
  console.log('='.repeat(60));
}

main();
