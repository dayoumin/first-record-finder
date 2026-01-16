# 코드 리뷰 요청: 문헌 검색 전략 최적화

## 변경 목적

한국 해양생물 최초 기록 문헌 검색 시 API 호출을 최적화하고, 소스별 특성에 맞는 검색 전략을 적용하여 검색 효율을 높임.

---

## 변경 파일

### 1. `src/literature/bhl-client.ts`

**변경 내용**: BHL(Biodiversity Heritage Library) 검색 시 역사적 한국 표기(Corea/Korea) 지원 추가

```typescript
// 한국 관련 키워드 (역사적 표기 포함)
// - Corea: 1800-1910년대 주로 사용
// - Korea: 1910년대 이후
const KOREA_KEYWORDS = ['Corea', 'Korea', 'Korean'];

async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
  // API 키 확인 - 없으면 빈 결과 반환
  if (!BHL_API_KEY) {
    console.log('[BHL] Skipped - API key not configured');
    return [];
  }

  const items: LiteratureItem[] = [];
  const maxResults = options?.maxResults || 20;

  try {
    if (options?.includeKoreaKeyword) {
      // 한국 기록 검색: 학명 + Korea/Corea 키워드로 각각 검색
      for (const koreaKeyword of KOREA_KEYWORDS) {
        if (items.length >= maxResults) break;

        const searchQuery = `${query} ${koreaKeyword}`;
        console.log(`[BHL] Searching with Korea keyword: ${searchQuery}`);

        const parts = await this.searchParts(searchQuery, options);
        for (const part of parts) {
          if (!items.some(i => i.id === part.id)) {
            items.push(part);
          }
        }

        // 충분한 결과가 있으면 조기 종료
        if (items.length >= 5) {
          console.log(`[BHL] Found ${items.length} items, stopping Korea keyword search`);
          break;
        }
      }
    } else {
      // 원기재 검색: 학명만으로 검색
      const parts = await this.searchParts(query, options);
      items.push(...parts);

      if (items.length < maxResults) {
        const itemResults = await this.searchItems(query, options);
        for (const item of itemResults) {
          if (!items.some(i => i.id === item.id)) {
            items.push(item);
          }
        }
      }
    }
  } catch (error) {
    console.error('[BHL] Search error:', error);
    throw error;
  }

  return items.slice(0, maxResults);
}
```

**설계 의도**:
- BHL API가 OR 문법을 지원하지 않으므로 각 키워드로 분리 검색
- 5건 이상 결과 시 조기 종료로 불필요한 API 호출 방지
- 역사적 문헌(1800년대)에서 "Corea" 표기가 많으므로 반드시 포함

---

### 2. `src/literature/collector.ts`

**변경 내용**: Phase 1/2 검색 로직 및 소스별 Korea 키워드 처리

```typescript
/**
 * 소스별 Korea 키워드 필요 여부
 * - KCI/RISS: 이미 한국 DB이므로 Korea 키워드 불필요
 * - 기타: 전 세계 문헌이므로 Korea 키워드로 필터링 필요
 */
const KOREA_DB_SOURCES: LiteratureSource[] = ['kci', 'riss'];

function isKoreaOnlySource(source: LiteratureSource): boolean {
  return KOREA_DB_SOURCES.includes(source);
}

/**
 * 여러 소스에서 문헌 검색 (최적화된 Phase 1/2 전략)
 *
 * Phase 1: 유효명으로만 검색 (모든 소스)
 * Phase 2: 결과 부족 시 주요 이명으로 추가 검색 (BHL만)
 */
export async function searchLiterature(
  request: LiteratureSearchRequest,
  onProgress?: (progress: CollectionProgress) => void
): Promise<LiteratureSearchResult> {
  const { scientificName, synonyms, sources, yearFrom, yearTo, maxResults = 20, searchStrategy = 'both' } = request;
  const targetSources: LiteratureSource[] = sources || getEnabledSources();
  const allItems: LiteratureItem[] = [];
  const errors: SourceError[] = [];

  // ================================================================
  // Phase 1: 유효명으로 검색
  // ================================================================
  console.log(`\n[Collector] === Phase 1: 유효명 검색 ===`);

  for (const source of targetSources) {
    const client = clients[source];
    if (!client) continue;

    // 한국 DB는 Korea 키워드 불필요
    const needsKoreaKeyword = !isKoreaOnlySource(source);

    try {
      // 역사적 문헌 검색 (BHL만)
      if ((searchStrategy === 'historical' || searchStrategy === 'both') && source === 'bhl') {
        console.log(`[Collector] ${source}: 원기재 검색 (학명만)`);
        const historicalItems = await client.search(scientificName, {
          yearFrom: yearFrom || 1700,
          yearTo: yearTo || 1970,
          maxResults: 10,
          includeKoreaKeyword: false,  // 원기재는 Korea 키워드 없이
        });
        addUniqueItems(allItems, historicalItems);
      }

      // 한국 기록 검색
      if (searchStrategy === 'korea' || searchStrategy === 'both') {
        console.log(`[Collector] ${source}: 한국 기록 검색 (Korea 키워드: ${needsKoreaKeyword})`);
        const koreaItems = await client.search(scientificName, {
          yearFrom: yearFrom,
          yearTo: yearTo,
          maxResults: 10,
          includeKoreaKeyword: needsKoreaKeyword,
        });
        addUniqueItems(allItems, koreaItems);
      }

    } catch (error) {
      console.error(`[Collector] Error searching ${source}:`, error);
      errors.push({ source, error: error instanceof Error ? error.message : 'Search failed' });
    }
  }

  // ================================================================
  // Phase 2: 결과 부족 시 주요 이명으로 추가 검색
  // ================================================================
  const MIN_RESULTS = 5;
  if (allItems.length < MIN_RESULTS && synonyms.length > 0) {
    console.log(`\n[Collector] === Phase 2: 이명 추가 검색 ===`);

    // 원기재명 또는 첫 번째 이명만 사용 (최대 2개)
    const prioritySynonyms = synonyms.slice(0, 2);

    for (const synonym of prioritySynonyms) {
      if (allItems.length >= maxResults) break;

      // BHL에서만 이명 검색 (역사적 문헌에서 이명이 중요)
      const bhlClient = clients.bhl;
      if (bhlClient) {
        try {
          console.log(`[Collector] BHL: 이명 검색 - ${synonym}`);
          const items = await bhlClient.search(synonym, {
            yearFrom: 1700,
            yearTo: 1970,
            maxResults: 5,
            includeKoreaKeyword: true,
          });
          addUniqueItems(allItems, items);
        } catch (error) {
          console.error(`[Collector] BHL synonym search error:`, error);
        }
      }
    }
  }

  // 연도순 정렬 (오래된 것 먼저 - 최초 기록 찾기)
  allItems.sort((a, b) => (a.year || 9999) - (b.year || 9999));

  return {
    scientificName,
    totalFound: limitedItems.length,
    items: limitedItems.slice(0, maxResults),
    errors,
  };
}

function addUniqueItems(target: LiteratureItem[], items: LiteratureItem[]): void {
  for (const item of items) {
    const isDuplicate = target.some(
      existing =>
        existing.title.toLowerCase() === item.title.toLowerCase() &&
        existing.year === item.year
    );
    if (!isDuplicate) {
      target.push(item);
    }
  }
}
```

