# 세션 작업 요약 (2026-01-16)

## 1. 사용자 질문과 답변

### Q1: BHL API 키가 있는데 왜 작동 안 하나요?
**원인**: dotenv 로딩 순서 문제
- `BHL_API_KEY`가 모듈 로드 시점에 한 번만 읽혀서, dotenv보다 먼저 로드되면 빈 값이 됨

**해결**: `getBhlApiKey()` getter 함수로 변경
```typescript
// 변경 전
const BHL_API_KEY = process.env.BHL_API_KEY || '';

// 변경 후
function getBhlApiKey(): string {
  return process.env.BHL_API_KEY || '';
}
```

### Q2: 검색 20건, 분석 3건의 의미?
- **검색 20건**: 여러 DB에서 총 37~60건 → `maxResults: 20`으로 제한
- **분석 3건**: 배치 크기 3개씩 분석, 한국 기록 발견 시 **배치 완료 후 조기 종료**
  - 한국 기록 없으면 → 다음 배치로 이동 (정상 동작)
  - 한국 기록 발견 → 현재 배치 완료 후 종료

### Q3: 결과는 엑셀? TXT?
**엑셀 파일** (.xlsx)로 저장됨
- 저장 위치: `data/reports/`
- 개별 종: `분석결과_종명_날짜.xlsx`
- 통합: `통합분석결과_날짜.xlsx`

### Q4: 프롬프트/LLM 응답 확인 가능한가요?
**가능** - 새로운 "LLM분석상세" 시트 추가됨

엑셀 시트 구조:
1. **요약** - 전체 분석 요약
2. **분석결과** - 문헌별 분석 결과
3. **수동확인필요** - PDF 없이 분석된 항목
4. **최초기록** - 발견된 경우
5. **LLM분석상세** (신규) - 프롬프트, 입력텍스트, LLM 응답

### Q5: 누가 분석했나요? (Claude vs 다른 모델)
**OpenRouter를 통해 Mistral Devstral 모델**이 분석
- 모델: `mistralai/devstral-2512:free`
- Claude는 코드 작성 및 실행만 담당

---

## 2. 수정된 파일 목록

### 핵심 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/literature/bhl-client.ts` | API 키 getter 추가, PublicationSearch 폴백 로직 |
| `src/llm/types.ts` | `debug` 필드 추가 (입력텍스트, 응답, 프롬프트) |
| `src/llm/client.ts` | `analyzeLiterature()`에서 debug 정보 반환 |
| `src/literature/types.ts` | `llmDebug` 필드 추가 |
| `src/analysis/pipeline.ts` | llmDebug 매핑, 타입 수정 |
| `src/output/analysis-report.ts` | "LLM분석상세" 시트 생성 함수 추가 |

---

## 3. 타입 구조 변경

### LiteratureAnalysisResult (src/llm/types.ts)
```typescript
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
  // 신규 추가
  debug?: {
    inputTextPreview: string;   // 입력 텍스트 앞부분 (500자)
    inputTextLength: number;    // 전체 길이
    rawResponse: string;        // LLM 원본 응답 (2000자)
    promptUsed: string;         // 프롬프트 (1000자)
  };
}
```

### LiteratureAnalysis (src/literature/types.ts)
```typescript
interface LiteratureAnalysis {
  // 기존 필드...
  analysisSource: 'pdf_fulltext' | 'abstract_only' | 'metadata_only';
  needsManualReview?: boolean;
  // 신규 추가
  llmDebug?: {
    inputText: string;
    inputLength: number;
    rawResponse?: string;
    promptUsed?: string;
  };
}
```

---

## 4. BHL API 문제 및 해결

### 문제
- `PartSearch` API가 빈 응답(length=0) 반환
- `PublicationSearch`는 정상 작동

