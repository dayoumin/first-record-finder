/**
 * WoRMS 이명 추출 테스트 스크립트
 *
 * 사용법:
 *   npx ts-node scripts/test-worms.ts "Sebastes schlegelii"
 *   npx ts-node scripts/test-worms.ts  (기본 테스트 종 사용)
 */

import { extractSynonyms, getSynonymSearchTerms } from '../src/worms';
import { generateSearchUrls } from '../src/search';

async function main() {
  // 커맨드라인 인자 또는 기본 테스트 종
  const testName = process.argv[2] || 'Sebastes schlegelii';

  console.log('='.repeat(60));
  console.log('WoRMS 이명 추출 테스트');
  console.log('='.repeat(60));
  console.log(`검색 학명: ${testName}\n`);

  try {
    const result = await extractSynonyms(testName);

    if (!result.success) {
      console.error('❌ 검색 실패:', result.error);
      process.exit(1);
    }

    console.log('✅ 검색 성공!\n');

    // 기본 정보
    console.log('📋 기본 정보');
    console.log('-'.repeat(40));
    console.log(`유효 학명: ${result.acceptedName}`);
    console.log(`AphiaID: ${result.aphiaId}`);
    console.log();

    // 이명 목록
    console.log(`📚 이명 목록 (${result.synonyms.length}개)`);
    console.log('-'.repeat(40));
    for (const syn of result.synonyms) {
      const yearStr = syn.year ? `, ${syn.year}` : '';
      console.log(`  ${syn.status === 'accepted' ? '✓' : '○'} ${syn.name} ${syn.author}${yearStr} [${syn.status}]`);
    }
    console.log();

    // 검색용 학명 목록
    const searchTerms = getSynonymSearchTerms(result);
    console.log(`🔍 검색용 학명 (${searchTerms.length}개)`);
    console.log('-'.repeat(40));
    for (const term of searchTerms) {
      console.log(`  - ${term}`);
    }
    console.log();

    // 검색 URL
    const searchUrls = generateSearchUrls(result);
    console.log('🌐 검색 URL');
    console.log('-'.repeat(40));
    for (const item of searchUrls.slice(0, 3)) {
      console.log(`\n  ${item.name}`);
      console.log(`    Scholar: ${item.scholar.slice(0, 80)}...`);
      console.log(`    KCI: ${item.kci}`);
    }
    if (searchUrls.length > 3) {
      console.log(`\n  ... 외 ${searchUrls.length - 3}개`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('테스트 완료');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