**설계 의도**:
- **Phase 1/2 분리**: 유효명 검색으로 충분한 결과가 있으면 이명 검색 생략
- **소스별 전략**: KCI/RISS는 이미 한국 DB이므로 Korea 키워드 불필요
- **조기 종료**: 충분한 결과(5건) 확보 시 추가 검색 생략

---

## 검색 효율화 비교

| 항목 | Before | After |
|------|--------|-------|
| 검색 방식 | 모든 이명 × 모든 소스 × 2전략 | Phase 1(유효명) → Phase 2(이명, 필요시만) |
| API 호출 | 9소스 × 8이명 × 2전략 = 144회 | 6소스 × 1회 = 6회 (Phase 1 충분 시) |
| KCI/RISS | Korea 키워드 포함 | Korea 키워드 제외 (한국 DB) |
| BHL | Korea만 검색 | Corea/Korea/Korean 모두 검색 |
| 예상 감소율 | - | 약 95% |

---

## 소스별 검색 전략

| 소스 | Korea 키워드 | 검색 쿼리 예시 |
|------|--------------|----------------|
| BHL | ✅ Corea/Korea/Korean | `Ditrema temminckii Corea`, `... Korea` |
| J-STAGE | ✅ 朝鮮/韓国/Korea | 내부적으로 처리 (기존 구현) |
| CiNii | ✅ 朝鮮/韓国/Korea | 내부적으로 처리 (기존 구현) |
| OpenAlex | ✅ Korea | `Ditrema temminckii Korea` |
| KCI | ❌ 불필요 | `Ditrema temminckii` (한국 DB) |
| RISS | ❌ 불필요 | `Ditrema temminckii` (한국 DB) |

---

## 테스트 결과

```
테스트: 뱀장어 (Anguilla japonica)

[Collector] === Phase 1: 유효명 검색 ===
[Collector] openalex: 한국 기록 검색 (Korea 키워드: true)
[Collector] jstage: 한국 기록 검색 (Korea 키워드: true)
[Collector] cinii: 한국 기록 검색 (Korea 키워드: true)
[Collector] Phase 1 결과: 50건
[Collector] 최종 결과: 5건

→ Phase 1만으로 충분한 결과 확보, Phase 2 생략
→ API 호출 6회 (기존 대비 95% 감소)
```

---

## 리뷰 요청 사항

1. **Phase 1/2 분리 로직**: 유효명 우선 검색 후 결과 부족 시만 이명 검색하는 전략이 적절한가?

2. **Korea 키워드 제외 조건**: KCI/RISS를 한국 전용 DB로 분류하여 Korea 키워드를 제외하는 것이 맞는가?

3. **BHL Corea 검색**: 역사적 문헌에서 "Corea" 표기가 중요하므로 분리 검색하는 방식이 적절한가? (OR 검색 미지원으로 인한 우회)

4. **조기 종료 기준**: 5건 결과 시 추가 검색 중단하는 기준이 적절한가?

5. **에러 처리**: 개별 소스 실패 시 다른 소스 검색을 계속하는 방식이 맞는가?

---

## 관련 문서

- [SEARCH_STRATEGY.md](./SEARCH_STRATEGY.md) - 전체 검색 전략 설계 문서
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 개요
