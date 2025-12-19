# First Record Finder

한국 수산생물 최초기록 문헌 검색 시스템

## 프로젝트 개요

해양생물의 학명을 입력하면 WoRMS(World Register of Marine Species)에서 해당 종의 모든 이명(synonym)을 추출하고, 각 이명으로 한국 최초 서식 기록 문헌을 검색할 수 있도록 돕는 시스템.

### 핵심 워크플로우

```
[1단계: 학명 입력]
  │  엑셀 업로드 또는 직접 입력
  ▼
[2단계: 이명 조사]
  │  WoRMS API로 동의어 추출
  │  산출물: synonyms.xlsx
  ▼
[3단계: 검색 URL 생성]
  │  Scholar/KCI 링크 생성
  │  산출물: search_urls.xlsx
  ▼
[4단계: 문헌 수집]
  │  PDF 다운로드 (수동/자동)
  │  산출물: data/pdfs/
  ▼
[5단계: 문헌 분석]
  │  Docling으로 PDF 텍스트 추출 (OCR 포함)
  │  Ollama로 한국 기록 여부 판정
  │  산출물: literature.xlsx
  ▼
[6단계: 문헌 검토]
  │  사용자 확인 및 수정
  │  Evidence 정보 입력
  ▼
[7단계: 최초 기록 판정]
  │  연도순 정렬 → 최초 한국 기록 확정
  │  산출물: first_records.xlsx
  ▼
[8단계: 결과 정리]
     최종 엑셀 다운로드
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **UI**: React 18, 순수 CSS
- **엑셀 처리**: xlsx (SheetJS)
- **외부 API**: WoRMS REST API
- **스크래핑**: Puppeteer (추후 자동화용)
- **PDF 처리**: Docling (표/레이아웃 인식, OCR 포함)
- **LLM**: 다중 제공자 지원
  - Ollama (로컬 LLM - 무료, 오프라인)
  - Grok API (xAI - 빠름, 저렴)
  - OpenAI API (GPT-4 - 정확도 높음)
  - Anthropic API (Claude - 긴 문맥 지원)

## 프로젝트 구조

```
src/
├── types/index.ts        # 전체 타입 정의
├── worms/                # WoRMS API 연동
│   ├── index.ts          # 모듈 export
│   └── synonym-extractor.ts  # 이명 추출 로직
├── search/               # 문헌 검색 엔진
│   ├── index.ts          # 모듈 export
│   └── search-engine.ts  # 검색 로직, URL 생성
├── output/               # 결과 출력
│   ├── index.ts          # 모듈 export
│   └── excel-exporter.ts # 엑셀 생성
└── utils/
    └── fetchWithRetry.ts # HTTP 유틸리티

app/                      # Next.js App Router
├── page.tsx              # 메인 검색 UI
├── layout.tsx            # 레이아웃
├── globals.css           # 스타일
└── api/
    └── search/route.ts   # 검색 API 엔드포인트

scripts/
├── search.ts             # CLI 검색 스크립트
└── test-worms.ts         # WoRMS API 테스트

data/
├── pdfs/                 # PDF 파일 저장
├── results/              # 검색 결과 JSON
└── exports/              # 엑셀 내보내기
```

## 핵심 타입

### 신뢰도 레벨 (ConfidenceLevel)

- **Level 1 (확정)**: 한국 채집지 + 날짜/표본 정보 있음 → 검색 중단
- **Level 2 (유력)**: 한국 언급 있으나 일부 정보 부족
- **Level 3 (검토 필요)**: 학명 있으나 한국 여부 불명확
- **Level 4 (제외)**: 한국 기록 아님

### 검증 상태 (VerificationStatus)

`confirmed` | `probable` | `needs_review` | `citation_only` | `excluded` | `not_checked`

## 주요 명령어

```bash
# 개발 서버 (포트 3001)
npm run dev

# 빌드
npm run build

# CLI 검색
npm run search -- --name "Sebastes schlegelii"

