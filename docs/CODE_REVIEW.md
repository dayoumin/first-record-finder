# PDF 분석 모듈 코드 리뷰

## 개요

한국 수산생물 최초기록 문헌 검색 시스템의 PDF 분석 모듈에 대한 코드 리뷰입니다.

- **리뷰 일자**: 2025-12-19
- **리뷰 범위**: LLM 클라이언트, Docling 클라이언트, PDF API 엔드포인트

---

## 파일 구조

```
src/
├── llm/
│   ├── types.ts          # LLM 타입 정의
│   ├── client.ts         # LLM 클라이언트 (Ollama, Grok, OpenAI, Anthropic)
│   └── index.ts          # 모듈 export
├── pdf/
│   ├── types.ts          # PDF/Docling 타입 정의
│   ├── docling-client.ts # Docling 클라이언트 (API + CLI)
│   └── index.ts          # 모듈 export

app/api/pdf/
├── upload/route.ts       # PDF 업로드 + 텍스트 추출 API
└── analyze/route.ts      # LLM 문헌 분석 API
```

---

## 1. src/llm/types.ts

### 역할
LLM 연동에 필요한 타입, 인터페이스, 프롬프트 템플릿 정의

### 주요 구성요소
- `LLMProvider`: 지원 제공자 (`ollama`, `grok`, `openai`, `anthropic`)
- `LLMConfig`: API 설정 (모델, API 키, base URL, temperature 등)
- `LiteratureAnalysisResult`: 문헌 분석 결과 구조
- `ANALYSIS_PROMPT_TEMPLATE`: 한국 기록 분석용 프롬프트

### ✅ 잘된 점
- 4개 LLM 제공자를 타입으로 명확히 정의
- 분석 결과에 필요한 필드 모두 포함 (locality, collectionDate, specimenInfo 등)
- 프롬프트에 JSON 응답 형식 명시로 파싱 용이

### ⚠️ 개선 고려사항
| 위치 | 이슈 | 심각도 | 설명 |
|------|------|--------|------|
| Line 49 | `processedAt: Date` | 낮음 | JSON 직렬화 시 문자열로 변환됨. `string` 타입 고려 |
| Line 99 | 한국 지명 예시 | 낮음 | 주요 도시 추가 권장 (Incheon, Ulsan, Gangneung 등) |

---

## 2. src/llm/client.ts

### 역할
4개 LLM 제공자에 대한 통합 클라이언트 구현

### 주요 구성요소
- `LLMClient`: 메인 클라이언트 클래스
- `generate()`: 텍스트 생성
- `analyzeLiterature()`: 문헌 분석 (프롬프트 생성 + 응답 파싱)
- `loadLLMConfigFromEnv()`: 환경변수 기반 설정 로드

### ✅ 잘된 점
- 제공자별 API 호출 로직 분리 (generateOllama, generateGrok 등)
- API 키 필수 검증 (클라우드 제공자)
- JSON 응답 파싱 실패 시 fallback 처리
- `parseBoolean`, `parseNumber` 헬퍼로 안전한 타입 변환

### ⚠️ 개선 고려사항
| 위치 | 이슈 | 심각도 | 설명 |
|------|------|--------|------|
| Line 211 | Anthropic API 버전 | 중간 | `2023-06-01`은 오래된 버전. 최신 확인 필요 |
| 전체 | 타임아웃 없음 | 중간 | LLM 응답 지연 시 무한 대기 가능. `AbortController` 추가 권장 |
| 전체 | 재시도 로직 없음 | 낮음 | 일시적 네트워크 오류 시 재시도 없음 |
| Line 241-243 | 텍스트 truncation | 낮음 | 단순 slice로 문장 중간에서 잘릴 수 있음 |

### 코드 예시 - 타임아웃 추가 권장
```typescript
// 현재
const response = await fetch(url, { method: 'POST', ... });

// 권장
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);
try {
  const response = await fetch(url, {
    method: 'POST',
    signal: controller.signal,
    ...
  });
} finally {
  clearTimeout(timeout);
}
```

---

## 3. src/pdf/types.ts

### 역할
PDF 처리 및 Docling 연동 타입 정의

