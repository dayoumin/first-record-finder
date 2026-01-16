/**
 * LLM 클라이언트 구현
 *
 * Ollama, Grok, OpenAI, Anthropic 지원
 */

import {
  LLMConfig,
  LLMProvider,
  ILLMClient,
  AnalysisRequest,
  LiteratureAnalysisResult,
  ParsedLLMResponse,
  ANALYSIS_PROMPT_TEMPLATE,
  DEFAULT_LLM_CONFIG,
  PROVIDER_BASE_URLS,
} from './types';
import { getRateLimiter, RateLimitStatus } from './rate-limiter';

/** 기본 타임아웃 (60초) */
const DEFAULT_TIMEOUT_MS = 60000;

/** 기본 재시도 설정 */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

/** 타임아웃 에러 */
class LLMTimeoutError extends Error {
  constructor(provider: string, timeoutMs: number) {
    super(`LLM request to ${provider} timed out after ${timeoutMs}ms`);
    this.name = 'LLMTimeoutError';
  }
}

/** Rate Limit 초과 에러 */
export class RateLimitExceededError extends Error {
  constructor(public readonly status: RateLimitStatus) {
    super(`OpenRouter 일일 사용량 초과: ${status.used}/${status.limit}회 사용. 리셋 시간: ${status.resetsAt}`);
    this.name = 'RateLimitExceededError';
  }
}

/** 재시도 가능한 에러인지 판단 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMTimeoutError) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // 네트워크 오류, 서버 오류(5xx), rate limit
    return (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('socket') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('429') ||
      message.includes('rate limit')
    );
  }
  return false;
}

/** 지수 백오프 딜레이 계산 */
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attempt);
}

/** 딜레이 유틸리티 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * LLM 클라이언트
 */
