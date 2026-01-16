/**
 * 문헌 소스 설정 API
 */

import { NextResponse } from 'next/server';
import {
  getSourceConfigs,
  updateSourceConfig,
  LiteratureSource,
} from '@/src/literature';

// GET: 소스 설정 조회
export async function GET() {
  try {
    const configs = getSourceConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Failed to get source configs:', error);
    return NextResponse.json(
      { error: 'Failed to get source configs' },
      { status: 500 }
    );
  }
}

// POST: 소스 활성화/비활성화
export async function POST(request: Request) {
  try {
    const { source, enabled } = await request.json();

    if (!source || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: source and enabled are required' },
        { status: 400 }
      );
    }

    updateSourceConfig(source as LiteratureSource, enabled);
    const configs = getSourceConfigs();

    return NextResponse.json({
      success: true,
      configs,
    });
  } catch (error) {
    console.error('Failed to update source config:', error);
    return NextResponse.json(
      { error: 'Failed to update source config' },
      { status: 500 }
    );
  }
}
