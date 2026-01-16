# First Record Finder 사용 가이드

한국 해양생물 최초기록 문헌 검색 시스템

---

## 1. 시스템 개요

### 목적
학명을 입력하면 → 여러 학술 DB에서 문헌 검색 → AI가 분석 → **한국 최초 기록 문헌** 자동 탐색

### 전체 흐름
```
[학명 입력] → [이명 조사] → [문헌 검색] → [LLM 분석] → [최초기록 판정] → [엑셀 결과]
                WoRMS        11개 DB        OpenRouter      연도순 정렬      data/reports/
```

---

## 2. 문헌 검색 소스 (11개)

### 학술 논문 (최초기록 판정에 적합) ✅

| 소스 | 설명 | API 키 | 용도 |
|------|------|--------|------|
| **BHL** | 역사적 문헌 (1800~1970) | 필요 | 오래된 원기재 논문 |
| **J-STAGE** | 일본 학술지 | 불필요 | 일제강점기 조사 기록 |
| **CiNii** | 일본 학술 DB | 불필요 | 일본어 논문 |
| **KCI** | 한국학술지인용색인 | 필요 | 최근 한국 논문 |
| **RISS** | 학술연구정보서비스 | 필요 | 학위논문 |
| **ScienceON** | KISTI 과학기술 | 필요 | 과학기술 분야 |
| **OpenAlex** | 현대 논문 (2억+) | 불필요 | 영문 논문 |
| **Semantic Scholar** | 영문 논문 (백업) | 불필요 | 보조 검색 |

### 보조 자료 (참고용) ⚠️

| 소스 | 설명 | 비고 |
|------|------|------|
| **GBIF** | 표본 데이터 | 기본 비활성화 |
| **OBIS** | 해양생물 분포 | 기본 비활성화 |

> ⚠️ GBIF/OBIS는 표본 기록이므로 **학술 논문이 아님** → 최초기록 판정에 부적합

---

## 3. 사용 방법

### 3.1 환경 설정

`.env.local` 파일 생성:
```env
# LLM 설정 (필수)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=mistralai/devstral-2512:free

# 문헌 검색 API 키 (선택)
BHL_API_KEY=your-bhl-key
KCI_API_KEY=your-kci-key
RISS_API_KEY=your-riss-key
SCIENCEON_CLIENT_ID=your-64-char-client-id
SCIENCEON_API_KEY=your-access-token
```

### 3.2 테스트 실행

```bash
# 1. 타입 체크
npm run type-check

# 2. 단일 종 테스트 (빠른 확인)
npx tsx scripts/test-llm-only.ts

# 3. 10종 배치 테스트 (전체 파이프라인)
npx tsx scripts/test-batch-species.ts
```

### 3.3 결과 확인

결과 파일 위치: `data/reports/`

| 파일 | 내용 |
|------|------|
| `분석결과_종명_날짜.xlsx` | 개별 종 분석 결과 |
| `통합분석결과_날짜.xlsx` | 모든 종 통합 결과 |

---

## 4. 엑셀 결과 파일 구조

### 시트 구성 (5개)

| 시트명 | 내용 |
|--------|------|
| **요약** | 전체 분석 요약 (검색/분석 건수, 한국기록 여부) |
| **분석결과** | 문헌별 상세 분석 결과 |
| **수동확인필요** | PDF 없이 분석된 항목 (신뢰도 낮음) |
| **최초기록** | 한국 기록 발견 시 상세 정보 |
| **LLM분석상세** | AI 분석 디버깅 정보 (프롬프트, 응답) |

### LLM분석상세 시트 컬럼

| 컬럼 | 설명 |
|------|------|
| 순번 | 분석 순서 |
| 연도 | 문헌 발행 연도 |
| 제목 | 논문 제목 |
| 분석방식 | PDF전문 / 초록만 / 메타데이터만 |
| 한국기록 | 있음 / 없음 / 불확실 |
| 신뢰도 | 0~100% |
| 사용모델 | 분석에 사용된 LLM 모델 |
| 입력텍스트(앞부분) | LLM에 전달된 텍스트 미리보기 |
| LLM응답(원본) | AI의 원본 응답 |
| 프롬프트(앞부분) | 사용된 프롬프트 |

---

## 5. 분석 로직

### 5.1 검색 전략

