/**
 * ScienceON 확장 기능 테스트
 * 논문/특허/보고서 검색 테스트
 *
 * 실행: npx ts-node scripts/test-scienceon-extended.ts
 */

import 'dotenv/config';
import { ScienceOnClient } from '../src/literature/scienceon-client';

async function main() {
  const client = new ScienceOnClient();
  const testQuery = 'Sebastes schlegelii';  // 조피볼락

  console.log('='.repeat(60));
  console.log('ScienceON 확장 기능 테스트');
  console.log('='.repeat(60));
  console.log(`검색어: ${testQuery}`);
  console.log('');

  // 1. 논문 검색 (ARTI)
  console.log('1. 논문 검색 (ARTI)');
  console.log('-'.repeat(40));
  try {
    const articles = await client.searchArticles(testQuery, { maxResults: 5 });
    console.log(`  결과: ${articles.length}건`);
    articles.slice(0, 3).forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.title}`);
      console.log(`      저자: ${item.authors.join(', ') || 'N/A'}`);
      console.log(`      연도: ${item.year || 'N/A'}`);
      console.log(`      URL: ${item.url}`);
    });
  } catch (error) {
    console.error(`  에러: ${error}`);
  }
  console.log('');

  // 2. 특허 검색 (PATE)
  console.log('2. 특허 검색 (PATE)');
  console.log('-'.repeat(40));
  try {
    const patents = await client.searchPatents(testQuery, { maxResults: 5 });
    console.log(`  결과: ${patents.length}건`);
    patents.slice(0, 3).forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.title}`);
      console.log(`      출원인: ${item.applicant || 'N/A'}`);
      console.log(`      출원번호: ${item.applicationNumber || 'N/A'}`);
      console.log(`      출원일: ${item.applicationDate || 'N/A'}`);
      console.log(`      IPC: ${item.ipcCodes.join(', ') || 'N/A'}`);
      console.log(`      URL: ${item.url}`);
    });
  } catch (error) {
    console.error(`  에러: ${error}`);
  }
  console.log('');

  // 3. 연구보고서 검색 (REPO)
  console.log('3. 연구보고서 검색 (REPO)');
  console.log('-'.repeat(40));
  try {
    const reports = await client.searchReports(testQuery, { maxResults: 5 });
    console.log(`  결과: ${reports.length}건`);
    reports.slice(0, 3).forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.title}`);
      console.log(`      연구기관: ${item.organization || 'N/A'}`);
      console.log(`      과제명: ${item.projectName || 'N/A'}`);
      console.log(`      연도: ${item.year || 'N/A'}`);
      console.log(`      URL: ${item.url}`);
    });
  } catch (error) {
    console.error(`  에러: ${error}`);
  }
  console.log('');

  // 4. 통합 검색
  console.log('4. 통합 검색 (searchAll)');
  console.log('-'.repeat(40));
  try {
    const all = await client.searchAll(testQuery, { maxResults: 3 });
    console.log(`  논문: ${all.articles.length}건`);
    console.log(`  특허: ${all.patents.length}건`);
    console.log(`  보고서: ${all.reports.length}건`);
    console.log(`  총계: ${all.articles.length + all.patents.length + all.reports.length}건`);
  } catch (error) {
    console.error(`  에러: ${error}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('테스트 완료');
  console.log('='.repeat(60));
}

main().catch(console.error);