### 주요 구성요소
- `DoclingResult`: PDF 추출 결과 (텍스트, 표, 그림)
- `ExtractedTable`: 추출된 표 구조
- `PDFProcessOptions`: 처리 옵션 (OCR, 언어, 페이지 제한)

### ✅ 잘된 점
- `ExtractedTable`에 `rawMarkdown` 포함 - LLM 분석에 유용
- 기본 OCR 언어에 한국어(`kor`) 포함
- `IPDFClient` 인터페이스로 구현 분리

### ⚠️ 개선 고려사항
| 위치 | 이슈 | 심각도 | 설명 |
|------|------|--------|------|
| Line 22 | `processedAt: Date` | 낮음 | JSON 직렬화 고려 필요 |

---

## 4. src/pdf/docling-client.ts

### 역할
Docling을 통한 PDF 텍스트/표 추출 (API 서버 + CLI 지원)

### 주요 구성요소
- `DoclingClient`: 메인 클라이언트 클래스
- `processViaAPI()`: Docker API 서버 연동
- `processViaCLI()`: Python CLI 직접 호출 (fallback)
- `tableToMarkdown()`: 표 → 마크다운 변환

### ✅ 잘된 점
- API 실패 시 CLI 자동 fallback
- `processBuffer()` 메서드로 메모리 버퍼 처리 가능
- 임시 파일 자동 정리
- 표를 마크다운으로 변환하여 LLM 분석에 유용

### ⚠️ 개선 고려사항
| 위치 | 이슈 | 심각도 | 설명 |
|------|------|--------|------|
| ~~Line 207~~ | ~~`process` 변수명~~ | ~~높음~~ | ✅ **수정 완료** - `childProcess`로 변경 |
| Line 143 | `data.document!` | 중간 | non-null assertion. null 체크 권장 |
| Line 188 | 출력 디렉토리 | 낮음 | PDF 위치에 `.docling_output` 생성. 임시 디렉토리 권장 |
| Line 282-283 | CLI 파싱 | 낮음 | tables, figures가 항상 빈 배열. 실제 파싱 미구현 |
| 전체 | CLI 타임아웃 없음 | 중간 | 대용량 PDF 처리 시 무한 대기 가능 |

---

## 5. app/api/pdf/upload/route.ts

### 역할
PDF 파일 업로드 및 Docling 텍스트 추출 API

### API 스펙
- **POST /api/pdf/upload**: PDF 업로드 + 텍스트 추출
- **GET /api/pdf/upload**: 업로드된 PDF 목록 조회

### ✅ 잘된 점
- FormData로 파일 업로드 지원
- PDF 확장자 검증
- 파일명 sanitization (특수문자 제거)
- Docling 실패해도 파일은 저장
- GET 메서드로 업로드 목록 조회 가능

### ⚠️ 개선 고려사항
| 위치 | 이슈 | 심각도 | 설명 |
|------|------|--------|------|
| 전체 | 파일 크기 제한 없음 | 중간 | 대용량 PDF 업로드 시 메모리 문제 가능 |
| Line 54 | `safeFileName` 빈 문자열 가능 | 낮음 | 파일명이 모두 특수문자인 경우 |

### 코드 예시 - 파일 크기 제한 추가 권장
```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { success: false, error: 'File too large. Max 50MB allowed.' },
    { status: 413 }
  );
}
```

---

## 6. app/api/pdf/analyze/route.ts

### 역할
LLM을 사용한 PDF 텍스트 한국 기록 분석 API

### API 스펙
- **POST /api/pdf/analyze**: 텍스트 분석 요청

### 요청 파라미터
```typescript
{
  pdfId?: string;           // 이전 추출 결과 ID
  text?: string;            // 직접 텍스트 전달
  scientificName: string;   // 대상 학명 (필수)
  synonyms?: string[];      // 이명 목록
  llmConfig?: LLMConfig;    // LLM 설정 (선택)
}
```

### ✅ 잘된 점
- `pdfId` 또는 `text` 두 가지 방식 모두 지원
- 환경변수 기반 LLM 설정 fallback
- 분석 결과 자동 저장
- 상세한 에러 응답 (제공자, 모델 정보 포함)

