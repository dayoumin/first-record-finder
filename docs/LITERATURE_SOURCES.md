# 문헌 검색 소스 가이드

> 한국 수산생물 최초 기록 검색을 위한 문헌 DB 정리

## 개요

| 카테고리 | 소스 | 구현 상태 | 주요 용도 |
|---------|------|----------|----------|
| **역사적 문헌** | BHL | ✅ 완료 | 1800년대 원기재 논문 |
| **최신 영문** | Semantic Scholar | ✅ 완료 | 2000년대 이후 영문 논문 |
| **일본 문헌** | J-STAGE | 📋 예정 | 일제강점기 일본어 논문 |
| **일본 문헌** | CiNii | 📋 예정 | 일본 학술지/학위논문 |
| **표본 데이터** | GBIF | 📋 예정 | 채집 기록 직접 확인 |
| **해양생물** | OBIS | 📋 예정 | 해양생물 분포 데이터 |
| **한국 논문** | KCI | ⚠️ 제한 | 한국 학술지 (1998~) |
| **한국 논문** | RISS | ⚠️ 제한 | 한국 학위논문 |
| **유료 DB** | DBpia 등 | ⚠️ 수동 | 유료 구독 필요 |

---

## 1. BHL (Biodiversity Heritage Library)

### 기본 정보
- **URL**: https://www.biodiversitylibrary.org/
- **API 문서**: https://www.biodiversitylibrary.org/docs/api3.html
- **구현 파일**: `src/literature/bhl-client.ts`
- **상태**: ✅ 구현 완료

