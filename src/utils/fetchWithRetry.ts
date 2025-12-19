/**
 * 429 에러 처리 및 재시도 로직을 포함한 fetch 유틸리티
 * (species_checker에서 가져옴)
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, delay: number) => void;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 60000,
    onRetry
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 429 Too Many Requests 처리
      if (response.status === 429) {
        if (attempt === maxRetries) {
          throw new Error(`Rate limit exceeded after ${maxRetries} attempts`);
        }

        // Retry-After 헤더 확인
        const retryAfter = response.headers.get('Retry-After');
        let delay: number;

        if (retryAfter) {
          delay = isNaN(Number(retryAfter))
            ? new Date(retryAfter).getTime() - Date.now()
            : Number(retryAfter) * 1000;
        } else {
          // Exponential backoff
          delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
        }

        console.log(`Rate limit hit. Waiting ${delay}ms before retry...`);
        onRetry?.(attempt, delay);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // 5xx 서버 에러도 재시도
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
        console.log(`Server error ${response.status}. Retrying in ${delay}ms...`);
        onRetry?.(attempt, delay);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;

    } catch (error) {
      lastError = error as Error;

      // 네트워크 에러 등도 재시도
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
        console.log(`Request failed: ${lastError.message}. Retrying in ${delay}ms...`);
        onRetry?.(attempt, delay);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed');
}

/**
 * API 호출 간 딜레이
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
