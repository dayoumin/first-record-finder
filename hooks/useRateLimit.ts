'use client';

import { useState, useCallback, useEffect } from 'react';
import type { RateLimitStatus, LLMSettings } from '@/types/species';

interface UseRateLimitReturn {
  status: RateLimitStatus | null;
  showWarning: boolean;
  dismissWarning: () => void;
  refresh: () => Promise<void>;
}

export function useRateLimit(llmSettings: LLMSettings): UseRateLimitReturn {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const refresh = useCallback(async () => {
    // OpenRouter 무료 모델 사용 시에만 체크
    if (
      llmSettings.provider !== 'openrouter' ||
      !llmSettings.model.endsWith(':free')
    ) {
      setStatus(null);
      setShowWarning(false);
      return;
    }

    try {
      const res = await fetch('/api/llm/usage');
      const data = await res.json();

      if (data.success) {
        setStatus(data);
        // 경고 임계치 도달 시 표시
        if (data.isWarning) {
          setShowWarning(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rate limit status:', error);
    }
  }, [llmSettings.provider, llmSettings.model]);

  // LLM 설정 변경 시 자동 갱신
  useEffect(() => {
    refresh();
  }, [refresh]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  return {
    status,
    showWarning,
    dismissWarning,
    refresh,
  };
}
