# ROADMAP

## 현재 구현 상태 (2026-01)

### 완료

- [x] **WoRMS API 이명 추출** - `src/worms/synonym-extractor.ts`
- [x] **웹 UI 기본 구조** - 8단계 워크플로우 표시기
- [x] **검색 URL 생성** - Google Scholar, KCI
- [x] **한국 관련 키워드** - 80+ 키워드 (Korea, Corea, 한국, 조선, 朝鮮, Chosen, 일본어 지명 등)
- [x] **엑셀 파일 업로드** - 일괄 처리
- [x] **엑셀 내보내기** - 3개 시트 (요약, 상세, 이명)
- [x] **진행 상황 표시** - %, 현재 처리 중 학명
- [x] **PDF 업로드 + Docling** - OCR, 텍스트 추출
- [x] **LLM 분석** - Ollama, Grok, OpenAI, Anthropic, OpenRouter 지원
- [x] **타입 시스템** - TypeScript 완전 적용
- [x] **보안** - 입력 검증, 경로 조작 방지
- [x] **프로젝트 대시보드** - `app/dashboard/page.tsx`
- [x] **문헌 자동 수집 모듈** - `src/literature/`
  - [x] BHL API 클라이언트 (`src/literature/bhl-client.ts`)
  - [x] Semantic Scholar API 클라이언트 (`src/literature/semantic-client.ts`)
  - [x] J-STAGE API 클라이언트 (`src/literature/jstage-client.ts`)
  - [x] CiNii API 클라이언트 (`src/literature/cinii-client.ts`)
  - [x] GBIF API 클라이언트 (`src/literature/gbif-client.ts`)
  - [x] OBIS API 클라이언트 (`src/literature/obis-client.ts`)
  - [x] 통합 수집기 (`src/literature/collector.ts`)
  - [x] Literature API 엔드포인트 (`app/api/literature/route.ts`)
- [x] **UI 문헌 자동 수집 연동** - 자동 수집 버튼 + 수동 업로드(보조)
- [x] **검색 전략 옵션** - 역사적 문헌(1700-1970) / 한국 기록 / 둘 다
- [x] **이명(synonym) 검색** - WoRMS에서 추출한 모든 이명으로 자동 검색

### 진행 중

- [ ] **자동 파이프라인** - 수집 → 분석 자동 연결

### 미구현 (TODO)

#### Phase 1: 문헌 자동 수집 (추가 소스)

> 상세 문서: [docs/LITERATURE_SOURCES.md](docs/LITERATURE_SOURCES.md)

| 우선순위 | 소스 | 구현 방식 | 용도 | 상태 |
|---------|------|----------|------|------|
| P0 | BHL API | REST API | 1800년대 원기재 논문 | ✅ **완료** |
| P0 | Semantic Scholar | REST API | 최신 영문 논문 | ✅ **완료** |
| P1 | J-STAGE | REST API | 일제강점기 일본어 논문 | ✅ **완료** |
| P1 | GBIF | REST API | 표본 데이터 검증 | ✅ **완료** |
| P1 | OBIS | REST API | 해양생물 분포 데이터 | ✅ **완료** |
| P2 | CiNii | REST API | 일본 학술지/학위논문 | ✅ **완료** |
| P3 | KCI | Playwright | 한국 학술지 (1998~) | ⚠️ 낮은 우선순위 |
| P3 | RISS | Playwright | 한국 학위논문 | ⚠️ 낮은 우선순위 |
| P4 | Paper Search MCP | MCP 서버 | Google Scholar 대안 | ⚠️ 낮은 우선순위 |

**소스별 역할:**
- **BHL**: 최초 기록 찾기의 핵심. 1800년대 원기재 논문
- **J-STAGE**: 일제강점기(1910-1945) 한국 해역 논문. 이 시기 논문이 최초 기록인 경우 많음
- **GBIF/OBIS**: 표본 데이터로 문헌 기록 검증. 때로는 문헌보다 더 오래된 표본 발견
- **Semantic Scholar**: 최신 논문으로 기존 기록 확인/보완
- **KCI/RISS**: 1998년 이후만 → 최초 기록 찾기에 부적합 (낮은 우선순위)

