/**
 * 전체 워크플로우 시뮬레이션 테스트
 *
 * 테스트 종:
 * - 뱀장어 (Anguilla japonica)
 * - 망상어 (Ditrema temminckii)
 */

import { extractSynonyms } from '../src/worms';
import { searchLiterature, getEnabledSources, getSourceConfigs } from '../src/literature';

// 테스트할 종 목록
const TEST_SPECIES = [
  { koreanName: '뱀장어', scientificName: 'Anguilla japonica' },
  { koreanName: '망상어', scientificName: 'Ditrema temminckii' },
];

async function runSimulation() {
  console.log('='.repeat(60));
  console.log('전체 워크플로우 시뮬레이션');
  console.log('='.repeat(60));

  // 1. 활성화된 소스 확인
  console.log('\n[1] 활성화된 문헌 소스');
  console.log('-'.repeat(40));
  const configs = getSourceConfigs();
  const enabledSources = getEnabledSources();

  configs.forEach(config => {
    const status = config.enabled ? '✅' : '❌';
    const apiKeyNote = config.requiresApiKey ? ` (API키: ${config.apiKeyEnvVar})` : '';
    console.log(`  ${status} ${config.name}: ${config.description}${apiKeyNote}`);
  });

  console.log(`\n  → 검색에 사용될 소스: ${enabledSources.join(', ')}`);

  // 2. 각 종에 대해 테스트
  for (const species of TEST_SPECIES) {
    console.log('\n' + '='.repeat(60));
    console.log(`[테스트] ${species.koreanName} (${species.scientificName})`);
    console.log('='.repeat(60));

    // 2-1. WoRMS 이명 추출
    console.log('\n[2] WoRMS 이명 추출');
    console.log('-'.repeat(40));

    try {
      const result = await extractSynonyms(species.scientificName);

      if (result.acceptedName) {
        console.log(`  유효명: ${result.acceptedName}`);
        console.log(`  AphiaID: ${result.aphiaId}`);
        console.log(`  이명 수: ${result.synonyms.length}개`);

        if (result.synonyms.length > 0) {
          console.log('\n  이명 목록:');
          result.synonyms.slice(0, 10).forEach((syn, i) => {
            const year = syn.year ? ` (${syn.year})` : '';
            console.log(`    ${i + 1}. ${syn.name}${year} [${syn.status}]`);
          });
          if (result.synonyms.length > 10) {
            console.log(`    ... 외 ${result.synonyms.length - 10}개`);
          }
        }

        // 2-2. 문헌 검색 (최대 5개씩만)
        console.log('\n[3] 문헌 검색');
        console.log('-'.repeat(40));

        const synonymNames = result.synonyms.map(s => s.name);

        const searchResult = await searchLiterature({
          scientificName: result.acceptedName,
          synonyms: synonymNames.slice(0, 3), // 테스트용으로 이명 3개만
          maxResults: 5, // 소스당 최대 5개
          yearFrom: 1800,
          yearTo: 2025,
        }, (progress) => {
          if (progress.currentSource) {
            process.stdout.write(`\r  검색 중: ${progress.currentSource} (${progress.searched}건)`);
          }
        });

        console.log(`\n\n  검색 결과: 총 ${searchResult.totalFound}건`);

        if (searchResult.errors.length > 0) {
          console.log('\n  오류 발생 소스:');
          searchResult.errors.forEach(err => {
            console.log(`    - ${err.source}: ${err.error}`);
          });
        }

        // 소스별 결과
        const bySource: Record<string, number> = {};
        searchResult.items.forEach(item => {
          bySource[item.source] = (bySource[item.source] || 0) + 1;
        });

        console.log('\n  소스별 결과:');
        Object.entries(bySource).forEach(([source, count]) => {
          console.log(`    - ${source}: ${count}건`);
        });

        // 상위 결과 출력
        if (searchResult.items.length > 0) {
          console.log('\n  상위 문헌 (최대 5개):');
          searchResult.items.slice(0, 5).forEach((item, i) => {
            const year = item.year || '연도 미상';
            const authors = item.authors.slice(0, 2).join(', ');
            const pdfStatus = item.pdfUrl ? '📄' : '🔗';
            console.log(`    ${i + 1}. [${item.source}] ${pdfStatus} ${item.title.slice(0, 50)}...`);
            console.log(`       ${authors} (${year})`);
          });
        }

      } else {
        console.log(`  ⚠️ WoRMS에서 종을 찾을 수 없음`);
      }
    } catch (error) {
      console.error(`  ❌ 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('시뮬레이션 완료');
  console.log('='.repeat(60));
}

// 실행
runSimulation().catch(console.error);