### ⚠️ 개선 고려사항
| 위치 | 이슈 | 심각도 | 설명 |
|------|------|--------|------|
| Line 27-34 | body 파싱 에러 | 낮음 | 잘못된 JSON 전송 시 처리 없음 |
| 전체 | 요청 크기 제한 없음 | 낮음 | 매우 긴 텍스트 전달 시 문제 가능 |

---

## 종합 평가

### 전체 상태: ✅ 양호 (보안 및 안정성 개선 완료)

| 파일 | 상태 | 비고 |
|------|------|------|
| src/llm/types.ts | ✅ 개선됨 | timeoutMs, maxRetries, retryDelayMs 추가 |
| src/llm/client.ts | ✅ 개선됨 | 타임아웃, 재시도, JSON 스키마 검증 추가 |
| src/llm/index.ts | ✅ 양호 | - |
| src/pdf/types.ts | ✅ 양호 | - |
| src/pdf/docling-client.ts | ✅ 개선됨 | 타임아웃 추가 (API: 5분, CLI: 10분) |
| src/pdf/index.ts | ✅ 양호 | - |
| app/api/pdf/upload/route.ts | ✅ 개선됨 | 파일 크기(50MB), MIME 검사, 경로 조작 방지 |
| app/api/pdf/analyze/route.ts | ✅ 개선됨 | 입력 검증 강화, 경로 조작 방지 |

### 우선순위별 개선 사항

#### 높음 (보안/안정성)
- [x] ~~docling-client.ts: `process` 변수명 충돌~~ ✅ 수정 완료
- [x] ~~PDF MIME/시그니처 검사 없음~~ ✅ 수정 완료 (magic bytes 검증)
- [x] ~~경로 조작 방지~~ ✅ 수정 완료 (sanitizeFileName, path.resolve 검증)

#### 중간 (안정성/UX)
- [x] ~~LLM 클라이언트에 타임아웃 추가~~ ✅ 수정 완료 (60초, AbortController)
- [x] ~~PDF 업로드 파일 크기 제한 추가~~ ✅ 수정 완료 (50MB)
- [x] ~~Docling CLI 실행에 타임아웃 추가~~ ✅ 수정 완료 (10분)
- [x] ~~LLM/Docling API 재시도 로직 없음~~ ✅ 수정 완료 (지수 백오프)
- [x] ~~JSON 스키마 검증 없음~~ ✅ 수정 완료 (validateResponseSchema)
- [x] ~~입력 검증 미흡~~ ✅ 수정 완료 (pdfId, scientificName, text)

#### 낮음 (개선) - 미완료
- [ ] 한국 지명 목록 확장
- [ ] 텍스트 truncation 시 문장 경계 고려
- [ ] Anthropic API 버전 업데이트 확인

---

## 테스트 계획

### 1. LLM 클라이언트 테스트
```bash
# Ollama 연결 테스트
curl http://localhost:11434/api/tags

# LLM 분석 테스트 (Ollama)
curl -X POST http://localhost:3001/api/pdf/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This species was collected from Busan, Korea in 1998.",
    "scientificName": "Sebastes schlegelii"
  }'
```

### 2. Docling 클라이언트 테스트
```bash
# Docling CLI 확인
python -m docling --version

# PDF 업로드 테스트
curl -X POST http://localhost:3001/api/pdf/upload \
  -F "file=@test.pdf" \
  -F "speciesName=Sebastes schlegelii"
```

### 3. 통합 테스트
1. PDF 업로드 → 텍스트 추출
2. 추출된 텍스트로 LLM 분석
3. 결과 확인

---

## 2차 리뷰 피드백 반영 (추가 발견 이슈)

### 보안 관련

| 이슈 | 심각도 | 상태 | 설명 |
|------|--------|------|------|
| MIME/시그니처 검사 없음 | 높음 | ✅ 해결 | `isPdfSignature()` 함수로 magic bytes 검증 |
| 경로 조작 방지 | 중간 | ✅ 해결 | `sanitizeFileName()` + `path.resolve()` 검증 |
| 파일명 중복 처리 | 낮음 | ✅ 해결 | 타임스탬프 기반 + sanitized 파일명 조합 |
| 임시 디렉토리 권한/정리 | 중간 | 미해결 | `.docling_output` 정리 정책 필요 |

