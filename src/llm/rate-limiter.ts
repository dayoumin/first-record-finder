/**
 * OpenRouter 무료 모델 Rate Limit 관리
 *
 * - 일일 1,000회 제한 ($10 충전 기준)
 * - 900회 사용 시 경고
 * - 자정(UTC) 기준 리셋
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/** Rate Limit 설정 */
export interface RateLimitConfig {
  dailyLimit: number;        // 일일 최대 요청 수 (기본: 1000)
  warningThreshold: number;  // 경고 임계값 (기본: 900)
  storageType: 'file' | 'memory';  // 저장 방식
  storagePath?: string;      // 파일 저장 경로
}

/** 사용량 데이터 */
export interface UsageData {
  date: string;              // YYYY-MM-DD (UTC)
  count: number;             // 오늘 사용 횟수
  lastUpdated: string;       // ISO timestamp
}

/** Rate Limit 상태 */
export interface RateLimitStatus {
  used: number;              // 사용 횟수
  remaining: number;         // 남은 횟수
  limit: number;             // 일일 한도
  isWarning: boolean;        // 경고 상태 (900회 이상)
  isExceeded: boolean;       // 한도 초과
  resetsAt: string;          // 리셋 시간 (UTC 자정)
  warningThreshold: number;  // 경고 임계값
}

/** 기본 설정 */
const DEFAULT_CONFIG: RateLimitConfig = {
  dailyLimit: 1000,
  warningThreshold: 900,
  storageType: 'file',
  storagePath: 'data/llm-usage.json',
};

/** 메모리 저장소 (서버리스 환경용) */
let memoryStorage: UsageData | null = null;

/**
 * 현재 UTC 날짜 (YYYY-MM-DD)
 */
function getUTCDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 다음 UTC 자정 시간
 */
function getNextResetTime(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.toISOString();
}

/**
 * Rate Limiter 클래스
 */
export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 사용량 데이터 로드
   */
  private loadUsage(): UsageData {
    const today = getUTCDate();

    if (this.config.storageType === 'memory') {
      if (memoryStorage && memoryStorage.date === today) {
        return memoryStorage;
      }
      return { date: today, count: 0, lastUpdated: new Date().toISOString() };
    }

    // 파일에서 로드
    const filePath = this.config.storagePath!;
    try {
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as UsageData;
        // 날짜가 다르면 리셋
        if (data.date === today) {
          return data;
        }
      }
    } catch (error) {
      console.warn('[RateLimiter] Failed to load usage data:', error);
    }

    return { date: today, count: 0, lastUpdated: new Date().toISOString() };
  }

  /**
   * 사용량 데이터 저장
   */
  private saveUsage(usage: UsageData): void {
    if (this.config.storageType === 'memory') {
      memoryStorage = usage;
      return;
    }

    // 파일에 저장
    const filePath = this.config.storagePath!;
    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, JSON.stringify(usage, null, 2));
    } catch (error) {
      console.error('[RateLimiter] Failed to save usage data:', error);
    }
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): RateLimitStatus {
    const usage = this.loadUsage();
    const remaining = Math.max(0, this.config.dailyLimit - usage.count);

    return {
      used: usage.count,
      remaining,
      limit: this.config.dailyLimit,
      isWarning: usage.count >= this.config.warningThreshold,
      isExceeded: usage.count >= this.config.dailyLimit,
      resetsAt: getNextResetTime(),
      warningThreshold: this.config.warningThreshold,
    };
  }

  /**
   * 요청 가능 여부 확인
   */
  canMakeRequest(): boolean {
    const usage = this.loadUsage();
    return usage.count < this.config.dailyLimit;
  }

  /**
   * 사용량 증가 (요청 전 호출)
   * @returns 성공 여부
   */
  incrementUsage(): boolean {
    const usage = this.loadUsage();

    if (usage.count >= this.config.dailyLimit) {
      return false;
    }

    usage.count += 1;
    usage.lastUpdated = new Date().toISOString();
    this.saveUsage(usage);

    return true;
  }

  /**
   * 사용량 수동 리셋 (테스트용)
   */
  resetUsage(): void {
    const usage: UsageData = {
      date: getUTCDate(),
      count: 0,
      lastUpdated: new Date().toISOString(),
    };
    this.saveUsage(usage);
  }

  /**
   * 경고 메시지 생성
   */
  getWarningMessage(): string | null {
    const status = this.getStatus();

    if (status.isExceeded) {
      return `⛔ 오늘의 OpenRouter 무료 사용량(${status.limit}회)을 모두 소진했습니다. 내일 UTC 자정에 리셋됩니다.`;
    }

    if (status.isWarning) {
      return `⚠️ OpenRouter 무료 사용량 경고: ${status.used}/${status.limit}회 사용 (남은 횟수: ${status.remaining}회)`;
    }

    return null;
  }
}

/** 싱글톤 인스턴스 */
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Rate Limiter 싱글톤 가져오기
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config);
  }
  return rateLimiterInstance;
}

/**
 * Rate Limiter 재설정 (테스트용)
 */
export function resetRateLimiter(): void {
  rateLimiterInstance = null;
  memoryStorage = null;
}
