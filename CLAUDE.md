# First Record Finder

한국 수산생물 최초기록 문헌 검색 시스템

## 프로젝트 개요

해양생물의 학명을 입력하면 WoRMS(World Register of Marine Species)에서 해당 종의 모든 이명(synonym)을 추출하고, 여러 학술 DB에서 자동으로 문헌을 수집하여 AI로 분석한 뒤, 한국 최초 서식 기록 문헌을 찾는 시스템.

### 핵심 워크플로우

```
[1단계: 학명 입력]
  │  엑셀 업로드 또는 직접 입력
  ▼
[2단계: 이명 조사]
  │  WoRMS API로 동의어 추출
  ▼
[3단계: 문헌 자동 수집]
  │  여러 소스에서 PDF 자동 다운로드
  │  - Paper Search MCP (Google Scholar, Semantic Scholar 등)
  │  - BHL API (역사적 문헌, 1800년대~)
  │  - J-STAGE API (일본 논문)
  │  - KCI/RISS (한국 논문)
  │  - 수동 업로드 (자동화 불가 문헌)
  ▼
[4단계: 문헌 분석]
  │  Docling OCR + LLM 분석
  │  한국 기록 여부 자동 판정
  ▼
[5단계: 사람+AI 검토]
  │  분석 결과 확인/수정
  │  Evidence 정보 보완
  ▼
[6단계: 최초 기록 판정]
  │  연도순 정렬 → 최초 한국 기록 확정
  ▼
[7단계: 결과 다운로드]
     엑셀 + PDF 묶음 (ZIP)
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **UI**: React 18, 순수 CSS
- **엑셀 처리**: xlsx (SheetJS)
- **PDF 처리**: Docling (OCR 포함)
- **LLM**: Ollama, OpenRouter, Grok, OpenAI, Anthropic

> 상세 설정 및 Rate Limit 현황은 **대시보드** (`/dashboard`)에서 확인

### 문헌 수집 소스

최초 기록에는 두 가지 유형이 있으며, 각각에 맞는 DB를 활용:

#### 1. 역사적 최초 기록 (1800년대~)
과거에 처음 기록된 종을 찾기 위한 소스
- **BHL**: 역사적 문헌 (1800~1970), API 키 필수
- **J-STAGE / CiNii**: 일본 논문 (일제강점기 포함)

#### 2. 최근 신규 기록 (기후 변화 등)
기후 변화로 분포 확장, 외래종 유입 등 최근 한국에서 처음 발견된 종
- **KCI**: 한국학술지인용색인 (공공데이터포털 API)
- **RISS**: 학술연구정보서비스 (공공데이터포털 API)
- **ScienceON**: KISTI 과학기술 지식인프라 (API 키 필요)

#### 3. 보조 소스 (참고용)
- **OpenAlex**: 영문 현대 논문 (주력)
- **Semantic Scholar**: 영문 현대 논문 (백업)
- **GBIF / OBIS**: 표본/분포 데이터 (참고용 - 최초기록 판정에 부적합)

## 프로젝트 구조

```
src/
├── types/index.ts           # 전체 타입 정의
├── worms/                   # WoRMS API 연동
├── search/                  # 검색 URL 생성
├── output/                  # 엑셀 출력
├── pdf/                     # PDF 처리 (Docling)
├── llm/                     # LLM 클라이언트
│   ├── client.ts            # 다중 제공자 클라이언트
│   ├── rate-limiter.ts      # OpenRouter 무료 모델 Rate Limit 관리
│   └── types.ts             # LLM 관련 타입
└── literature/              # 문헌 수집 ✅ 구현 완료
    ├── types.ts             # 문헌 검색 타입 정의
    ├── bhl-client.ts        # BHL API (역사적 문헌)
    ├── jstage-client.ts     # J-STAGE API (일본 논문)
    ├── cinii-client.ts      # CiNii API (일본 학술정보)
    ├── kci-client.ts        # KCI API (한국 학술지)
    ├── riss-client.ts       # RISS API (한국 학위논문)
    ├── scienceon-client.ts  # ScienceON API (KISTI)
    ├── semantic-client.ts   # Semantic Scholar API
    ├── openalex-client.ts   # OpenAlex API (현대 논문)
    ├── gbif-client.ts       # GBIF API (표본 데이터, 참고용)
    ├── obis-client.ts       # OBIS API (해양 분포, 참고용)
    ├── collector.ts         # 통합 수집기
    └── index.ts             # 모듈 export

app/
├── page.tsx                 # 메인 UI (Rate Limit 경고 배너 포함)
├── dashboard/page.tsx       # 프로젝트 대시보드
└── api/
    ├── search/              # WoRMS 검색
    ├── export/              # 엑셀 내보내기
    ├── pdf/                 # PDF 업로드/분석
    └── llm/usage/           # Rate Limit 상태 API
```

## 핵심 타입

### 신뢰도 레벨 (ConfidenceLevel)

- **Level 1 (확정)**: 한국 채집지 + 날짜/표본 정보 있음
- **Level 2 (유력)**: 한국 언급 있으나 일부 정보 부족
- **Level 3 (검토 필요)**: 학명 있으나 한국 여부 불명확
- **Level 4 (제외)**: 한국 기록 아님

## 주요 명령어

```bash
npm run dev          # 개발 서버 (포트 3001)
npm run build        # 빌드
npm run type-check   # 타입 체크
```

## 개발 시 주의사항

1. **WoRMS API 호출 간격**: 200ms 딜레이 필수
2. **이명 검색**: 유효명도 이명 목록에 포함
3. **연도순 정렬**: 오래된 것 우선
4. **한국 기록 판별**: 단순 분포 목록 제외, 실제 채집 기록만

## 환경 변수 (.env.local)

```env
# LLM 제공자 (ollama | openrouter | grok | openai | anthropic)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key

# Ollama (로컬)
OLLAMA_HOST=http://localhost:11434

# 문헌 수집 API 키
BHL_API_KEY=your-bhl-key

# 한국 논문 검색 (공공데이터포털에서 발급)
KCI_API_KEY=your-kci-key
RISS_API_KEY=your-riss-key

# ScienceON (KISTI) - https://scienceon.kisti.re.kr/por/oapi/openApi.do
SCIENCEON_CLIENT_ID=your-64-char-client-id
SCIENCEON_API_KEY=your-access-token

# Docling
DOCLING_API_URL=http://localhost:5000
```

## 외부 의존성

- **WoRMS API**: https://www.marinespecies.org/rest/
- **BHL API**: https://www.biodiversitylibrary.org/api3
- **J-STAGE API**: https://www.jstage.jst.go.jp/
- **KCI API**: https://www.data.go.kr/data/3049042/openapi.do
- **RISS API**: https://www.data.go.kr/data/3046254/openapi.do
- **ScienceON API**: https://scienceon.kisti.re.kr/apigateway
- **OpenAlex API**: https://openalex.org/
- **Docling**: https://github.com/DS4SD/docling