### 안정성 관련

| 이슈 | 심각도 | 상태 | 설명 |
|------|--------|------|------|
| Retry/Backoff 없음 | 중간 | ✅ 해결 | 지수 백오프 재시도 로직 추가 (최대 3회) |
| Circuit Breaker 없음 | 낮음 | 미해결 | 외부 서비스 장애 시 연쇄 실패 가능 |
| AbortController 미사용 | 중간 | ✅ 해결 | LLM/Docling API 모두 타임아웃 적용 |

### 입력 검증 관련

| 이슈 | 심각도 | 상태 | 설명 |
|------|--------|------|------|
| pdfId 검증 | 낮음 | ✅ 해결 | 길이/패턴 검증 추가 |
| scientificName 검증 | 낮음 | ✅ 해결 | 길이/패턴 검증 추가 |
| text 길이 제한 | 중간 | ✅ 해결 | 500KB 제한 추가 |

### 프롬프트/LLM 관련

| 이슈 | 심각도 | 상태 | 설명 |
|------|--------|------|------|
| JSON 스키마 검증 없음 | 중간 | ✅ 해결 | `validateResponseSchema()` 추가 |
| 프롬프트 인젝션 | 낮음 | 부분 해결 | scientificName 패턴 검증 추가 |

### 관측성 관련

| 이슈 | 심각도 | 상태 | 설명 |
|------|--------|------|------|
| 메트릭 수집 없음 | 낮음 | 미해결 | API 지연시간, 실패율 측정 불가 |
| 구조화된 로깅 없음 | 낮음 | 미해결 | console.log 기반, 검색/분석 어려움 |

---

## 추가 리뷰 요청 사항

### 기존 질문 (세부사항 추가)

1. **에러 처리 전략**: 현재 try-catch로 기본 처리 중. 더 세분화된 에러 타입 필요?
   - 에러 분류: 사용자 입력 오류 / 외부 API 오류 / 내부 예외
   - 에러 코드 정책: HTTP status + 애플리케이션 error code 조합

2. **로깅 전략**: console.log/warn/error 사용 중. 구조화된 로깅 라이브러리 도입?
   - PII 마스킹 필요 여부
   - 요청/응답 크기 제한
   - 샘플링 기준

3. **테스트 코드**: 현재 테스트 없음. 단위 테스트 / 통합 테스트 범위 권장?
   - 외부 API mock 계약 테스트
   - 회귀 테스트용 fixture PDF 관리

4. **성능 최적화**: 대용량 PDF (100페이지+) 처리 시 고려사항?
   - 동시성: 큐잉, 동시 요청 제한
   - 메모리 상한 설정
   - 임시파일 정리 주기

### 추가 질문 (2차 리뷰 피드백)

5. **보안 리스크**: 이 설계에서 가장 큰 보안 리스크와 완화책은?

6. **Fallback 설계**: LLM/Docling 장애 시 사용자 경험을 해치지 않는 fallback 설계는?

7. **리소스 병목**: 대용량 PDF 처리 시 메모리/디스크/CPU 병목 포인트와 상한 설정은?

8. **데이터 정책**: 데이터 보관/삭제 정책(개인정보/저작권 포함)에 대한 권고는?

---

## 추가 질문 답변 (2025-12-19)

### Q5. 보안 리스크와 완화책

| 리스크 | 심각도 | 현재 상태 | 완화책 |
|--------|--------|-----------|--------|
| **파일 업로드 공격** | 높음 | ✅ 완화됨 | magic bytes 검증, 50MB 크기 제한, 경로 조작 방지 |
| **프롬프트 인젝션** | 중간 | ⚠️ 부분 완화 | scientificName 패턴 검증. 추가로 text 필드에서 제어문자 필터링 고려 |
| **DoS (대용량 요청)** | 중간 | ✅ 완화됨 | 파일 50MB, 텍스트 500KB 제한, 타임아웃 적용 |
| **민감정보 노출** | 낮음 | ⚠️ 주의 필요 | API 키는 서버 측만 사용. 에러 응답에서 내부 경로 노출 주의 |

**권고**: 프로덕션 배포 전 `helmet` 미들웨어 적용, CSP 헤더 설정, rate limiting 추가

