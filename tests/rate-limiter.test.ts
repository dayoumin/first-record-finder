/**
 * Rate Limiter 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, getRateLimiter, resetRateLimiter } from '../src/llm/rate-limiter';
import * as fs from 'fs';

// fs 모킹
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('RateLimiter', () => {
  beforeEach(() => {
    // 각 테스트 전 싱글톤 및 모킹 리셋
    resetRateLimiter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRateLimiter();
  });

  describe('메모리 저장소 모드', () => {
    it('초기 상태는 0회 사용', () => {
      const limiter = new RateLimiter({ storageType: 'memory' });
      const status = limiter.getStatus();

      expect(status.used).toBe(0);
      expect(status.remaining).toBe(1000);
      expect(status.limit).toBe(1000);
      expect(status.isWarning).toBe(false);
      expect(status.isExceeded).toBe(false);
    });

    it('사용량 증가가 정상 동작', () => {
      const limiter = new RateLimiter({ storageType: 'memory' });

      expect(limiter.incrementUsage()).toBe(true);
      expect(limiter.getStatus().used).toBe(1);

      expect(limiter.incrementUsage()).toBe(true);
      expect(limiter.getStatus().used).toBe(2);
    });

    it('900회 이상 사용 시 경고 상태', () => {
      const limiter = new RateLimiter({
        storageType: 'memory',
        dailyLimit: 1000,
        warningThreshold: 900,
      });

      // 900회까지 증가
      for (let i = 0; i < 900; i++) {
        limiter.incrementUsage();
      }

      const status = limiter.getStatus();
      expect(status.used).toBe(900);
      expect(status.isWarning).toBe(true);
      expect(status.isExceeded).toBe(false);
    });

    it('1000회 초과 시 요청 불가', () => {
      const limiter = new RateLimiter({
        storageType: 'memory',
        dailyLimit: 10, // 테스트용 작은 값
      });

      // 10회까지 사용
      for (let i = 0; i < 10; i++) {
        expect(limiter.canMakeRequest()).toBe(true);
        limiter.incrementUsage();
      }

      // 11번째 요청은 불가
      expect(limiter.canMakeRequest()).toBe(false);
      expect(limiter.incrementUsage()).toBe(false);

      const status = limiter.getStatus();
      expect(status.isExceeded).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it('리셋 후 사용량 초기화', () => {
      const limiter = new RateLimiter({ storageType: 'memory' });

      limiter.incrementUsage();
      limiter.incrementUsage();
      expect(limiter.getStatus().used).toBe(2);

      limiter.resetUsage();
      expect(limiter.getStatus().used).toBe(0);
    });
  });

  describe('경고 메시지', () => {
    it('정상 상태에서는 메시지 없음', () => {
      const limiter = new RateLimiter({ storageType: 'memory' });
      expect(limiter.getWarningMessage()).toBeNull();
    });

    it('경고 상태에서 경고 메시지 반환', () => {
      const limiter = new RateLimiter({
        storageType: 'memory',
        dailyLimit: 100,
        warningThreshold: 90,
      });

      for (let i = 0; i < 90; i++) {
        limiter.incrementUsage();
      }

      const message = limiter.getWarningMessage();
      expect(message).toContain('경고');
      expect(message).toContain('90/100');
    });

    it('초과 상태에서 초과 메시지 반환', () => {
      const limiter = new RateLimiter({
        storageType: 'memory',
        dailyLimit: 10,
      });

      for (let i = 0; i < 10; i++) {
        limiter.incrementUsage();
      }

      const message = limiter.getWarningMessage();
      expect(message).toContain('소진');
    });
  });

  describe('파일 저장소 모드', () => {
    it('파일이 없으면 초기 상태 반환', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const limiter = new RateLimiter({
        storageType: 'file',
        storagePath: 'data/test-usage.json',
      });

      const status = limiter.getStatus();
      expect(status.used).toBe(0);
    });

    it('파일에서 오늘 날짜 데이터 로드', () => {
      const today = new Date().toISOString().split('T')[0];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        date: today,
        count: 500,
        lastUpdated: new Date().toISOString(),
      }));

      const limiter = new RateLimiter({
        storageType: 'file',
        storagePath: 'data/test-usage.json',
      });

      const status = limiter.getStatus();
      expect(status.used).toBe(500);
    });

    it('어제 날짜 데이터는 리셋', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        date: yesterday,
        count: 999,
        lastUpdated: new Date().toISOString(),
      }));

      const limiter = new RateLimiter({
        storageType: 'file',
        storagePath: 'data/test-usage.json',
      });

      const status = limiter.getStatus();
      expect(status.used).toBe(0); // 어제 데이터이므로 리셋
    });

    it('사용량 증가 시 파일에 저장', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        count: 10,
        lastUpdated: new Date().toISOString(),
      }));

      const limiter = new RateLimiter({
        storageType: 'file',
        storagePath: 'data/test-usage.json',
      });

      limiter.incrementUsage();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.count).toBe(11);
    });
  });

  describe('싱글톤 패턴', () => {
    it('getRateLimiter는 같은 인스턴스 반환', () => {
      const limiter1 = getRateLimiter({ storageType: 'memory' });
      const limiter2 = getRateLimiter();

      limiter1.incrementUsage();

      expect(limiter2.getStatus().used).toBe(1);
    });

    it('resetRateLimiter 후 새 인스턴스 생성', () => {
      const limiter1 = getRateLimiter({ storageType: 'memory' });
      limiter1.incrementUsage();
      limiter1.incrementUsage();

      resetRateLimiter();

      const limiter2 = getRateLimiter({ storageType: 'memory' });
      expect(limiter2.getStatus().used).toBe(0);
    });
  });

  describe('리셋 시간 계산', () => {
    it('resetsAt은 다음 UTC 자정', () => {
      const limiter = new RateLimiter({ storageType: 'memory' });
      const status = limiter.getStatus();

      const resetTime = new Date(status.resetsAt);
      expect(resetTime.getUTCHours()).toBe(0);
      expect(resetTime.getUTCMinutes()).toBe(0);
      expect(resetTime.getUTCSeconds()).toBe(0);

      // 내일이어야 함
      const now = new Date();
      expect(resetTime.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('커스텀 설정', () => {
    it('dailyLimit 커스텀 설정', () => {
      const limiter = new RateLimiter({
        storageType: 'memory',
        dailyLimit: 500,
      });

      expect(limiter.getStatus().limit).toBe(500);
    });

    it('warningThreshold 커스텀 설정', () => {
      const limiter = new RateLimiter({
        storageType: 'memory',
        dailyLimit: 100,
        warningThreshold: 80,
      });

      // 80회까지 증가
      for (let i = 0; i < 80; i++) {
        limiter.incrementUsage();
      }

      expect(limiter.getStatus().isWarning).toBe(true);
      expect(limiter.getStatus().warningThreshold).toBe(80);
    });
  });
});