### 특징
| 항목 | 내용 |
|------|------|
| 커버리지 | 1800년대 ~ 1970년대 (스캔 문헌) |
| 언어 | 주로 영어, 독일어, 프랑스어, 라틴어 |
| PDF | 스캔 PDF 무료 제공 |
| API 키 | **필수** (https://www.biodiversitylibrary.org/api2/key) |
| Rate Limit | 없음 (키 있으면) |

### 용도
- **최초 기록 찾기의 핵심 소스**
- 종의 원기재(original description) 논문 검색
- 19세기~20세기 초 분류학 문헌
- 역사적 한국 해역 조사 기록

### 검색 전략
```
historical 전략: 학명만으로 검색 (1700-1970)
- Korea 키워드 없이 검색
- 원기재 논문 및 초기 기록 발견에 적합
```

### 한계점
- OCR 품질이 낮은 스캔 문서 있음
- 일부 문헌 누락 가능
- 최신 논문 없음

---

## 2. Semantic Scholar

### 기본 정보
- **URL**: https://www.semanticscholar.org/
- **API 문서**: https://api.semanticscholar.org/api-docs/
- **구현 파일**: `src/literature/semantic-client.ts`
- **상태**: ✅ 구현 완료

### 특징
| 항목 | 내용 |
|------|------|
| 커버리지 | 주로 2000년대 이후 영문 논문 |
| 언어 | 영어 중심 |
| PDF | Open Access만 제공 |
| API 키 | 선택 (있으면 rate limit 완화) |
| Rate Limit | 100 req/5min (키 없을 때) |

### 용도
- 최신 한국 기록 확인
- 영문 학술 논문 검색
- 인용 정보 활용

### 검색 전략
```
korea 전략: 학명 + Korea 키워드로 검색
- 80+ 한국 관련 키워드 사용
- 최근 한국 기록 확인에 적합
```

### 한계점
- **역사적 문헌 거의 없음** (최초 기록 찾기에 부적합)
- Rate limit으로 대량 검색 느림
- Open Access 아닌 논문은 PDF 없음

---

## 3. J-STAGE (Japan Science and Technology Information Aggregator)

### 기본 정보
- **URL**: https://www.jstage.jst.go.jp/
- **API 문서**: https://www.jstage.jst.go.jp/static/pages/JstageServices/TAB3/-char/ja
- **구현 파일**: `src/literature/jstage-client.ts` (예정)
- **상태**: 📋 구현 예정

### 특징
| 항목 | 내용 |
|------|------|
| 커버리지 | 1880년대 ~ 현재 일본 학술지 |
| 언어 | 일본어, 영어 |
| PDF | 무료 제공 (대부분) |
| API 키 | 불필요 |
| Rate Limit | 낮음 |

### 용도
- **일제강점기(1910-1945) 한국 해역 논문 필수**
- 일본동물학회, 일본수산학회 논문
- 조선총독부 수산시험장 보고서
- 예: "朝鮮産魚類目錄", "朝鮮近海産ヒラメ類"

### 검색 전략
```
일본어 키워드 사용:
- 朝鮮 (조선)
- 済州 (제주)
- 釜山 (부산)
- 日本海 (동해)
```

### API 사용법
```
GET https://api.jstage.jst.go.jp/searchapi/do
  ?service=3
  &pubyearfrom=1880
  &pubyearto=1950
  &article=Sebastes
  &count=100
```

### 중요성: ⭐⭐⭐ (최우선 구현)
일제강점기 한국 해양생물 연구는 대부분 일본인 학자가 수행하여 일본 학술지에 발표됨. 이 시기 논문이 한국 최초 기록인 경우가 많음.

---

## 4. CiNii (NII Scholarly and Academic Information Navigator)

### 기본 정보
- **URL**: https://cir.nii.ac.jp/
- **API 문서**: https://support.nii.ac.jp/ja/cinii/api/a_opensearch
- **구현 파일**: `src/literature/cinii-client.ts` (예정)
- **상태**: 📋 구현 예정

### 특징
| 항목 | 내용 |
|------|------|
| 커버리지 | 메이지(1868~) ~ 현재, 학위논문 포함 |
| 언어 | 일본어 |
| PDF | 일부 제공 |
| API 키 | 불필요 (OpenSearch) |
| Rate Limit | 중간 |

### 용도
- J-STAGE에 없는 일본 논문 보완
- 일본 대학 학위논문
- 고서적, 잡지 기사

### J-STAGE와의 차이
| J-STAGE | CiNii |
|---------|-------|
| 학술지 중심 | 학위논문, 잡지 포함 |
| PDF 직접 제공 | 링크만 제공하는 경우 많음 |
| API 더 간단 | 검색 범위 더 넓음 |

### 중요성: ⭐⭐ (J-STAGE 다음 순위)

---

## 5. GBIF (Global Biodiversity Information Facility)

### 기본 정보
- **URL**: https://www.gbif.org/
- **API 문서**: https://www.gbif.org/developer/summary
- **구현 파일**: `src/literature/gbif-client.ts` (예정)
- **상태**: 📋 구현 예정

### 특징
| 항목 | 내용 |
|------|------|
| 데이터 유형 | 표본(specimen) 기록, 관찰 기록 |
| 커버리지 | 전 세계 생물다양성 데이터 |
| API 키 | 불필요 (일부 기능 필요) |
| Rate Limit | 낮음 |

### 용도
- **채집 기록 직접 확인** (문헌이 아닌 실제 데이터)
- 표본 채집 날짜, 장소 확인
- 한국 기록 검증

### 검색 예시
```
GET https://api.gbif.org/v1/occurrence/search
  ?scientificName=Sebastes%20schlegelii
  &country=KR
  &limit=100
```

### 반환 데이터
```json
{
  "scientificName": "Sebastes schlegelii",
  "country": "KR",
  "locality": "Busan",
  "eventDate": "1923-05-15",
  "institutionCode": "NIBR",
  "catalogNumber": "NIBR-P0000001"
}
```

### 중요성: ⭐⭐⭐ (문헌과 병행 사용)
문헌에서 찾은 기록을 GBIF 표본 데이터로 검증 가능. 때로는 문헌보다 더 오래된 표본 기록 발견 가능.

---

## 6. OBIS (Ocean Biodiversity Information System)

### 기본 정보
- **URL**: https://obis.org/
- **API 문서**: https://api.obis.org/
- **구현 파일**: `src/literature/obis-client.ts` (예정)
- **상태**: 📋 구현 예정

### 특징
| 항목 | 내용 |
|------|------|
| 데이터 유형 | 해양생물 분포 데이터 |
| 커버리지 | 전 세계 해양 |
| API 키 | 불필요 |
| Rate Limit | 낮음 |

### 용도
- 해양생물 전문 데이터베이스
- 한국 해역 분포 기록 확인
- GBIF 보완

### GBIF와의 차이
| GBIF | OBIS |
|------|------|
| 모든 생물 | 해양생물 전문 |
| 표본 중심 | 분포 기록 중심 |
| 더 많은 데이터 | 해양 특화 메타데이터 |

### 중요성: ⭐⭐ (해양생물 특화)

---

## 7. KCI (한국학술지인용색인)

### 기본 정보
- **URL**: https://www.kci.go.kr/
- **API**: 없음 (스크래핑 필요)
- **구현 파일**: `src/literature/kci-client.ts` (예정)
- **상태**: ⚠️ 제한적 구현 예정

### 특징
| 항목 | 내용 |
|------|------|
| 커버리지 | 1998년 ~ 현재 한국 학술지 |
| 언어 | 한국어, 영어 |
| PDF | 일부 제공 |
| API | **없음** - Playwright 스크래핑 필요 |

### 용도
- 한국어 논문 검색
- 한국 기록 확인 (검증용)

### 한계점
- **1998년 이후만** → 최초 기록 찾기에 거의 무의미
- API 없어서 스크래핑 필요
- 최초 기록보다는 "한국에서 이미 알려진 종" 확인용

### 중요성: ⭐ (낮음 - 최초 기록에 부적합)

---

## 8. RISS (학술연구정보서비스)

### 기본 정보
- **URL**: https://www.riss.kr/
- **API**: 없음 (스크래핑 필요)
- **구현 파일**: `src/literature/riss-client.ts` (예정)
- **상태**: ⚠️ 제한적 구현 예정

### 특징
| 항목 | 내용 |
|------|------|
| 커버리지 | 한국 학위논문, 학술지 |
| 언어 | 한국어 |
| PDF | 일부 로그인 필요 |
| API | **없음** - Playwright 스크래핑 필요 |

### 용도
- 한국 학위논문 검색
- 석박사 논문에서 한국 기록 확인

### 한계점
- 로그인 필요한 자료 많음
- 최초 기록 찾기에는 부적합

### 중요성: ⭐ (낮음)

---

## 9. Paper Search MCP

### 기본 정보
- **URL**: https://github.com/openags/paper-search-mcp
- **타입**: MCP 서버
- **상태**: 📋 구현 예정 (우선순위 낮음)

### 특징
- 13개 플랫폼 통합 검색 (Google Scholar 포함)
- MCP 서버 설치 필요
- Google Scholar ToS 우회

### 중요성: ⭐ (낮음 - BHL+J-STAGE로 대부분 커버)

---

## 검색 전략 요약

### 최초 기록 찾기 (권장 순서)

```
1단계: BHL 검색 (1700-1970, 학명만)
       → 원기재 논문, 초기 기록

2단계: J-STAGE 검색 (1880-1950, 일본어 키워드)
       → 일제강점기 한국 기록

3단계: GBIF/OBIS 확인
       → 표본 데이터로 검증

4단계: Semantic Scholar (최신 논문)
       → 기존 기록 확인/보완

5단계: CiNii (필요시)
       → J-STAGE에 없는 일본 문헌
```

### 한국 키워드 (80+)

| 카테고리 | 키워드 |
|---------|--------|
| 영문 | Korea, Korean, Corea, Corean |
| 한글 | 한국, 조선, 대한민국 |
| 일본어 | 朝鮮, Chosen, Tyosen |
| 일본식 지명 | 済州, 釜山, 仁川, 元山 |
| 해역 | Korean waters, East Sea, 日本海 |
| 서양 고명 | Quelpart, Dagelet, Chemulpo |
| 일본식 로마자 | Fuzan, Jinsen, Genzan |

---

## 구현 우선순위

| 순위 | 소스 | 이유 | 예상 난이도 |
|------|------|------|------------|
| 1 | **J-STAGE** | 일제강점기 필수, 무료 API | 중간 |
| 2 | **GBIF** | 표본 데이터 검증, 간단한 API | 쉬움 |
| 3 | **OBIS** | 해양생물 특화, 간단한 API | 쉬움 |
| 4 | **CiNii** | J-STAGE 보완 | 중간 |
| 5 | KCI | API 없음, 최초 기록에 부적합 | 어려움 |
| 6 | RISS | API 없음, 로그인 필요 | 어려움 |
| 7 | Paper Search MCP | 우선순위 낮음 | 중간 |

---

## 환경 변수 설정

```env
# 필수
BHL_API_KEY=your-bhl-api-key

# 선택 (있으면 rate limit 완화)
SEMANTIC_SCHOLAR_API_KEY=your-semantic-key

# J-STAGE, GBIF, OBIS, CiNii는 API 키 불필요
```

---

## 변경 이력

- 2026-01-14: 초기 문서 작성
  - 9개 소스 정리
  - 구현 우선순위 정의
  - 검색 전략 문서화