### Q6. Fallback 설계

```
LLM 장애 시 Fallback 체인:
┌─────────────────────────────────────────────────────────────┐
│ 1. Primary LLM (설정된 제공자)                               │
│    ↓ 실패 (3회 재시도 후)                                    │
│ 2. Ollama (로컬) - 네트워크 독립적                           │
│    ↓ 실패                                                   │
│ 3. 수동 검토 모드 - 텍스트만 표시, 사용자가 직접 판단         │
└─────────────────────────────────────────────────────────────┘

Docling 장애 시 Fallback 체인:
┌─────────────────────────────────────────────────────────────┐
│ 1. Docling API (Docker 서버)                                │
│    ↓ 실패                                                   │
│ 2. Docling CLI (로컬 Python) - 현재 구현됨                   │
│    ↓ 실패                                                   │
│ 3. pdf-parse 라이브러리 (기본 텍스트 추출만)                 │
│    ↓ 실패                                                   │
│ 4. 수동 업로드 모드 - PDF 저장, 나중에 재처리                │
└─────────────────────────────────────────────────────────────┘
```

**현재 구현 상태**: Docling API→CLI fallback 구현됨. LLM fallback 체인 미구현.

### Q7. 리소스 병목 및 상한 설정

| 리소스 | 병목 포인트 | 권장 상한 | 현재 상태 |
|--------|-------------|-----------|-----------|
| **메모리** | PDF 버퍼 로딩, LLM 응답 | 프로세스당 1GB | 미설정 |
| **디스크** | PDF 저장, Docling 출력 | 10GB | 미설정 |
| **CPU** | Docling OCR 처리 | 동시 2-3개 | 미제한 |
| **시간** | LLM API 응답 | 60초 (LLM), 10분 (CLI) | ✅ 설정됨 |

**권고 사항**:
1. 동시 처리 제한: `p-limit` 라이브러리로 동시 PDF 처리 2개 제한
2. 임시 파일 정리: 24시간 이상 된 `.docling_output` 자동 삭제 cron job
3. 메모리 상한: Docker 컨테이너 배포 시 `--memory=1g` 옵션

### Q8. 데이터 보관/삭제 정책 권고

```
┌────────────────────────────────────────────────────────────────┐
│ 데이터 유형          │ 보관 기간   │ 삭제 방법                  │
├────────────────────────────────────────────────────────────────┤
│ 업로드된 PDF         │ 30일       │ 자동 삭제 또는 사용자 요청  │
│ 추출된 텍스트        │ 30일       │ PDF와 함께 삭제            │
│ LLM 분석 결과        │ 90일       │ 익명화 후 통계용 보관 가능  │
│ 검색 기록            │ 90일       │ 자동 삭제                  │
│ 내보낸 엑셀          │ 7일        │ 다운로드 후 즉시 삭제 권장  │
└────────────────────────────────────────────────────────────────┘
```

**저작권 고려사항**:
- 학술 문헌 PDF는 저작권 보호 대상일 수 있음
- **권고**: "일시적 복제" 원칙 - 분석 완료 후 원본 PDF 삭제
- 텍스트 추출물은 "인용" 수준으로 제한 (전체 복제 지양)
- 결과물에 출처 표기 자동 포함

**개인정보 고려사항**:
- 저자명, 이메일 등이 PDF에 포함될 수 있음
- LLM 분석 시 개인정보는 추출 대상이 아님을 프롬프트에 명시
- 로그에 파일명(개인정보 포함 가능) 마스킹 고려

---

## 단위 테스트 결과 (2025-12-19)

```
 ✓ tests/pdf-upload-security.test.ts (20 tests)
 ✓ tests/input-validation.test.ts (21 tests)
 ✓ tests/llm-client.test.ts (13 tests)

 Test Files  3 passed (3)
      Tests  54 passed (54)
```

### 테스트 커버리지
- **LLM 클라이언트**: 타임아웃, 재시도 로직, JSON 파싱, 스키마 검증, API 키 검증
- **PDF 업로드 보안**: PDF 시그니처 검증, 파일명 sanitization, 경로 조작 방지, 크기 제한
- **입력 검증**: pdfId, scientificName, text, synonyms 필드별 검증