# WoRMS API 테스트
npm run test:worms

# 타입 체크
npm run type-check
```

## API 엔드포인트

### POST /api/search

학명으로 WoRMS 이명 검색

**요청:**
```json
{ "scientificName": "Sebastes schlegelii" }
```

**응답:**
```json
{
  "success": true,
  "acceptedName": "Sebastes schlegelii",
  "aphiaId": 274766,
  "synonyms": [...],
  "searchUrls": [...]
}
```

## 개발 시 주의사항

1. **WoRMS API 호출 간격**: 200ms 딜레이 필수 (API 부하 방지)
2. **이명 검색**: 유효명(accepted)도 이명 목록에 포함시켜 검색
3. **연도순 정렬**: 최초 기록 판정 시 오래된 것 우선
4. **한국 기록 판별**: 단순 분포 목록이나 인용은 제외

## 현재 구현 상태

### 완료
- [x] WoRMS API 이명 추출
- [x] 웹 UI 기본 구조 (미니멀 디자인)
- [x] 검색 URL 생성 (Google Scholar, KCI)
- [x] 한국 관련 키워드 (Korea, Corea, 한국, 조선, 지역명 등)
- [x] 커스텀 키워드 추가 기능
- [x] 연도 범위 필터링
- [x] 엑셀 파일 업로드 (일괄 처리)
- [x] 엑셀 내보내기 API (/api/export)
- [x] 진행 상황 표시 (퍼센트, 현재 처리 중 학명)
- [x] CLI 검색 스크립트
- [x] 타입 시스템

### 진행 중
- [ ] 워크플로우 단계별 UI
- [ ] 단계별 산출물 (엑셀) 다운로드

### 미구현 (TODO)
- [ ] PDF 업로드 및 Docling 연동
- [ ] Ollama 연동 (문헌 분석)
- [ ] 문헌 검색 자동화 (Puppeteer)
- [ ] 후보 문헌 저장/관리
- [ ] 수동 검토 UI
- [ ] 검색 결과 캐싱
- [ ] 국명(Korean name) DB 연동

## 외부 의존성

- **WoRMS API**: https://www.marinespecies.org/rest/
- **Google Scholar**: 검색 링크 생성 (한국 키워드 포함)
- **KCI**: 한국학술지인용색인 검색 링크
- **Docling**: PDF 텍스트/표 추출 + OCR (https://github.com/DS4SD/docling)
- **Ollama**: 로컬 LLM 서버 (https://ollama.ai)

## 설치 요구사항

### Docling (Python)
```bash
# Python 3.10+ 필요
pip install docling

# 또는 Docker
docker pull ds4sd/docling
```

### Ollama
```bash
# Windows: https://ollama.ai/download 에서 설치

# 모델 다운로드
ollama pull llama3        # 범용 (권장)
ollama pull mistral       # 가벼운 대안

# 실행 확인
ollama list
```

### 환경 변수 (.env.local)
```env
# LLM 제공자 설정 (ollama | grok | openai | anthropic)
LLM_PROVIDER=ollama

# Ollama 설정 (로컬)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama4

# Grok API (xAI) - 2025년 12월 기준
GROK_API_KEY=your-grok-api-key
GROK_MODEL=grok-4.1

# OpenAI API - 2025년 12월 기준
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.2

# Anthropic API - 2025년 12월 기준
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-opus-4.5

