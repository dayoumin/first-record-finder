# AI 도구 및 PDF 분석 도구 평가

## 1. AI Agent 프레임워크 (CrewAI 등)

### 개요
CrewAI, LangChain Agents, AutoGPT 등 멀티스텝 AI 자동화 프레임워크

### 장점
- 복잡한 멀티스텝 작업 자동화
- 문헌 검색 → 내용 분석 → 판정까지 체인 구성 가능
- 여러 AI 에이전트 협업 가능

### 단점
- 오버엔지니어링 가능성 높음
- 현재 작업은 "반자동"이 적절 (최종 판단은 사람이 해야 함)
- API 비용 발생 (GPT-4 등 사용 시)
- 학습 곡선 있음

### 결론
```
현재 단계: ❌ 불필요
향후 고려: 대량 자동화 필요 시 검토

이유:
1. 최초기록 판정은 전문가 검토가 필수
2. 현재 워크플로우는 수동 검토 + 기록이 핵심
3. 자동화보다 편리한 UI가 더 중요
```

---

## 2. PDF 분석 도구

### 현재 설치된 도구: pdf-parse

```javascript
// 단순 텍스트 추출
const pdf = require('pdf-parse');
const text = await pdf(buffer);
console.log(text.text);  // 전체 텍스트
```

**장점**: 간단, 가벼움
**단점**: 페이지 구분 불명확, 테이블 구조 손실

### 권장 도구: Docling

```
Docling: IBM에서 개발한 학술 문서 변환 도구
- 학술 논문 PDF 구조 인식에 특화
- 테이블, 그림, 텍스트 분리 추출
- 페이지별 텍스트 추출 용이
- JSON/Markdown 출력 지원
```

### 비교

| 기능 | pdf-parse | Docling |
|------|-----------|---------|
| 텍스트 추출 | ✅ | ✅ |
| 페이지 구분 | ⚠️ 불명확 | ✅ 정확 |
| 테이블 추출 | ❌ | ✅ |
| 논문 구조 인식 | ❌ | ✅ (섹션, 참고문헌 등) |
| 설치 | npm install | pip install (Python) |
| 속도 | 빠름 | 중간 |

### 실제 차이 예시

```
원문 PDF (234페이지):
  "Sebastes schlegelii는 부산에서 채집되었다.
   표본번호: NIBR-P-12345"

pdf-parse 결과:
  "Sebastes schlegelii는 부산에서 채집되었다. 표본번호: NIBR-P-12345"
  (페이지 정보 없음)

Docling 결과:
  {
    "page": 234,
    "section": "Materials and Methods",
    "text": "Sebastes schlegelii는 부산에서 채집되었다.",
    "tables": [
      { "caption": "Table 1. Specimen list",
        "data": [["NIBR-P-12345", "Sebastes schlegelii", "Busan"]] }
    ]
  }
```

### 결론

```
현재 단계: pdf-parse 유지 (이미 설치됨)
향후 업그레이드: Docling 권장

이유:
1. 학술 논문에서 특정 학명이 언급된 페이지 정확히 추출 가능
2. 표본 정보가 테이블에 있는 경우 자동 추출 가능
3. "234페이지에 채집 기록 있음" 형태로 결과 제공 가능
```

### Docling 설치 방법 (향후)

```bash
# Python 환경 필요
pip install docling

# 또는 Docker
docker pull ds4sd/docling
```

```python
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("paper.pdf")

for page in result.pages:
    print(f"Page {page.page_no}: {page.text[:100]}...")
```

---

## 3. 기타 도구

### LLM 활용 (향후)

문헌 내용에서 서식 근거를 자동 판정하는 데 LLM 활용 가능:

```
입력: "Sebastes schlegelii는 1998년 5월 부산에서 채집되었다"

LLM 분석 결과:
{
  "has_korea_record": true,
  "locality": "부산",
  "date": "1998년 5월",
  "confidence": "high",
  "reason": "구체적 채집 장소와 날짜 명시"
}
```

**현재**: 불필요 (수동 검토가 더 정확)
**향후**: 대량 처리 시 1차 필터링용으로 고려

---

## 요약

| 도구 | 현재 필요성 | 향후 권장 |
|------|------------|----------|
| CrewAI 등 AI Agent | ❌ 불필요 | 대량 자동화 시 검토 |
| pdf-parse | ✅ 사용 중 | 기본 기능용 유지 |
| Docling | 🔜 권장 | PDF 분석 업그레이드 시 |
| LLM (GPT 등) | ❌ 불필요 | 1차 필터링용 고려 |

---

*작성일: 2024-12*