```
Phase 1: 유효명으로 검색 (모든 DB)
    ↓
Phase 2: 결과 부족 시 이명으로 추가 검색 (BHL만)
    ↓
연도순 정렬 (오래된 것 우선)
    ↓
maxResults(20건)로 제한
```

### 5.2 분석 전략

```
배치 분석 (기본 3건씩)
    ↓
한국 기록 발견? → 배치 완료 후 조기 종료
    ↓
한국 기록 없음? → 다음 배치로 이동
    ↓
최대 배치(5회)까지 반복
```

### 5.3 한국 기록 판정 기준

| 판정 | 조건 |
|------|------|
| **있음 (true)** | 한국에서 직접 채집/관찰된 기록 |
| **없음 (false)** | 한국 기록 명확히 없음 |
| **불확실 (null)** | 정보 부족 또는 판단 어려움 |

> 단순 "분포: 한국" 목록은 제외, 실제 채집 정보(장소, 날짜, 표본)가 있어야 함

---

## 6. 테스트 결과 예시

### 10종 배치 테스트 결과

| 종명 | 국명 | 검색 | 분석 | 한국기록 | 최초연도 |
|------|------|------|------|----------|----------|
| Ditrema temminckii | 망상어 | 20 | 3 | ✅ | 2006 |
| Anguilla japonica | 뱀장어 | 20 | 6 | ❌ | - |
| Pagrus major | 참돔 | 20 | 6 | ❌ | - |
| Sebastes schlegelii | 조피볼락 | 20 | 3 | ✅ | 2006 |
| Paralichthys olivaceus | 넙치 | 20 | 6 | ❌ | - |
| **Takifugu rubripes** | **자주복** | **20** | **3** | **✅** | **1929** |
| Mugil cephalus | 숭어 | 20 | 6 | ❌ | - |
| Lateolabrax japonicus | 농어 | 20 | 6 | ❌ | - |
| Scomber japonicus | 고등어 | 20 | 6 | ❌ | - |
| Engraulis japonicus | 멸치 | 20 | 6 | ❌ | - |

> 자주복(1929년, 부산시장 채집)이 가장 오래된 한국 기록으로 발견됨

---

## 7. 문제 해결

### Q: 검색은 되는데 분석이 안 돼요
- LLM API 키 확인 (`OPENROUTER_API_KEY`)
- Rate limit 확인 (무료 모델은 제한 있음)

### Q: 특정 DB에서 결과가 안 나와요
- API 키 설정 확인 (KCI, RISS 등)
- `src/literature/types.ts`에서 `enabled: true` 확인

### Q: 한국 기록이 없다고 나오는데 있을 것 같아요
- `수동확인필요` 시트 확인
- PDF 직접 확인 필요

### Q: GBIF/OBIS 결과는 믿을 수 있나요?
- 표본 데이터는 신뢰 가능하나, **학술 논문이 아님**
- 최초기록 문헌으로 인용하기 어려움

---

## 8. 향후 확장 가능

| 기능 | 용도 | API |
|------|------|-----|
| **NTIS** | 국가R&D 연구과제/동향 | 공공데이터포털 |
| **OpenAIRE** | EU 오픈액세스 논문 | 무료 API |

---

## 9. 프로젝트 구조

```
src/
├── literature/           # 문헌 검색 클라이언트
│   ├── bhl-client.ts     # BHL (역사적 문헌)
│   ├── jstage-client.ts  # J-STAGE (일본)
│   ├── kci-client.ts     # KCI (한국)
│   ├── scienceon-client.ts # ScienceON (KISTI)
│   └── collector.ts      # 통합 수집기
├── analysis/
│   └── pipeline.ts       # 분석 파이프라인
├── llm/
│   └── client.ts         # LLM 클라이언트 (OpenRouter)
└── output/
    └── analysis-report.ts # 엑셀 리포트 생성

data/
├── reports/              # 결과 엑셀 파일
├── pdfs/                 # 다운로드된 PDF
└── text_cache/           # 추출된 텍스트 캐시
```

---

## 10. API 키 발급 안내

| 서비스 | 발급 URL |
|--------|----------|
| BHL | https://www.biodiversitylibrary.org/api3 |
| KCI | https://www.data.go.kr/data/3049042/openapi.do |
| RISS | https://www.data.go.kr/data/3046254/openapi.do |
| ScienceON | https://scienceon.kisti.re.kr/por/oapi/openApi.do |
| OpenRouter | https://openrouter.ai/keys |
