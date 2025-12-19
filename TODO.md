# TODO - First Record Finder

## 우선순위 1: 통합 테스트
- [ ] PDF 업로드 → Docling 추출 → LLM 분석 E2E 테스트
- [ ] Ollama 로컬 서버 연결 테스트
- [ ] 각 LLM 제공자별 연동 테스트 (Grok, OpenAI, Anthropic)

## 우선순위 2: 6단계 (문헌 검토) UI
- [ ] 분석 결과 수동 수정 기능
- [ ] 한국 기록 여부 직접 판정 버튼
- [ ] 증거 정보 입력 폼 (채집지, 날짜, 표본)
- [ ] 원문 인용 입력

## 우선순위 3: 7-8단계 (최초 기록 판정 및 내보내기)
- [ ] 분석 완료된 문헌 연도순 정렬
- [ ] 최초 기록 후보 확정 UI
- [ ] 최종 엑셀 내보내기 (분석 결과 포함)

## 우선순위 4: 미완료 개선사항 (CODE_REVIEW.md)
- [ ] 한국 지명 목록 확장 (Incheon, Ulsan, Gangneung 등)
- [ ] pdf-parse fallback 구현 (Docling 실패 시)
- [ ] 임시 디렉토리(.docling_output) 정리 정책
- [ ] 텍스트 truncation 시 문장 경계 고려
- [ ] Anthropic API 버전 업데이트 확인

## 우선순위 5: 프로덕션 준비
- [ ] helmet 미들웨어 적용
- [ ] CSP 헤더 설정
- [ ] Rate limiting 추가
- [ ] 구조화된 로깅 (winston/pino)
- [ ] 메트릭 수집 (Prometheus)
- [ ] Circuit Breaker 패턴

## 완료된 항목 (2025-12-19)
- [x] LLM 타임아웃 (60초, AbortController)
- [x] PDF 크기 제한 (50MB)
- [x] PDF magic bytes 검증
- [x] 경로 조작 방지 (sanitizeFileName)
- [x] 재시도 로직 (지수 백오프, 최대 3회)
- [x] JSON 스키마 검증
- [x] 입력 검증 강화 (pdfId, scientificName, text)
- [x] Docling CLI 타임아웃 (10분)
- [x] 단위 테스트 54개
- [x] PDF 업로드 UI
- [x] LLM 분석 UI 연동
- [x] 분석 결과 표시 UI
- [x] 워크플로우 단계 로직 업데이트
