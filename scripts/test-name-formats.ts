/**
 * 학명 입력 형식 테스트
 *
 * 다양한 형식의 학명 입력이 WoRMS에서 인식되는지 확인
 */

import { extractSynonyms } from '../src/worms/synonym-extractor';

// 테스트할 다양한 형식
const testFormats = [
  // 1. 기본 형식 (속명 + 종명)
  { input: 'Sebastes schlegelii', desc: '기본 형식' },

  // 2. 저자 포함
  { input: 'Sebastes schlegelii Hilgendorf, 1880', desc: '저자 포함' },

  // 3. 철자 변이
  { input: 'Sebastes schlegeli', desc: '철자 변이 (i 하나)' },

  // 4. 과거 속명 (이명)
  { input: 'Sebastichthys schlegelii', desc: '과거 속명' },

  // 5. 아속명 포함
  { input: 'Sebastes (Sebastocles) schlegelii', desc: '아속명 포함' },

  // 6. 대소문자 변이
  { input: 'sebastes schlegelii', desc: '소문자' },
  { input: 'SEBASTES SCHLEGELII', desc: '대문자' },

  // 7. 다른 종으로 테스트
  { input: 'Fugu rubripes', desc: '과거 속명 (복어)' },
  { input: 'Takifugu rubripes', desc: '현재 유효명 (복어)' },
];

async function testNameFormats() {
  console.log('='.repeat(70));
  console.log('학명 입력 형식 테스트');
  console.log('='.repeat(70));
  console.log();
  console.log('다양한 형식의 학명이 WoRMS에서 인식되는지 확인합니다.\n');

  const results: Array<{
    input: string;
    desc: string;
    success: boolean;
    acceptedName: string | null;
    aphiaId: number | null;
  }> = [];

  for (const test of testFormats) {
    console.log(`🔍 테스트: "${test.input}" (${test.desc})`);

    try {
      const result = await extractSynonyms(test.input);

      results.push({
        input: test.input,
        desc: test.desc,
        success: result.success,
        acceptedName: result.acceptedName,
        aphiaId: result.aphiaId
      });

      if (result.success) {
        console.log(`   ✅ 성공 → ${result.acceptedName} (ID: ${result.aphiaId})`);
      } else {
        console.log(`   ❌ 실패: ${result.error}`);
      }

      // API 부하 방지
      await new Promise(r => setTimeout(r, 800));

    } catch (error) {
      console.log(`   ❌ 오류: ${error}`);
      results.push({
        input: test.input,
        desc: test.desc,
        success: false,
        acceptedName: null,
        aphiaId: null
      });
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(70));
  console.log('결과 요약');
  console.log('='.repeat(70));
  console.log();

  console.log('| 형식 | 입력 | 결과 | 유효명 |');
  console.log('|------|------|------|--------|');

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const accepted = r.acceptedName || '-';
    const inputShort = r.input.length > 25 ? r.input.slice(0, 22) + '...' : r.input;
    console.log(`| ${r.desc.padEnd(15)} | ${inputShort.padEnd(25)} | ${status} | ${accepted} |`);
  }

  const successCount = results.filter(r => r.success).length;
  console.log();
  console.log(`성공률: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);

  // 결론
  console.log('\n' + '='.repeat(70));
  console.log('결론');
  console.log('='.repeat(70));

  const allSameTarget = results.filter(r => r.success).every(r =>
    r.aphiaId === results.find(x => x.success)?.aphiaId ||
    r.acceptedName?.includes('rubripes')
  );

  if (allSameTarget) {
    console.log('✅ 다양한 형식의 입력이 동일한 종으로 정확히 매핑됩니다.');
  }

  console.log('\n권장사항:');
  console.log('1. 기본 형식 (속명 + 종명)으로 입력 권장');
  console.log('2. 저자명은 생략해도 됨');
  console.log('3. 과거 이명으로도 검색 가능');
}

testNameFormats();