### 해결
```typescript
// searchParts() 함수에 폴백 로직 추가
private async searchParts(query, options) {
  const text = await response.text();

  if (!text || text.length === 0) {
    console.warn('[BHL] PartSearch empty, falling back to PublicationSearch');
    return this.searchPublications(query, options);  // 폴백
  }
  // ...
}
```

---

## 5. 엑셀 "LLM분석상세" 시트 컬럼

| 컬럼 | 설명 |
|------|------|
| 순번 | 분석 순서 |
| 연도 | 문헌 연도 |
| 제목 | 문헌 제목 (50자) |
| 분석방식 | PDF전문/초록만/메타데이터만 |
| 한국기록 | 있음/없음/불확실 |
| 신뢰도 | 0-100% |
| 사용모델 | openrouter/mistralai/devstral-2512:free |
| 입력텍스트길이 | 전체 글자 수 |
| 입력텍스트(앞부분) | 300자 미리보기 |
| LLM응답(원본) | 500자 미리보기 |
| 프롬프트(앞부분) | 300자 미리보기 |

---

## 6. 테스트 명령어

```bash
# 타입 체크 (에러 없음 확인됨)
npm run type-check

# BHL API 테스트 (정상 작동 확인됨)
npx tsx scripts/test-bhl-quick.ts

# 10종 배치 테스트 (미실행)
npx tsx scripts/test-batch-species.ts
```

---

## 7. 이전 테스트 결과 (10종)

| 종명 | 검색 | 분석 | 한국기록 | 최초연도 |
|------|------|------|----------|----------|
| 망상어 | 20 | 3 | ✅ | 2006 |
| 뱀장어 | 20 | 6 | ❌ | - |
| 참돔 | 20 | 6 | ❌ | - |
| 조피볼락 | 20 | 3 | ✅ | 2006 |
| 넙치 | 20 | 6 | ❌ | - |
| **자주복** | **20** | **3** | **✅** | **1929** |
| 숭어 | 20 | 6 | ❌ | - |
| 농어 | 20 | 6 | ❌ | - |
| 고등어 | 20 | 6 | ❌ | - |
| 멸치 | 20 | 6 | ❌ | - |

**특이사항**: 자주복(1929년, 부산시장 채집) 기록 발견

---

## 8. 추가 개선 사항 (2026-01-16 후반)

### ScienceON 클라이언트 추가
- 새 파일: `src/literature/scienceon-client.ts`
- KISTI 과학기술 지식인프라 API 연동
- 환경변수: `SCIENCEON_CLIENT_ID`, `SCIENCEON_API_KEY`

### GBIF/OBIS 보조 자료로 분류
- 기본 설정에서 **비활성화** (`enabled: false`)
- 표본/분포 데이터는 "최초기록 문헌" 판정에 부적합
- 필요시 수동으로 활성화하여 참고용으로 사용

### 문헌 소스 분류 체계 정리

| 분류 | 소스 | 용도 |
|------|------|------|
| **역사적 문헌** | BHL, J-STAGE, CiNii | 1800년대~ 최초기록 |
| **한국 논문** | KCI, RISS, ScienceON | 최근 신규 기록 |
| **영문 논문** | OpenAlex, Semantic Scholar | 현대 논문 |
| **참고용** | GBIF, OBIS | 표본 데이터 (기본 비활성화) |

---

## 9. 사용 가이드

상세 사용법은 [USAGE_GUIDE.md](./USAGE_GUIDE.md) 참조

### 빠른 시작

```bash
# 1. 환경변수 설정
cp .env.example .env.local
# .env.local 편집하여 API 키 입력

# 2. 타입 체크
npm run type-check

# 3. 10종 배치 테스트
npx tsx scripts/test-batch-species.ts

# 4. 결과 확인
# data/reports/ 폴더의 엑셀 파일 확인
```

---

## 10. 향후 확장 계획

| 기능 | 용도 | 우선순위 |
|------|------|----------|
| NTIS | 국가R&D 연구과제/동향 파악 | 중간 |
| OpenAIRE | EU 오픈액세스 논문 | 낮음 |