# Docling 설정 (Docker 사용 시)
DOCLING_API_URL=http://localhost:5000
```

---

## 개발 계획

### Phase 1: 문헌 검색 자동화

Google Scholar와 KCI에서 자동으로 문헌을 수집하는 기능

#### 1.1 Puppeteer 기반 스크래퍼 구현
- `src/scraper/google-scholar.ts` - Google Scholar 검색 및 결과 파싱
- `src/scraper/kci.ts` - KCI 검색 및 결과 파싱
- `src/scraper/index.ts` - 통합 인터페이스

#### 1.2 검색 결과 데이터 구조
```typescript
interface ScrapedArticle {
  title: string;
  authors: string;
  year: number | null;
  source: string;          // 저널명
  citedBy: number;         // 인용 수
  url: string;             // 원문 링크
  snippet: string;         // 검색 결과 미리보기
  pdfUrl?: string;         // PDF 링크 (있는 경우)
  searchedName: string;    // 검색에 사용된 이명
}
```

#### 1.3 스크래핑 전략
- Rate limiting: 요청 간 2-3초 딜레이
- User-Agent 로테이션
- CAPTCHA 감지 시 수동 검색으로 fallback
- 결과 캐싱 (동일 검색어 재요청 방지)

### Phase 2: 후보 문헌 관리 UI

검색된 문헌을 저장하고 평가하는 인터페이스

#### 2.1 데이터 저장
- `data/candidates/` - 종별 후보 문헌 JSON 저장
- LocalStorage 또는 IndexedDB 활용 (브라우저 측)
- 옵션: SQLite 또는 JSON 파일 기반 서버 측 저장

#### 2.2 UI 컴포넌트
```
app/
├── page.tsx                    # 검색 페이지 (기존)
├── candidates/
│   └── page.tsx               # 후보 문헌 목록
├── species/
│   └── [name]/
│       └── page.tsx           # 종별 상세 페이지
└── components/
    ├── CandidateCard.tsx      # 문헌 카드 컴포넌트
    ├── ConfidenceSelector.tsx # 신뢰도 선택기
    ├── EvidenceForm.tsx       # 근거 입력 폼
    └── SearchProgress.tsx     # 검색 진행 상태
```

#### 2.3 후보 문헌 평가 워크플로우
1. 자동 검색 결과 표시 (연도순 정렬)
2. 각 문헌 클릭 → 상세 정보 및 원문 링크
3. 사용자가 Evidence 정보 입력:
   - 한국 기록 여부 (yes/no/unclear)
   - 페이지 번호
   - 채집지 정보
   - 표본 정보
   - 원문 인용
4. 신뢰도 레벨 자동 계산 또는 수동 지정
5. 최초 기록 후보 확정

#### 2.4 API 엔드포인트
- `POST /api/candidates` - 후보 문헌 저장
- `GET /api/candidates?species=xxx` - 종별 후보 조회
- `PUT /api/candidates/:id` - 후보 평가 업데이트
- `GET /api/species/:name/first-record` - 최초 기록 판정

### Phase 3: PDF 분석 자동화

Docling + Ollama를 활용한 문헌 자동 분석

#### 3.1 Docling 설정

Docling은 PDF에서 텍스트, 표, 이미지를 구조적으로 추출하는 도구로, OCR 기능이 내장되어 있어 스캔된 오래된 문헌도 처리 가능.

```bash
# Python 환경 필요
pip install docling

# 또는 Docker 사용
docker pull ds4sd/docling
```

```typescript
// src/pdf/docling-client.ts
interface DoclingResult {
  text: string;           // 전체 텍스트
  tables: Table[];        // 추출된 표
  figures: Figure[];      // 그림 캡션
  metadata: {
    title?: string;
    authors?: string;
    year?: number;
  };
}
```

#### 3.2 LLM 설정 (다중 제공자 지원)

문헌 분석을 위한 LLM 제공자를 선택할 수 있음. UI에서 설정 가능.

| 제공자 | 장점 | 단점 | 비용 |
|--------|------|------|------|
| **Ollama** | 무료, 오프라인, 프라이버시 | GPU 필요, 느림 | 무료 |
| **Grok** | 빠름, 저렴, 긴 컨텍스트 | API 키 필요 | $5/1M tokens |
| **OpenAI** | 정확도 높음, 안정적 | 비용 높음 | $30/1M tokens |
| **Anthropic** | 긴 문맥(200K), 정확 | 비용 높음 | $15/1M tokens |

```bash
# Ollama 설치 (로컬 사용 시)
# https://ollama.ai/download
ollama pull llama4        # Meta Llama 4 (권장)
ollama pull llama3.3      # Meta Llama 3.3 70B
ollama pull qwen2.5       # Alibaba Qwen 2.5
ollama pull gemma3        # Google Gemma 3
```

```typescript
// src/llm/types.ts
type LLMProvider = 'ollama' | 'grok' | 'openai' | 'anthropic';

interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;        // 클라우드 API용
  baseUrl?: string;       // Ollama 커스텀 URL
  temperature?: number;   // 0.0 - 1.0
  maxTokens?: number;
}

// src/llm/client.ts
interface AnalysisResult {
  hasKoreaRecord: boolean | null;  // 한국 기록 여부
  confidence: number;               // 신뢰도 (0-1)
  locality?: string;                // 채집지
  collectionDate?: string;          // 채집일
  specimenInfo?: string;            // 표본 정보
  relevantQuotes: string[];         // 관련 인용문
  reasoning: string;                // 판단 근거
}

// 제공자별 클라이언트
class LLMClient {
  constructor(config: LLMConfig) { ... }

  async analyze(text: string, scientificName: string): Promise<AnalysisResult> {
    switch (this.config.provider) {
      case 'ollama': return this.callOllama(text, scientificName);
      case 'grok': return this.callGrok(text, scientificName);
      case 'openai': return this.callOpenAI(text, scientificName);
      case 'anthropic': return this.callAnthropic(text, scientificName);
    }
  }
}

// 프롬프트 예시
const ANALYSIS_PROMPT = `
다음 학술 문헌 텍스트를 분석하여 한국에서의 해양생물 채집/서식 기록이 있는지 판단해주세요.

학명: {scientificName}
문헌 텍스트:
{text}

다음 정보를 추출해주세요:
1. 한국 기록 여부 (있음/없음/불확실)
2. 채집지 (있는 경우)
3. 채집 날짜 (있는 경우)
4. 표본 정보 (있는 경우)
5. 관련 문장 인용
6. 판단 근거

주의: 단순히 "분포: 한국" 같은 목록은 직접 채집 기록이 아닙니다.
실제 채집 정보(장소, 날짜, 표본)가 있는 경우만 "있음"으로 판단하세요.
`;
```

#### 3.3 분석 파이프라인

```
PDF 파일
    │
    ▼
[Docling] ─────────────────────────────
    │  - OCR 처리 (스캔 문서)
    │  - 레이아웃 분석
    │  - 표/그림 추출
    ▼
구조화된 텍스트
    │
    ▼
[전처리] ──────────────────────────────
    │  - 한국 키워드 포함 섹션 추출
    │  - 학명 주변 문맥 추출
    ▼
관련 텍스트 청크
    │
    ▼
[Ollama] ──────────────────────────────
    │  - 한국 기록 여부 판정
    │  - 채집 정보 추출
    │  - 신뢰도 평가
    ▼
분석 결과 (JSON)
    │
    ▼
[사용자 검토] ─────────────────────────
    │  - 자동 분석 결과 확인/수정
    │  - 최종 판정
    ▼
검토 완료
```

#### 3.4 API 엔드포인트

```typescript
// POST /api/pdf/upload
// PDF 파일 업로드 및 Docling 처리

// POST /api/pdf/analyze
// Ollama로 텍스트 분석
{
  "pdfId": "xxx",
  "scientificName": "Sebastes schlegelii",
  "synonyms": ["Sebastes inermis", ...]
}

// GET /api/pdf/:id/result
// 분석 결과 조회
```

### Phase 4: 추가 기능 (향후)

- 일괄 검색 (종 목록 업로드) ✓ 구현됨
- 국명 DB 연동
- 검색 히스토리 및 통계
- 협업 기능 (다중 사용자 검토)
- 크롤링 자동화 (법적 검토 필요)