export class LLMClient implements ILLMClient {
  readonly provider: LLMProvider;
  readonly model: string;
  private config: LLMConfig;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.config = {
      ...DEFAULT_LLM_CONFIG,
      ...config,
      baseUrl: config.baseUrl || PROVIDER_BASE_URLS[config.provider],
    };
  }

  /**
   * 타임아웃이 적용된 fetch 요청
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMTimeoutError(this.provider, this.timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 텍스트 생성 (재시도 로직 포함)
   */
  async generate(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.generateOnce(prompt);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries && isRetryableError(error)) {
          const backoffMs = calculateBackoffDelay(attempt, this.retryDelayMs);
          console.warn(
            `[LLM] Request failed (attempt ${attempt + 1}/${this.maxRetries + 1}), ` +
            `retrying in ${backoffMs}ms: ${lastError.message}`
          );
          await delay(backoffMs);
        } else {
          break;
        }
      }
    }

    throw lastError || new Error('LLM request failed');
  }

  /**
   * 단일 생성 요청 (재시도 없음)
   */
  private async generateOnce(prompt: string): Promise<string> {
    switch (this.provider) {
      case 'ollama':
        return this.generateOllama(prompt);
      case 'openrouter':
        return this.generateOpenRouter(prompt);
      case 'grok':
        return this.generateGrok(prompt);
      case 'openai':
        return this.generateOpenAI(prompt);
      case 'anthropic':
        return this.generateAnthropic(prompt);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  /**
   * 문헌 분석
   */
  async analyzeLiterature(request: AnalysisRequest): Promise<LiteratureAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(request);

    try {
      const response = await this.generate(prompt);
      const parsed = this.parseAnalysisResponse(response);

      return {
        hasKoreaRecord: parsed.hasKoreaRecord,
        confidence: parsed.confidence,
        locality: parsed.locality || undefined,
        collectionDate: parsed.collectionDate || undefined,
        specimenInfo: parsed.specimenInfo || undefined,
        collector: parsed.collector || undefined,
        relevantQuotes: parsed.relevantQuotes,
        reasoning: parsed.reasoning,
        processedAt: new Date(),
        modelUsed: `${this.provider}/${this.model}`,
        // 디버깅 정보 추가
        debug: {
          inputTextPreview: request.text.slice(0, 500),
          inputTextLength: request.text.length,
          rawResponse: response.slice(0, 2000),  // 응답도 길면 잘라냄
          promptUsed: prompt.slice(0, 1000),     // 프롬프트 앞부분만
        },
      };
    } catch (error) {
      console.error('[LLM] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generate('Say "OK" if you can read this.');
      return response.toLowerCase().includes('ok');
    } catch (error) {
      console.error('[LLM] Connection test failed:', error);
      return false;
    }
  }

  // ============================================================
  // 제공자별 구현
  // ============================================================

  /**
   * Ollama API 호출
   */
  private async generateOllama(prompt: string): Promise<string> {
    const url = `${this.config.baseUrl}/api/generate`;

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * OpenRouter API 호출 (OpenAI 호환)
   * - 무료 모델 사용 시 Rate Limit 체크
   */
  private async generateOpenRouter(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    // 무료 모델(:free)인 경우 rate limit 체크
    if (this.model.endsWith(':free')) {
      const rateLimiter = getRateLimiter();
      if (!rateLimiter.canMakeRequest()) {
        throw new RateLimitExceededError(rateLimiter.getStatus());
      }
      // 사용량 증가
      rateLimiter.incrementUsage();
    }

    const url = `${this.config.baseUrl}/chat/completions`;

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://first-record-finder.local',
        'X-Title': 'First Record Finder',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Grok (xAI) API 호출
   */
  private async generateGrok(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Grok API key is required');
    }

    const url = `${this.config.baseUrl}/chat/completions`;

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * OpenAI API 호출
   */
  private async generateOpenAI(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const url = `${this.config.baseUrl}/chat/completions`;

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Anthropic API 호출
   */
  private async generateAnthropic(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const url = `${this.config.baseUrl}/messages`;

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  /**
   * 분석 프롬프트 생성
   */
  private buildAnalysisPrompt(request: AnalysisRequest): string {
    const { text, scientificName, synonyms = [] } = request;

    // 텍스트가 너무 길면 청크로 나누기
    const maxChunkSize = request.maxChunkSize || 8000;
    const truncatedText = text.length > maxChunkSize
      ? text.slice(0, maxChunkSize) + '\n\n[... 텍스트 일부 생략 ...]'
      : text;

    return ANALYSIS_PROMPT_TEMPLATE
      .replace('{scientificName}', scientificName)
      .replace('{synonyms}', synonyms.length > 0 ? synonyms.join(', ') : '없음')
      .replace('{text}', truncatedText);
  }

  /**
   * LLM 응답 파싱 (스키마 검증 포함)
   */
  private parseAnalysisResponse(response: string): ParsedLLMResponse {
    // JSON 블록 추출 시도 (여러 패턴 지원)
    let jsonStr = response;

    // 패턴 1: ```json ... ```
    const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    } else {
      // 패턴 2: ``` ... ```
      const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        // 패턴 3: { ... } 형태의 JSON 객체 찾기
        const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0];
        }
      }
    }

    try {
      // JSON 파싱 시도
      const parsed = JSON.parse(jsonStr.trim());

      // 스키마 검증
      const validationResult = this.validateResponseSchema(parsed);
      if (!validationResult.valid) {
        console.warn('[LLM] Schema validation warnings:', validationResult.warnings);
      }

      return {
        hasKoreaRecord: this.parseBoolean(parsed.hasKoreaRecord),
        confidence: this.parseNumber(parsed.confidence, 0, 1) ?? 0.5,
        locality: this.parseString(parsed.locality, 500),
        collectionDate: this.parseString(parsed.collectionDate, 100),
        specimenInfo: this.parseString(parsed.specimenInfo, 500),
        collector: this.parseString(parsed.collector, 200),
        relevantQuotes: this.parseStringArray(parsed.relevantQuotes, 10, 1000),
        reasoning: this.parseString(parsed.reasoning, 2000) || '판단 근거 없음',
      };
    } catch (parseError) {
      // JSON 파싱 실패 시 기본값 반환
      console.warn('[LLM] Failed to parse JSON response:', parseError);

      return {
        hasKoreaRecord: null,
        confidence: 0.3,
        locality: null,
        collectionDate: null,
        specimenInfo: null,
        collector: null,
        relevantQuotes: [],
        reasoning: `파싱 실패. 원본 응답: ${response.slice(0, 300)}...`,
      };
    }
  }

  /**
   * 응답 스키마 검증
   */
  private validateResponseSchema(parsed: unknown): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, warnings: ['Response is not an object'] };
    }

    const obj = parsed as Record<string, unknown>;

    // 필수 필드 검증
    if (!('hasKoreaRecord' in obj)) {
      warnings.push('Missing field: hasKoreaRecord');
    }
    if (!('confidence' in obj)) {
      warnings.push('Missing field: confidence');
    }
    if (!('reasoning' in obj)) {
      warnings.push('Missing field: reasoning');
    }

    // 타입 검증
    if ('hasKoreaRecord' in obj) {
      const val = obj.hasKoreaRecord;
      if (val !== null && val !== true && val !== false && val !== 'true' && val !== 'false') {
        warnings.push(`Invalid type for hasKoreaRecord: ${typeof val}`);
      }
    }

    if ('confidence' in obj) {
      const val = Number(obj.confidence);
      if (isNaN(val) || val < 0 || val > 1) {
        warnings.push(`Invalid confidence value: ${obj.confidence}`);
      }
    }

    if ('relevantQuotes' in obj && !Array.isArray(obj.relevantQuotes)) {
      warnings.push('relevantQuotes should be an array');
    }

    return { valid: warnings.length === 0, warnings };
  }

  /**
   * 문자열 파싱 (최대 길이 제한)
   */
  private parseString(value: unknown, maxLength: number): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') {
      // 문자열이 아니면 변환 시도
      const str = String(value);
      return str.slice(0, maxLength);
    }
    return value.slice(0, maxLength);
  }

  /**
   * 문자열 배열 파싱 (개수 및 길이 제한)
   */
  private parseStringArray(value: unknown, maxItems: number, maxItemLength: number): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .slice(0, maxItems)
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.slice(0, maxItemLength));
  }

  /**
   * boolean 파싱 (null 허용)
   */
  private parseBoolean(value: unknown): boolean | null {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return null;
  }

  /**
   * 숫자 파싱 (범위 제한)
   */
  private parseNumber(value: unknown, min: number, max: number): number | null {
    const num = Number(value);
    if (isNaN(num)) return null;
    return Math.max(min, Math.min(max, num));
  }
}

/**
 * LLM 클라이언트 팩토리
 */
export function createLLMClient(config: LLMConfig): ILLMClient {
  return new LLMClient(config);
}

/**
 * 환경 변수에서 LLM 설정 로드
 */
export function loadLLMConfigFromEnv(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'ollama') as LLMProvider;

  switch (provider) {
    case 'ollama':
      return {
        provider: 'ollama',
        model: process.env.OLLAMA_MODEL || 'llama4',
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
      };

    case 'grok':
      return {
        provider: 'grok',
        model: process.env.GROK_MODEL || 'grok-4.1',
        apiKey: process.env.GROK_API_KEY,
      };

    case 'openrouter':
      return {
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        apiKey: process.env.OPENROUTER_API_KEY,
      };

    case 'openai':
      return {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-5.2',
        apiKey: process.env.OPENAI_API_KEY,
      };

    case 'anthropic':
      return {
        provider: 'anthropic',
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-4.5',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };

    default:
      return {
        provider: 'ollama',
        model: 'llama4',
      };
  }
}
