/**
 * 이명 연도 추출 테스트
 *
 * 여러 학명으로 WoRMS API를 호출하여 이명과 연도가 제대로 추출되는지 확인
 */

import { extractSynonyms } from '../src/worms/synonym-extractor';

// 테스트할 학명 목록
const testSpecies = [
  'Sebastes schlegelii',      // 조피볼락
  'Takifugu rubripes',        // 자주복
  'Platycephalus indicus',    // 양태
  'Octopus vulgaris',         // 문어
  'Penaeus monodon',          // 블랙타이거새우
];

async function testYearExtraction() {
  console.log('='.repeat(70));
  console.log('WoRMS 이명 연도 추출 테스트');
  console.log('='.repeat(70));
  console.log();

  for (const species of testSpecies) {
    console.log(`\n🔍 검색: ${species}`);
    console.log('-'.repeat(50));

    try {
      const result = await extractSynonyms(species);

      if (!result.success) {
        console.log(`  ❌ 실패: ${result.error}`);
        continue;
      }

      console.log(`  ✅ 유효명: ${result.acceptedName}`);
      console.log(`  🆔 AphiaID: ${result.aphiaId}`);
      console.log();
      console.log(`  📚 이명 목록 (${result.synonyms.length}개):`);
      console.log('  ' + '-'.repeat(48));

      // 테이블 형식으로 출력
      console.log('  | 상태      | 연도  | 학명');
      console.log('  |' + '-'.repeat(10) + '|' + '-'.repeat(7) + '|' + '-'.repeat(30));

      for (const syn of result.synonyms) {
        const status = syn.status.padEnd(8);
        const year = syn.year ? syn.year.toString() : '----';
        const name = syn.name.length > 28 ? syn.name.slice(0, 25) + '...' : syn.name;
        console.log(`  | ${status} | ${year}  | ${name}`);
      }

      // 연도 통계
      const withYear = result.synonyms.filter(s => s.year !== null);
      const years = withYear.map(s => s.year as number);

      console.log();
      console.log(`  📊 연도 추출 통계:`);
      console.log(`     - 연도 있음: ${withYear.length}/${result.synonyms.length}개`);

      if (years.length > 0) {
        console.log(`     - 최초 연도: ${Math.min(...years)}`);
        console.log(`     - 최근 연도: ${Math.max(...years)}`);
      }

      // API 부하 방지
      await new Promise(r => setTimeout(r, 1000));

    } catch (error) {
      console.log(`  ❌ 오류: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('테스트 완료');
  console.log('='.repeat(70));
}

testYearExtraction();