**한계점:**
- Google Scholar: ToS 위반으로 직접 스크래핑 불가 → Semantic Scholar로 대체
- BHL: **API 키 필수** (https://www.biodiversitylibrary.org/api2/key에서 발급)
- Semantic Scholar: Rate limit 있음, 주로 최신 논문만 제공 (역사적 문헌 부족)
- KCI/RISS: API 없음, 최초 기록에 부적합
- 유료 DB: 로그인 필요 시 수동 업로드로 fallback

#### Phase 2: 검토 UI

- [ ] 분석 결과 수정 기능
- [ ] Evidence 정보 입력 폼
- [ ] 신뢰도 수동 지정
- [ ] 문헌 제외/포함 토글

#### Phase 3: 결과 출력

- [ ] ZIP 다운로드 (엑셀 + PDF 묶음)
- [ ] 최초 기록 판정 결과 시각화
- [ ] 연도별 타임라인 뷰

#### Phase 4: 추가 기능

- [ ] 검색 결과 캐싱
- [ ] 국명(Korean name) DB 연동
- [ ] 검색 히스토리

---

## 기술적 TODO

### LLM 클라이언트
- [x] OpenRouter 제공자 추가
- [ ] 스트리밍 응답 지원
- [ ] 토큰 사용량 추적

### 문헌 수집
- [x] BHL API 클라이언트 (`src/literature/bhl-client.ts`)
- [x] Semantic Scholar 클라이언트 (`src/literature/semantic-client.ts`)
- [x] 통합 인터페이스 (`src/literature/index.ts`)
- [ ] J-STAGE API 클라이언트 (`src/literature/jstage-client.ts`)
- [ ] Paper Search MCP 연동

### UI/UX
- [x] 대시보드 페이지 (`app/dashboard/page.tsx`)
- [x] 문헌 자동 수집 UI (메인 페이지)
- [ ] 문헌 검토 페이지 개선
- [ ] 다크 모드

### 테스트
- [ ] E2E 테스트 (Docling + LLM 통합)
- [ ] API 단위 테스트
- [ ] 모의 데이터로 UI 테스트

---

## 변경 이력

### 2026-01-14 (4차)
- 대시보드에 **검색 전략** 탭 추가 (`app/dashboard/page.tsx`)
  - 검색 전략 (historical / korea / both) 시각화
  - 한국 관련 키워드 80+ 개를 카테고리별로 시각화
  - 이명(Synonym) 검색 설명 추가
  - 검색 흐름도 추가
- PROJECT_STATUS 업데이트 (BHL, Semantic Scholar → 완료)
- 키워드 카테고리 분류:
  - 영문 표기, 한글 표기
  - 일본어 표기 (식민지 시대)
  - 일본식 지명 (한자)
  - 해역/수역
  - 서양 고명 (Historical)
  - 일본식 로마자 지명
  - 현대 지명 (영문/한글)

### 2026-01-14 (3차)
- 검색 전략 옵션 추가 (`historical`, `korea`, `both`)
- 이명(synonym) 검색 기능 확인 및 개선
- 한국 관련 키워드 대폭 확장 (80+ 키워드)
  - 일본어 표기: 朝鮮, Chosen, Tyosen, 済州, 釜山 등
  - 서양 고명: Quelpart(제주), Dagelet(울릉도), Chemulpo(인천)
  - 식민지 시대 표기: Fuzan, Jinsen, Genzan, Kunsan 등
- BHL API 키 필수 처리 (명확한 에러 메시지)
- UI 수집 옵션 패널 추가 (소스, 전략, 연도, 결과 수)
- `.env.example` 파일 생성 (API 키 설정 안내)

### 2026-01-14 (2차)
- 문헌 자동 수집 모듈 완성 (`src/literature/`)
  - BHL API 클라이언트 구현
  - Semantic Scholar API 클라이언트 구현
  - 통합 수집기 및 API 엔드포인트 구현
- UI에 문헌 자동 수집 기능 연동
  - "문헌 자동 수집" 버튼 추가
  - 수집 진행 상황 표시
  - 수집된 문헌 목록 및 분석 UI
  - 수동 업로드는 보조 기능으로 변경
- OpenRouter LLM 제공자 추가 완료
- 대시보드 페이지 추가 (`app/dashboard/page.tsx`)

### 2026-01-14 (1차)
- CLAUDE.md에서 구현 상태 분리 → ROADMAP.md 생성
- 워크플로우를 7단계로 단순화
- 문헌 수집 자동화 방향 구체화 (MCP + REST API)
- OpenRouter 지원 계획 추가
