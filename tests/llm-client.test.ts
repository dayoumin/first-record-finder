/**
 * LLM 클라이언트 단위 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMClient, createLLMClient } from '../src/llm/client';
import { LLMConfig } from '../src/llm/types';

describe('LLMClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('타임아웃', () => {
    it('타임아웃 시 AbortError 발생', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        timeoutMs: 100, // 테스트용 짧은 타임아웃
        maxRetries: 0,  // 재시도 비활성화
      };

      // AbortError를 발생시키는 mock
      mockFetch.mockImplementation((_url: string, options: RequestInit) => {
        return new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, 50);

          // signal이 abort되면 즉시 reject
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
        });
      });

      const client = new LLMClient(config);

      await expect(client.generate('test')).rejects.toThrow(/timed out/);
    });

    it('타임아웃 전에 응답 시 정상 처리', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        timeoutMs: 5000,
        maxRetries: 0,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Hello!' }),
      });

      const client = new LLMClient(config);
      const result = await client.generate('test');

      expect(result).toBe('Hello!');
    });
  });

  describe('재시도 로직', () => {
    it('5xx 에러 시 재시도', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 2,
        retryDelayMs: 10, // 테스트 속도를 위해 짧게
      };

      // 처음 2번 실패, 3번째 성공
      mockFetch
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ response: 'Success!' }),
        });

      const client = new LLMClient(config);
      const result = await client.generate('test');

      expect(result).toBe('Success!');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('최대 재시도 후 에러 발생', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 2,
        retryDelayMs: 10,
      };

      mockFetch.mockRejectedValue(new Error('500 Internal Server Error'));

      const client = new LLMClient(config);

      await expect(client.generate('test')).rejects.toThrow(/500/);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 + 2 재시도
    });

    it('4xx 에러 시 재시도 안함', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 2,
        retryDelayMs: 10,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      const client = new LLMClient(config);

      await expect(client.generate('test')).rejects.toThrow(/400/);
      expect(mockFetch).toHaveBeenCalledTimes(1); // 재시도 없음
    });
  });

  describe('JSON 응답 파싱', () => {
    it('```json 블록 파싱', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 0,
      };

      const jsonResponse = '```json\n{"hasKoreaRecord": true, "confidence": 0.9, "reasoning": "Test"}\n```';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: jsonResponse }),
      });

      const client = new LLMClient(config);
      const result = await client.analyzeLiterature({
        text: 'Sample text',
        scientificName: 'Sebastes schlegelii',
      });

      expect(result.hasKoreaRecord).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    it('순수 JSON 객체 파싱', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 0,
      };

      const jsonResponse = '{"hasKoreaRecord": false, "confidence": 0.8, "reasoning": "No Korea record"}';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: jsonResponse }),
      });

      const client = new LLMClient(config);
      const result = await client.analyzeLiterature({
        text: 'Sample text',
        scientificName: 'Sebastes schlegelii',
      });

      expect(result.hasKoreaRecord).toBe(false);
      expect(result.confidence).toBe(0.8);
    });

    it('잘못된 JSON 시 기본값 반환', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 0,
      };

      const invalidResponse = 'This is not JSON';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: invalidResponse }),
      });

      const client = new LLMClient(config);
      const result = await client.analyzeLiterature({
        text: 'Sample text',
        scientificName: 'Sebastes schlegelii',
      });

      expect(result.hasKoreaRecord).toBeNull();
      expect(result.confidence).toBe(0.3);
      expect(result.reasoning).toContain('파싱 실패');
    });
  });

  describe('스키마 검증', () => {
    it('필수 필드 누락 시 경고 (기능은 동작)', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 0,
      };

      // confidence 필드 누락
      const jsonResponse = '{"hasKoreaRecord": true, "reasoning": "Test"}';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: jsonResponse }),
      });

      const client = new LLMClient(config);
      const result = await client.analyzeLiterature({
        text: 'Sample text',
        scientificName: 'Sebastes schlegelii',
      });

      expect(result.hasKoreaRecord).toBe(true);
      expect(result.confidence).toBe(0.5); // 기본값
    });

    it('relevantQuotes 배열 검증', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 0,
      };

      const jsonResponse = JSON.stringify({
        hasKoreaRecord: true,
        confidence: 0.9,
        relevantQuotes: ['Quote 1', 'Quote 2'],
        reasoning: 'Test',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: jsonResponse }),
      });

      const client = new LLMClient(config);
      const result = await client.analyzeLiterature({
        text: 'Sample text',
        scientificName: 'Sebastes schlegelii',
      });

      expect(result.relevantQuotes).toEqual(['Quote 1', 'Quote 2']);
    });
  });

  describe('API 키 검증', () => {
    it('OpenAI: API 키 없으면 에러', async () => {
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        // apiKey 없음
      };

      const client = new LLMClient(config);

      await expect(client.generate('test')).rejects.toThrow(/API key is required/);
    });

    it('Ollama: API 키 필요 없음', async () => {
      const config: LLMConfig = {
        provider: 'ollama',
        model: 'llama4',
        maxRetries: 0,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'OK' }),
      });

      const client = new LLMClient(config);
      const result = await client.generate('test');

      expect(result).toBe('OK');
    });
  });
});

describe('createLLMClient', () => {
  it('팩토리 함수로 클라이언트 생성', () => {
    const client = createLLMClient({
      provider: 'ollama',
      model: 'llama4',
    });

    expect(client.provider).toBe('ollama');
    expect(client.model).toBe('llama4');
  });
});
