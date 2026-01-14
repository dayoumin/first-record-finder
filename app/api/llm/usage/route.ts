/**
 * LLM 사용량 조회 API
 *
 * GET /api/llm/usage - 현재 사용량 상태 조회
 * POST /api/llm/usage/reset - 사용량 리셋 (테스트용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRateLimiter } from '@/src/llm';

/**
 * GET /api/llm/usage
 * 현재 OpenRouter 무료 모델 사용량 조회
 */
export async function GET() {
  try {
    const rateLimiter = getRateLimiter();
    const status = rateLimiter.getStatus();
    const warningMessage = rateLimiter.getWarningMessage();

    return NextResponse.json({
      success: true,
      ...status,
      warningMessage,
    });
  } catch (error) {
    console.error('[API] Failed to get usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get usage data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/llm/usage
 * 사용량 리셋 (개발/테스트용)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'reset') {
      // 프로덕션에서는 비활성화
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Reset not allowed in production' },
          { status: 403 }
        );
      }

      const rateLimiter = getRateLimiter();
      rateLimiter.resetUsage();

      return NextResponse.json({
        success: true,
        message: 'Usage reset successfully',
        ...rateLimiter.getStatus(),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Failed to process request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
