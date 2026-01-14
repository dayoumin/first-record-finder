# 문헌 소스 확장 작업 계획

> 생성일: 2026-01-14
> 상태: 진행 중

## 목표

현재 BHL + Semantic Scholar만 구현된 문헌 검색 시스템을 확장하여:
1. J-STAGE, CiNii (일본 문헌)
2. GBIF, OBIS (표본/분포 데이터)
3. KCI, RISS (한국 문헌 - 낮은 우선순위)

를 추가 구현한다.

---

## 작업 1: J-STAGE API 클라이언트

### 우선순위: ⭐⭐⭐ (최우선)

### 이유
- 일제강점기(1910-1945) 한국 해역 논문의 대부분이 일본 학술지에 발표됨
- 이 시기 논문이 한국 최초 기록인 경우가 많음
- 무료 API, PDF 직접 다운로드 가능

### 구현 내용

**파일**: `src/literature/jstage-client.ts`

```typescript
// API 엔드포인트
const JSTAGE_API_BASE = 'https://api.jstage.jst.go.jp/searchapi/do';

// 검색 파라미터
interface JStageSearchParams {
  service: 3;           // 논문 검색
  pubyearfrom?: number; // 시작 연도
  pubyearto?: number;   // 종료 연도
  article?: string;     // 검색어 (제목/초록)
  issn?: string;        // ISSN
  count?: number;       // 결과 수 (max 1000)
  start?: number;       // 시작 위치
}

// 응답 형식: XML
// 파싱 필요
```

### 검색 전략
- 학명으로 검색
- 일본어 한국 키워드 추가: 朝鮮, 済州, 釜山, 日本海
- 연도 범위: 1880-1970 (역사적 전략)

### 작업 단계
- [ ] JStageClient 클래스 생성
- [ ] XML 응답 파싱 구현
- [ ] LiteratureItem 변환
- [ ] PDF 다운로드 구현
- [ ] collector.ts에 통합
- [ ] UI에 소스 옵션 추가
- [ ] 테스트

### 예상 소요: 2-3시간

---

## 작업 2: GBIF API 클라이언트

### 우선순위: ⭐⭐⭐ (높음)

### 이유
- 표본 데이터로 문헌 기록 검증 가능
- 때로는 문헌보다 더 오래된 표본 기록 발견
- 간단한 REST API

### 구현 내용

**파일**: `src/literature/gbif-client.ts`

```typescript
// API 엔드포인트
const GBIF_API_BASE = 'https://api.gbif.org/v1';

// 검색
GET /occurrence/search
  ?scientificName={name}
  &country=KR
  &limit=300

// 종 정보
GET /species/search
  ?q={name}
```

### 반환 데이터
```typescript
interface GBIFOccurrence {
  key: number;
  scientificName: string;
  country: string;
  locality: string;
  eventDate: string;
  year: number;
  month: number;
  day: number;
  institutionCode: string;
  catalogNumber: string;
  basisOfRecord: string; // PRESERVED_SPECIMEN, OBSERVATION 등
  references: string;    // 문헌 참조
}
```

### 작업 단계
- [ ] GBIFClient 클래스 생성
- [ ] 한국 기록 필터링
- [ ] 표본 데이터 → LiteratureItem 변환 (또는 별도 타입)
- [ ] 연도별 정렬
- [ ] collector.ts에 통합 (또는 별도 서비스)
- [ ] UI 표시

### 예상 소요: 1-2시간

---

## 작업 3: OBIS API 클라이언트

### 우선순위: ⭐⭐ (중간)

### 이유
- 해양생물 전문 데이터베이스
- GBIF 보완

### 구현 내용

**파일**: `src/literature/obis-client.ts`

```typescript
// API 엔드포인트
const OBIS_API_BASE = 'https://api.obis.org/v3';

// 검색
GET /occurrence
  ?scientificname={name}
  &geometry=POLYGON(...)  // 한국 해역
```

### 작업 단계
- [ ] OBISClient 클래스 생성
- [ ] 한국 해역 geometry 정의
- [ ] 응답 파싱
- [ ] GBIF와 중복 제거
- [ ] 통합

### 예상 소요: 1-2시간

---

## 작업 4: CiNii API 클라이언트

### 우선순위: ⭐⭐ (중간)

### 이유
- J-STAGE에 없는 일본 문헌 보완
- 학위논문 포함

### 구현 내용

**파일**: `src/literature/cinii-client.ts`

```typescript
// OpenSearch API
const CINII_API_BASE = 'https://cir.nii.ac.jp/opensearch/articles';

// 파라미터
?q={검색어}
&format=json
&count=100
```

### 작업 단계
- [ ] CiNiiClient 클래스 생성
- [ ] JSON/Atom 응답 파싱
- [ ] LiteratureItem 변환
- [ ] J-STAGE 결과와 중복 제거
- [ ] 통합

