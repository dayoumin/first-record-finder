'use client';

import { X, AlertTriangle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RateLimitStatus } from '@/types/species';

interface RateLimitBannerProps {
  status: RateLimitStatus;
  onDismiss: () => void;
}

export function RateLimitBanner({ status, onDismiss }: RateLimitBannerProps) {
  const resetDate = new Date(status.resetsAt).toLocaleString('ko-KR', {
    timeZone: 'UTC',
  });

  return (
    <div
      className={cn(
        'relative px-4 py-3 flex items-center gap-3 text-sm',
        status.isExceeded
          ? 'bg-destructive/15 text-destructive border-b border-destructive/30'
          : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-b border-yellow-500/30'
      )}
    >
      {/* 아이콘 */}
      {status.isExceeded ? (
        <Ban className="h-4 w-4 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      )}

      {/* 메시지 */}
      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {status.isExceeded
            ? `오늘의 OpenRouter 무료 사용량(${status.limit}회)을 모두 소진했습니다.`
            : `OpenRouter 무료 사용량 경고: ${status.used}/${status.limit}회 사용 (남은 횟수: ${status.remaining}회)`}
        </span>
        <span className="text-xs opacity-80">리셋: {resetDate} UTC</span>
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={onDismiss}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        title="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
