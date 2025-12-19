/**
 * LLM 연동 타입 정의
 */

// LLM 제공자
export type LLMProvider = 'ollama' | 'grok' | 'openai' | 'anthropic';

// LLM 설정
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;          // 클라우드 API용
  baseUrl?: string;         // Ollama 커스텀 URL
  temperature?: number;     // 0.0 - 1.0 (기본: 0.1)
  maxTokens?: number;       // 최대 토큰 수
  timeoutMs?: number;       // 요청 타임아웃 (기본: 60000ms)
  maxRetries?: number;      // 최대 재시도 횟수 (기본: 3)
  retryDelayMs?: number;    // 재시도 기본 딜레이 (기본: 1000ms, 지수 백오프)
}

// 기본 설정값
export const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  temperature: 0.1,         // 낮은 temperature로 일관된 결과
  maxTokens: 4096,
};

// 제공자별 기본 URL
export const PROVIDER_BASE_URLS: Record<LLMProvider, string> = {
  ollama: 'http://localhost:11434',
  grok: 'https://api.x.ai/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

// 문헌 분석 결과
export interface LiteratureAnalysisResult {
  // 한국 기록 여부
  hasKoreaRecord: boolean | null;
  confidence: number;           // 신뢰도 (0-1)

  // 추출된 정보
  locality?: string;            // 채집지 (예: "Busan, Korea")
  collectionDate?: string;      // 채집일 (예: "1998년 5월")
  specimenInfo?: string;        // 표본 정보
  collector?: string;           // 채집자

  // 근거
  relevantQuotes: string[];     // 관련 인용문
  reasoning: string;            // 판단 근거

  // 메타데이터
  processedAt: Date;
  modelUsed: string;
  tokensUsed?: number;
}

// 분석 요청
export interface AnalysisRequest {
  text: string;                 // PDF에서 추출한 텍스트
  scientificName: string;       // 검색 대상 학명
  synonyms?: string[];          // 이명 목록
  maxChunkSize?: number;        // 텍스트 청크 크기
}

// 분석 프롬프트 템플릿
export const ANALYSIS_PROMPT_TEMPLATE = `다음 학술 문헌 텍스트를 분석하여 한국에서의 해양생물 채집/서식 기록이 있는지 판단해주세요.

## 대상 학명
- 현재 유효명: {scientificName}
- 이명(동의어): {synonyms}

## 문헌 텍스트
{text}

## 분석 요청
다음 정보를 JSON 형식으로 추출해주세요:

1. hasKoreaRecord: 한국 기록 여부 (true/false/null)
   - true: 한국에서 직접 채집/관찰된 기록이 있음
   - false: 한국 기록이 명확히 없음
   - null: 불확실함

2. confidence: 판단 신뢰도 (0.0 ~ 1.0)

3. locality: 채집지 정보 (있는 경우)

4. collectionDate: 채집 날짜 (있는 경우)

5. specimenInfo: 표본 정보 (있는 경우)

6. collector: 채집자 (있는 경우)

7. relevantQuotes: 관련 문장 인용 (배열)

8. reasoning: 판단 근거 설명

## 주의사항
- 단순히 "분포: 한국" 같은 목록은 직접 채집 기록이 아닙니다.
- 실제 채집 정보(장소, 날짜, 표본)가 있는 경우만 true로 판단하세요.
- 인용/참고문헌 언급은 직접 기록이 아닙니다.
- 한국 지명: Korea, Corea, 한국, 조선, Busan, Jeju, Dokdo 등

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요:
\`\`\`json
{
  "hasKoreaRecord": true | false | null,
  "confidence": 0.0-1.0,
  "locality": "string or null",
  "collectionDate": "string or null",
  "specimenInfo": "string or null",
  "collector": "string or null",
  "relevantQuotes": ["quote1", "quote2"],
  "reasoning": "판단 근거 설명"
}
\`\`\``;

// LLM 응답 파싱 결과
export interface ParsedLLMResponse {
  hasKoreaRecord: boolean | null;
  confidence: number;
  locality: string | null;
  collectionDate: string | null;
  specimenInfo: string | null;
  collector: string | null;
  relevantQuotes: string[];
  reasoning: string;
}

// LLM 클라이언트 인터페이스
export interface ILLMClient {
  readonly provider: LLMProvider;
  readonly model: string;

  // 텍스트 생성
  generate(prompt: string): Promise<string>;

  // 문헌 분석
  analyzeLiterature(request: AnalysisRequest): Promise<LiteratureAnalysisResult>;

  // 연결 테스트
  testConnection(): Promise<boolean>;
}
