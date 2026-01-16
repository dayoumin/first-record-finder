# First Record Finder - 인수인계 문서

## 프로젝트 개요

한국 해양생물 최초기록 문헌 검색 시스템. 학명 입력 → WoRMS에서 이명 추출 → 여러 학술 DB에서 문헌 수집 → LLM 분석 → 최초 한국 기록 찾기.

## 현재 작업 상태

### 완료된 작업

1. **BHL API 수정** - `src/literature/bhl-client.ts`
   - `PartSearch` API가 빈 응답 반환 문제 → `PublicationSearch`로 폴백 로직 추가
   - API 키를 함수 호출 시점에 읽도록 `getBhlApiKey()` getter 추가 (dotenv 로딩 순서 문제 해결)

2. **LLM 디버그 정보 추가**
   - `src/llm/types.ts`: `LiteratureAnalysisResult`에 `debug` 필드 추가
   - `src/llm/client.ts`: `analyzeLiterature()`에서 디버그 정보 반환
   - `src/literature/types.ts`: `LiteratureAnalysis`에 `llmDebug` 필드 추가
   - `src/analysis/pipeline.ts`: 파이프라인에서 llmDebug 정보 매핑
   - `src/output/analysis-report.ts`: 엑셀에 "LLM분석상세" 시트 추가

### 핵심 타입 구조

```typescript
// src/llm/types.ts - LLM 분석 결과
interface LiteratureAnalysisResult {
  hasKoreaRecord: boolean | null;
  confidence: number;
  locality?: string;
  collectionDate?: string;
  specimenInfo?: string;
  collector?: string;
  relevantQuotes: string[];
  reasoning: string;
  processedAt: Date;
  modelUsed: string;
  tokensUsed?: number;
  debug?: {
    inputTextPreview: string;   // 입력 텍스트 앞부분 (최대 500자)
    inputTextLength: number;    // 전체 입력 텍스트 길이
    rawResponse: string;        // LLM의 원본 응답
    promptUsed: string;         // 실제 사용된 프롬프트
  };
}

// src/literature/types.ts - 문헌 분석 결과
interface LiteratureAnalysis {
  hasKoreaRecord: boolean | null;
  confidence: number;
  locality?: string;
  collectionDate?: string;
  specimenInfo?: string;
  relevantQuotes: string[];
  reasoning: string;
  analyzedAt: Date;
  modelUsed: string;
  analysisSource: 'pdf_fulltext' | 'abstract_only' | 'metadata_only';
  needsManualReview?: boolean;
  llmDebug?: {
    inputText: string;
    inputLength: number;
    rawResponse?: string;
    promptUsed?: string;
  };
}

// src/analysis/pipeline.ts - 분석된 문헌
interface AnalyzedLiterature extends LiteratureItem {
  analysis?: LiteratureAnalysis;
  extractedText?: string;
  analysisError?: string;
}
```

### 파일 구조

```
src/
├── llm/
│   ├── types.ts          # LLM 타입 (LiteratureAnalysisResult, debug 포함)
│   ├── client.ts         # LLM 클라이언트 (analyzeLiterature에서 debug 반환)
│   └── rate-limiter.ts   # OpenRouter Rate Limit 관리
├── literature/
│   ├── types.ts          # 문헌 타입 (LiteratureAnalysis, llmDebug 포함)
│   ├── bhl-client.ts     # BHL API (PublicationSearch 폴백 추가됨)
│   ├── collector.ts      # 통합 수집기
│   └── ...               # 기타 클라이언트
├── analysis/
│   └── pipeline.ts       # 분석 파이프라인 (llmDebug 매핑)
├── output/
│   └── analysis-report.ts # 엑셀 리포트 (LLM분석상세 시트 추가)
└── pdf/
    └── docling-client.ts # PDF 텍스트 추출
```

## 주요 변경사항 상세

### 1. BHL 클라이언트 (`src/literature/bhl-client.ts`)