### 예상 소요: 1-2시간

---

## 작업 5: KCI/RISS 스크래퍼 (낮은 우선순위)

### 우선순위: ⭐ (낮음)

### 이유
- 1998년 이후만 → 최초 기록에 부적합
- API 없어서 스크래핑 필요
- 구현 복잡

### 구현 방식
- Playwright 사용
- 로그인 처리 필요 (RISS)

### 작업 단계 (나중에)
- [ ] Playwright 설치
- [ ] KCI 스크래퍼 구현
- [ ] RISS 스크래퍼 구현
- [ ] 로그인 세션 관리

### 예상 소요: 4-6시간

---

## 통합 작업

### collector.ts 업데이트

```typescript
// 현재
type LiteratureSource = 'bhl' | 'semantic';

// 변경
type LiteratureSource = 'bhl' | 'semantic' | 'jstage' | 'cinii' | 'gbif' | 'obis' | 'kci' | 'riss';

// 클라이언트 맵 확장
const clients: Record<LiteratureSource, ILiteratureClient | null> = {
  bhl: new BHLClient(),
  semantic: new SemanticScholarClient(),
  jstage: new JStageClient(),      // 추가
  cinii: new CiNiiClient(),        // 추가
  gbif: new GBIFClient(),          // 추가
  obis: new OBISClient(),          // 추가
  kci: null,                       // 나중에
  riss: null,                      // 나중에
};
```

### types.ts 업데이트

```typescript
// LiteratureSource 확장
export type LiteratureSource =
  | 'bhl'
  | 'semantic'
  | 'jstage'
  | 'cinii'
  | 'gbif'
  | 'obis'
  | 'kci'
  | 'riss';

// GBIF/OBIS용 타입 추가 (선택)
export interface SpecimenRecord {
  id: string;
  scientificName: string;
  country: string;
  locality: string;
  eventDate: string | null;
  year: number | null;
  institutionCode: string;
  catalogNumber: string;
  source: 'gbif' | 'obis';
}
```

### UI 업데이트

**app/page.tsx**
```typescript
// 소스 옵션에 추가
<label>
  <input type="checkbox" ... />
  J-STAGE (일본 논문, 일제강점기)
</label>
<label>
  <input type="checkbox" ... />
  CiNii (일본 학술 DB)
</label>
<label>
  <input type="checkbox" ... />
  GBIF (표본 데이터)
</label>
<label>
  <input type="checkbox" ... />
  OBIS (해양생물 분포)
</label>
```

### 대시보드 업데이트

**app/dashboard/page.tsx**
- 구현 상태 카운트 업데이트
- 소스 테이블 업데이트

---

## 작업 순서

```
1. J-STAGE 클라이언트 구현 (최우선)
   ↓
2. GBIF 클라이언트 구현
   ↓
3. OBIS 클라이언트 구현
   ↓
4. CiNii 클라이언트 구현
   ↓
5. collector.ts 통합
   ↓
6. types.ts 업데이트
   ↓
7. UI 소스 옵션 추가
   ↓
8. 대시보드 업데이트
   ↓
9. 테스트
   ↓
10. KCI/RISS (나중에)
```

---

## 체크리스트

### Phase 1: 핵심 소스 ✅ 완료
- [x] J-STAGE 클라이언트
- [x] GBIF 클라이언트
- [x] OBIS 클라이언트
- [x] collector.ts 통합
- [x] types.ts 업데이트

### Phase 2: 보완 소스 ✅ 완료
- [x] CiNii 클라이언트
- [x] 대시보드 업데이트
- [x] ROADMAP 업데이트
- [x] 문서 업데이트

### Phase 3: 한국 소스 (나중에)
- [ ] KCI 스크래퍼
- [ ] RISS 스크래퍼

---

## 진행 상황

| 작업 | 상태 | 시작 | 완료 |
|------|------|------|------|
| LITERATURE_SOURCES.md | ✅ | 2026-01-14 | 2026-01-14 |
| WORK_PLAN.md | ✅ | 2026-01-14 | 2026-01-14 |
| J-STAGE 클라이언트 | ✅ | 2026-01-14 | 2026-01-14 |
| GBIF 클라이언트 | ✅ | 2026-01-14 | 2026-01-14 |
| OBIS 클라이언트 | ✅ | 2026-01-14 | 2026-01-14 |
| CiNii 클라이언트 | ✅ | 2026-01-14 | 2026-01-14 |
| collector 통합 | ✅ | 2026-01-14 | 2026-01-14 |
| types.ts 업데이트 | ✅ | 2026-01-14 | 2026-01-14 |
| 대시보드 업데이트 | ✅ | 2026-01-14 | 2026-01-14 |
| KCI 스크래퍼 | 📋 | - | - |
| RISS 스크래퍼 | 📋 | - | - |
