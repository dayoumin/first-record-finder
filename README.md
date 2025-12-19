# 한국 수산생물 최초기록 문헌 검색 시스템

## 개요

WoRMS에서 학명의 이명(synonyms)을 추출하고, 각 이명으로 한국 내 최초 서식 기록 문헌을 검색하는 도구입니다.

### 핵심 기능
- WoRMS API를 통한 이명 추출
- 연도순 문헌 검색 (오래된 것부터)
- 최초 기록 확정 시 검색 자동 중단
- 엑셀 및 웹 뷰어 출력

---

## ⚠️ 중요 결정사항 (반드시 읽을 것!)

### 학명 입력 - 형식 제한 없음

WoRMS API가 다양한 형식을 자동 처리합니다:
- 기본 형식: `Sebastes schlegelii` ✅
- 저자 포함: `Sebastes schlegelii Hilgendorf, 1880` ✅
- 철자 변이: `Sebastes schlegeli` → 자동 보정 ✅
- 과거 속명: `Sebastichthys schlegelii` → 유효명으로 매핑 ✅
- 대소문자 무관: `SEBASTES SCHLEGELII` ✅

**결론: 어떤 형식으로 입력해도 WoRMS가 알아서 처리합니다.**

### 이명 연도 - 검색 제한에 사용하지 않음

```
❌ 잘못됨: "이명이 1880년에 발표되었으니 1880년 이후만 검색"
✅ 올바름: "모든 이명으로 전체 기간 검색"

이유:
- 학명 변경 후에도 구 명칭 계속 사용하는 경우 많음
- 저자가 분류학적 변경을 모르고 구 명칭 사용
- 습관적으로 익숙한 명칭 사용

예시: Fugu → Takifugu (1990년대 변경)
      2000년대 이후에도 "Fugu rubripes" 사용 문헌 존재
```

이명 연도는 **참고용**으로만 활용 (원기재 확인 등)

---

## "최초기록"의 정의

단순히 학명이 언급된 문헌이 아닌, **한국 해역에서 실제 채집/관찰되었다는 증거가 있는 문헌**을 찾습니다.

### 유효한 기록 예시
```
✅ "본 표본은 1998년 5월 제주도 서귀포 앞바다에서
    자망으로 채집되었다 (NIBR-P-12345)"

✅ "Examined material: 2 specimens,
    Busan, Korea, 15 Mar 2001, coll. Kim"
```

### 무효한 기록 예시
```
❌ "한국에 분포한다 (Kim, 1990에서 인용)" → 원 문헌 확인 필요
❌ "분포: 일본, 한국, 중국" → 구체적 채집 기록 없음
```

---

## 설치 및 실행

```bash
cd first-record-finder
npm install --legacy-peer-deps
```

### CLI 검색
```bash
# 단일 종 검색
npx ts-node --project tsconfig.scripts.json scripts/search.ts --name "Sebastes schlegelii"

# WoRMS 테스트
npx ts-node --project tsconfig.scripts.json scripts/test-worms.ts "Takifugu rubripes"

# 연도 추출 테스트
npx ts-node --project tsconfig.scripts.json scripts/test-year-extraction.ts
```

### 웹 뷰어
```bash
npm run dev
# http://localhost:3001 접속
```

---

## 전체 워크플로우

```
Phase 1: 학명 입력
├── 개별 입력 (1개씩)
└── 엑셀 업로드 (일괄)
         ↓
Phase 2: WoRMS 이명 추출 (자동)
├── API 호출
├── 유효명 + 이명 추출
└── 검색 URL 생성
         ↓
Phase 3: 문헌 검색 (수동)
├── Google Scholar / KCI 검색
├── 한국 관련 문헌 필터링
└── 후보 문헌 목록 작성
         ↓
Phase 4: 문헌 확보 및 검토 (수동)
├── PDF 확보
├── 서식 근거 확인
└── 신뢰도 레벨 판정
         ↓
Phase 5: 결과 저장
├── 검토 결과 입력
├── 최초 기록 판정
└── 엑셀 내보내기
```

---

## 폴더 구조

```
first-record-finder/
├── app/                 # Next.js 웹 뷰어
│   ├── api/            # API 라우트
│   └── page.tsx        # 메인 페이지
├── src/
│   ├── worms/          # WoRMS API 연동
│   ├── search/         # 문헌 검색 엔진
│   ├── output/         # 엑셀/웹 출력
│   └── types/          # TypeScript 타입
├── scripts/            # CLI 스크립트
├── data/
│   ├── results/        # 검색 결과 JSON
│   ├── exports/        # 엑셀 파일
│   └── pdfs/           # 업로드된 PDF
└── docs/               # 문서
    ├── DISCUSSION_SUMMARY.md     # 프로젝트 논의 요약
    ├── ROADMAP.md                # 개발 로드맵
    ├── ADDITIONAL_DATASOURCES.md # 추가 데이터소스
    └── AI_TOOLS_EVALUATION.md    # AI 도구 평가
```

---

## 기술 스택

| 용도 | 도구 |
|------|------|
| 이명 추출 | WoRMS REST API |
| 문헌 검색 | Google Scholar, KCI Open API |
| PDF 분석 | pdf-parse |
| 엑셀 출력 | xlsx (SheetJS) |
| 웹 뷰어 | Next.js |

---

## 개발 현황

### 완료
- [x] WoRMS 이명 추출
- [x] 검색 URL 생성
- [x] 엑셀 출력
- [x] 웹 뷰어 기본
- [x] CLI 스크립트

### 진행 예정
- [ ] 문헌 기록 입력 UI
- [ ] 학명 일괄 입력 (엑셀)
- [ ] 검색 결과 저장/관리
- [ ] PDF 분석

---

## 상세 문서

| 문서 | 내용 |
|------|------|
| [DISCUSSION_SUMMARY.md](docs/DISCUSSION_SUMMARY.md) | 전체 워크플로우, 중요 결정사항 |
| [ROADMAP.md](docs/ROADMAP.md) | 개발 로드맵, 향후 계획 |
| [ADDITIONAL_DATASOURCES.md](docs/ADDITIONAL_DATASOURCES.md) | WoRMS 외 추가 데이터소스 |
| [AI_TOOLS_EVALUATION.md](docs/AI_TOOLS_EVALUATION.md) | AI 도구 및 PDF 분석 도구 평가 |

## species_checker에서 재사용 가능한 코드

이 프로젝트는 species_checker 프로젝트에서 파생되었습니다.
필요 시 다음 코드를 참고/복사할 수 있습니다:

| 파일 | 용도 |
|------|------|
| `fetchWithRetry.ts` | API 재시도 로직 (✅ 이미 복사됨) |
| `wormsValidator.ts` | WoRMS API 호출 패턴 |
| `nibrValidator.ts` | 엑셀 파일 처리 |
| `utils.ts` | 학명 정규화 (`normalizeName()`) |

## 라이선스

MIT