```typescript
// 변경 전: 모듈 로드 시 API 키 읽음 (dotenv보다 먼저 로드되면 빈값)
const BHL_API_KEY = process.env.BHL_API_KEY || '';

// 변경 후: 함수 호출 시점에 읽음
function getBhlApiKey(): string {
  return process.env.BHL_API_KEY || '';
}

// searchParts()에 폴백 로직 추가
private async searchParts(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
  // ... PartSearch 시도
  if (!text || text.length === 0) {
    console.warn('[BHL] PartSearch returned empty response, falling back to PublicationSearch');
    return this.searchPublications(query, options);  // 새로 추가된 메서드
  }
  // ...
}
```

### 2. LLM 클라이언트 (`src/llm/client.ts`)

```typescript
async analyzeLiterature(request: AnalysisRequest): Promise<LiteratureAnalysisResult> {
  const prompt = this.buildAnalysisPrompt(request);
  const response = await this.generate(prompt);
  const parsed = this.parseAnalysisResponse(response);

  return {
    // ... 기존 필드
    debug: {
      inputTextPreview: request.text.slice(0, 500),
      inputTextLength: request.text.length,
      rawResponse: response.slice(0, 2000),
      promptUsed: prompt.slice(0, 1000),
    },
  };
}
```

### 3. 파이프라인 (`src/analysis/pipeline.ts`)

```typescript
// analyzeItem() 함수 내 반환 부분
return {
  analysis: {
    hasKoreaRecord: llmResult.hasKoreaRecord,
    // ... 기타 필드
    llmDebug: llmResult.debug ? {
      inputText: llmResult.debug.inputTextPreview,
      inputLength: llmResult.debug.inputTextLength,
      rawResponse: llmResult.debug.rawResponse,
      promptUsed: llmResult.debug.promptUsed,
    } : undefined,
  },
  extractedText: textToAnalyze,
};
```

### 4. 엑셀 리포트 (`src/output/analysis-report.ts`)

```typescript
// saveAnalysisReport() 함수에 추가
const itemsWithDebug = result.analyzedItems.filter(item => item.analysis?.llmDebug);
if (itemsWithDebug.length > 0) {
  const debugSheet = createLLMDebugSheet(itemsWithDebug);
  XLSX.utils.book_append_sheet(workbook, debugSheet, 'LLM분석상세');
}

// 새 함수 추가
function createLLMDebugSheet(items: AnalyzedLiterature[]): XLSX.WorkSheet {
  // 순번, 연도, 제목, 분석방식, 한국기록, 신뢰도, 사용모델,
  // 입력텍스트길이, 입력텍스트(앞부분), LLM응답(원본), 프롬프트(앞부분)
}
```

## 테스트 방법

```bash
# 타입 체크
npm run type-check

# BHL API 테스트
npx tsx scripts/test-bhl-quick.ts

# 10종 배치 테스트
npx tsx scripts/test-batch-species.ts
```

## 환경 변수 (.env.local)

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=mistralai/devstral-2512:free
BHL_API_KEY=57b93b0a-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 알려진 문제

1. **BHL PartSearch API**: 현재 빈 응답 반환 → PublicationSearch로 폴백 처리됨
2. **OBIS API**: taxon 검색 시 404 에러 발생하는 종 있음 (workaround 있음)
3. **PDF 다운로드**: 일부 소스에서 PDF URL이 없거나 접근 불가

## 다음 작업 제안

1. 실제 10종 배치 테스트 실행하여 엑셀 파일 생성 확인
2. LLM분석상세 시트에 데이터가 제대로 들어가는지 검증
3. 에러 발생 시 구체적인 에러 메시지 확인 필요

## 명령어 요약

```bash
# 개발 서버
npm run dev

# 타입 체크
npm run type-check

# 테스트 스크립트
npx tsx scripts/test-bhl-quick.ts      # BHL API 테스트
npx tsx scripts/test-batch-species.ts  # 10종 배치 테스트
```
