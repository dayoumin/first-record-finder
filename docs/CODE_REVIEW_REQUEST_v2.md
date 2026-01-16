# 코드 리뷰 요청: 문헌 분석 파이프라인 v2

## 변경 목적

한국 해양생물 최초 기록 문헌을 찾기 위한 분석 파이프라인 구현. 검색 결과를 연도순으로 정렬하고, 배치별로 순차 분석하여 최초 한국 기록을 찾는다.

---

## 아키텍처 개요

```
[검색] searchLiterature()
    │
    ▼
[정렬] 연도순 (오래된 것 먼저)
    │
    ▼
[배치 분석] runAnalysisPipeline()
    │
    ├─ 배치 1 (1~3건)
    │   ├─ PDF 다운로드
    │   ├─ 텍스트 추출 (Docling)
    │   ├─ LLM 분석
    │   └─ 한국 기록 발견? → 배치 완료 후 종료
    │
    ├─ 배치 2 (4~6건) ← 한국 기록 없으면 계속
    │   └─ ...
    │
    └─ 최대 5배치 (15건)까지
    │
    ▼
[결과 저장] 엑셀 + JSON
```

---

## 주요 변경 파일

### 1. `src/analysis/pipeline.ts`

**핵심 로직**: 배치별 순차 분석

```typescript
/** 파이프라인 옵션 */
export interface PipelineOptions {
  batchSize?: number;         // 한 번에 분석할 문헌 수 (기본: 3)
  maxBatches?: number;        // 최대 배치 수 (기본: 5, 총 15건)
  llmConfig?: LLMConfig;      // LLM 설정
  stopOnFirstRecord?: boolean; // 첫 한국 기록 발견 시 중단 (기본: true)
}

export async function runAnalysisPipeline(
  searchResult: LiteratureSearchResult,
  options?: PipelineOptions
): Promise<PipelineResult> {
  // ...

  // 배치별 순차 분석
  for (let batch = 0; batch < opts.maxBatches; batch++) {
    const startIdx = batch * opts.batchSize;
    const endIdx = Math.min(startIdx + opts.batchSize, searchResult.items.length);

    if (startIdx >= searchResult.items.length) break;

    const batchItems = searchResult.items.slice(startIdx, endIdx);
    const itemsWithPdf = await downloadPdfs(batchItems);

    // 각 문헌 분석
    for (const item of itemsWithPdf) {
      const analysisResult = await analyzeItem(item, ...);

      // 한국 기록 발견 시 더 오래된 기록이면 교체
      if (analysisResult.analysis?.hasKoreaRecord === true) {
        if (!firstKoreaRecord || (item.year < firstKoreaRecord.year)) {
          firstKoreaRecord = analyzedItem;
        }
      }

      analyzedItems.push(analyzedItem);
    }

    // 배치 완료 후 조기 종료 판단
    if (opts.stopOnFirstRecord && firstKoreaRecord) {
      stoppedEarly = true;
      break;
    }
  }
}
```

**설계 의도**:
- 배치 내 모든 문헌을 분석한 후 종료 (같은 배치 내 더 오래된 기록 놓치지 않음)
- 더 오래된 한국 기록 발견 시 `firstKoreaRecord` 교체

---

### 2. `src/analysis/pipeline.ts` - 분석 소스 구분

```typescript
// 분석 소스 타입
export type AnalysisSource = 'pdf_fulltext' | 'abstract_only' | 'metadata_only';

async function analyzeItem(item, ...): Promise<...> {
  let textToAnalyze: string;
  let analysisSource: AnalysisSource = 'metadata_only';

  // 1. PDF 전문 시도
  if (item.pdfPath && fs.existsSync(item.pdfPath)) {
    const doclingResult = await doclingClient.processFile(item.pdfPath);
    if (doclingResult.text.length > 100) {
      textToAnalyze = doclingResult.text;
      analysisSource = 'pdf_fulltext';
    }
  }

  // 2. PDF 없거나 추출 실패 → 초록 사용
  if (!textToAnalyze || textToAnalyze.length < 100) {
    if (item.snippet && item.snippet.length > 50) {
      textToAnalyze = buildAbstractText(item);
      analysisSource = 'abstract_only';
    } else {
      textToAnalyze = buildMetadataText(item);
      analysisSource = 'metadata_only';
    }
  }

  // 3. LLM 분석
  const llmResult = await llmClient.analyzeLiterature({ text: textToAnalyze, ... });

  // 4. 수동 확인 필요 여부 결정
  const needsManualReview = shouldNeedManualReview(analysisSource, llmResult);

  return { analysis: { ...llmResult, analysisSource, needsManualReview } };
}

function shouldNeedManualReview(source: AnalysisSource, result): boolean {
  // PDF 전문이 아닌 경우 수동 확인 권장
  if (source !== 'pdf_fulltext') {
    if (result.hasKoreaRecord === true || result.hasKoreaRecord === null) {
      return true;
    }
    if (result.confidence < 0.7) {
      return true;
    }
  }
  return false;
}
```

**설계 의도**:
- PDF 전문 분석 → 신뢰도 높음
- 초록만 분석 → 한국 기록 발견 시 수동 확인 필요
- 메타데이터만 → 대부분 수동 확인 필요

---

### 3. `src/output/analysis-report.ts`

**엑셀 리포트 구조**:

```typescript
export function saveAnalysisReport(result: PipelineResult): string {
  const workbook = XLSX.utils.book_new();

  // 1. 요약 시트
  const summarySheet = createSummarySheet(result);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '요약');

  // 2. 분석 결과 시트
  const analysisSheet = createAnalysisSheet(result.analyzedItems);
  XLSX.utils.book_append_sheet(workbook, analysisSheet, '분석결과');

  // 3. 수동 확인 필요 시트 (있는 경우)
  if (result.itemsNeedingManualReview.length > 0) {
    const manualReviewSheet = createManualReviewSheet(result.itemsNeedingManualReview);
    XLSX.utils.book_append_sheet(workbook, manualReviewSheet, '수동확인필요');
  }

  // 4. 최초 기록 시트 (발견된 경우)
  if (result.firstKoreaRecord) {
    const firstRecordSheet = createFirstRecordSheet(result.firstKoreaRecord);
    XLSX.utils.book_append_sheet(workbook, firstRecordSheet, '최초기록');
  }

  XLSX.writeFile(workbook, filePath);
  return filePath;
}
```

**엑셀 시트 구조**:

| 시트명 | 내용 |
|--------|------|
| 요약 | 분석 대상, 결과 통계, 최초 기록 요약 |
| 분석결과 | 모든 분석 문헌 목록 (연도, 제목, 한국기록, 분석방식 등) |
| 수동확인필요 | PDF 전문 아닌 경우 확인 필요 목록 |
| 최초기록 | 발견된 최초 기록 상세 정보 |

---

### 4. `src/literature/collector.ts` - 검색 전략 (이전 리뷰 반영)

```typescript
// 역사적 문헌 검색 소스
const HISTORICAL_SOURCES: LiteratureSource[] = ['bhl', 'jstage', 'cinii'];

// Phase 1: 유효명 검색
for (const source of targetSources) {
  // 역사적 문헌 검색 (BHL, J-STAGE, CiNii)
  if ((searchStrategy === 'historical' || searchStrategy === 'both')
      && HISTORICAL_SOURCES.includes(source)) {
    const historicalItems = await client.search(scientificName, {
      yearFrom: source === 'bhl' ? 1700 : 1900,
      yearTo: 1970,
      includeKoreaKeyword: false,  // 원기재는 Korea 없이
    });
  }

  // 한국 기록 검색
  if (searchStrategy === 'korea' || searchStrategy === 'both') {
    const koreaItems = await client.search(scientificName, {
      includeKoreaKeyword: !isKoreaOnlySource(source),  // KCI/RISS는 불필요
    });
  }
}

// Phase 2: 이명 검색 (결과 부족 시)
if (allItems.length < MIN_RESULTS && synonyms.length > 0) {
  for (const synonym of prioritySynonyms) {
    // 1. 원기재 검색 (Korea 없이)
    const originalItems = await bhlClient.search(synonym, {
      includeKoreaKeyword: false,
    });

    // 2. 한국 기록 검색 (결과 부족 시)
    if (allItems.length < MIN_RESULTS) {
      const koreaItems = await bhlClient.search(synonym, {
        includeKoreaKeyword: true,
      });
    }
  }
}
```

---

## 리뷰 요청 사항

### 1. 배치 분석 로직

- 배치 내 모든 문헌을 분석한 후 조기 종료하는 것이 적절한가?
- 더 오래된 기록 발견 시 `firstKoreaRecord`를 교체하는 로직이 맞는가?
- `stopOnFirstRecord` 옵션의 기본값이 `true`인 것이 적절한가?

### 2. 분석 소스 구분

- PDF 전문 / 초록만 / 메타데이터만으로 구분하는 것이 적절한가?
- 수동 확인 필요 조건 (초록+한국기록 또는 신뢰도<70%)이 합리적인가?
- 초록만으로 한국 기록 판단 후 수동 확인으로 넘기는 것이 맞는가?

### 3. 엑셀 리포트 구조

- 시트 구성 (요약/분석결과/수동확인필요/최초기록)이 적절한가?
- 여러 종 통합 리포트에서 종별 시트를 만드는 것이 적절한가?
- 추가로 필요한 필드나 시트가 있는가?

### 4. 에러 처리 및 복원력

- Docling 실패 시 초록으로 fallback하는 것이 적절한가?
- LLM 분석 실패 시 해당 문헌을 건너뛰고 계속하는 것이 맞는가?
- PDF 다운로드 실패 시 처리가 적절한가?

### 5. 잠재적 문제점

- 배치 크기(3)와 최대 배치 수(5)의 기본값이 적절한가?
- 텍스트 길이 100자 미만을 "추출 실패"로 판단하는 기준이 맞는가?
- 신뢰도 70% 기준이 적절한가?

---

## 파일 구조

```
src/
├── analysis/
│   ├── pipeline.ts      # 분석 파이프라인 (배치별 순차 분석)
│   └── index.ts
├── literature/
│   ├── collector.ts     # 검색 (Phase 1/2 전략)
│   ├── bhl-client.ts    # BHL (Corea/Korea 키워드)
│   ├── types.ts         # AnalysisSource 타입 추가
│   └── ...
├── output/
│   ├── analysis-report.ts  # 엑셀/JSON 저장
│   └── ...
└── llm/
    ├── client.ts        # LLM 클라이언트
    └── types.ts         # 프롬프트 템플릿
```

---

## 테스트 방법

```bash
# 전체 파이프라인 테스트
npx tsx scripts/test-full-pipeline.ts

# PDF 있는 문헌만 테스트
npx tsx scripts/test-pipeline-with-pdf.ts

# 검색 결과 수 테스트
npx tsx scripts/test-search-volume.ts
```

---

## 관련 문서

- [SEARCH_STRATEGY.md](./SEARCH_STRATEGY.md) - 검색 전략 설계
- [CODE_REVIEW_REQUEST.md](./CODE_REVIEW_REQUEST.md) - 이전 리뷰 요청 (검색 최적화)
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 개요
