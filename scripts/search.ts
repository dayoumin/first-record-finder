/**
 * CLI 검색 스크립트
 *
 * 사용법:
 *   npx ts-node scripts/search.ts --name "Sebastes schlegelii"
 *   npx ts-node scripts/search.ts --name "Sebastes schlegelii" --output ./data/exports
 */

import { extractSynonyms } from '../src/worms';
import { generateSearchUrls, createFirstRecordResult } from '../src/search';
import { saveSingleResult } from '../src/output';
import * as fs from 'fs';
import * as path from 'path';

interface CliArgs {
  name: string;
  output: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    name: '',
    output: './data/exports'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' || args[i] === '-n') {
      result.name = args[i + 1] || '';
      i++;
    } else if (args[i] === '--output' || args[i] === '-o') {
      result.output = args[i + 1] || './data/exports';
      i++;
    }
  }

  return result;
}

function printUsage() {
  console.log(`
사용법:
  npx ts-node scripts/search.ts --name "학명"

옵션:
  --name, -n     검색할 학명 (필수)
  --output, -o   출력 디렉토리 (기본: ./data/exports)

예시:
  npx ts-node scripts/search.ts --name "Sebastes schlegelii"
  npx ts-node scripts/search.ts -n "Takifugu rubripes" -o ./results
`);
}

async function main() {
  const args = parseArgs();

  if (!args.name) {
    console.error('❌ 오류: 학명을 입력해주세요.\n');
    printUsage();
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('한국 수산생물 최초기록 검색');
  console.log('='.repeat(60));
  console.log(`검색 학명: ${args.name}`);
  console.log(`출력 위치: ${args.output}\n`);

  try {
    // 1. WoRMS에서 이명 추출
    console.log('🔍 WoRMS에서 이명 검색 중...');
    const synonymResult = await extractSynonyms(args.name);

    if (!synonymResult.success) {
      console.error(`❌ WoRMS 검색 실패: ${synonymResult.error}`);
      process.exit(1);
    }

    console.log(`✅ ${synonymResult.synonyms.length}개 이명 발견\n`);

    // 2. 검색 URL 생성
    const searchUrls = generateSearchUrls(synonymResult);

    // 3. 결과 객체 생성
    const firstRecordResult = createFirstRecordResult(synonymResult, []);

    // 4. 결과 출력
    console.log('📋 검색 결과');
    console.log('-'.repeat(40));
    console.log(`유효 학명: ${firstRecordResult.acceptedName}`);
    console.log(`AphiaID: ${firstRecordResult.aphiaId}`);
    console.log();

    console.log(`📚 이명 목록 (${firstRecordResult.synonyms.length}개)`);
    console.log('-'.repeat(40));
    for (const syn of firstRecordResult.synonyms) {
      console.log(`  ${syn.status === 'accepted' ? '✓' : '○'} ${syn.name}`);
    }
    console.log();

    // 5. 검색 가이드
    console.log('🔗 문헌 검색 링크');
    console.log('-'.repeat(40));
    console.log('아래 링크에서 한국 최초 기록을 검색하세요:\n');

    for (const item of searchUrls) {
      console.log(`  ${item.name}`);
      console.log(`    → Google Scholar: ${item.scholar}`);
      console.log(`    → KCI: ${item.kci}`);
      console.log();
    }

    // 6. 엑셀 저장
    console.log('-'.repeat(40));

    // 출력 디렉토리 확인
    if (!fs.existsSync(args.output)) {
      fs.mkdirSync(args.output, { recursive: true });
    }

    const excelPath = saveSingleResult(firstRecordResult, args.output);
    console.log(`📥 엑셀 저장 완료: ${excelPath}`);

    // JSON도 저장
    const jsonPath = excelPath.replace('.xlsx', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify({
      ...firstRecordResult,
      searchUrls
    }, null, 2), 'utf-8');
    console.log(`📄 JSON 저장 완료: ${jsonPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 검색 완료');
    console.log('='.repeat(60));
    console.log('\n다음 단계:');
    console.log('1. 위 검색 링크에서 각 이명으로 문헌 검색');
    console.log('2. 연도순(오래된 것 먼저)으로 정렬');
    console.log('3. 한국 채집/관찰 기록이 있는 가장 오래된 문헌 확인');
    console.log('4. 엑셀 파일에 결과 기록\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
