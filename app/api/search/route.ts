import { NextRequest, NextResponse } from 'next/server';
import { extractSynonyms } from '@/src/worms';
import { generateSearchUrlsWithOptions } from '@/src/search';

interface SearchOptions {
  customKeywords?: string;
  yearFrom?: number;
  yearTo?: number;
  includeKoreaKeywords?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scientificName, options = {} } = body as {
      scientificName: string;
      options?: SearchOptions;
    };

    if (!scientificName || typeof scientificName !== 'string') {
      return NextResponse.json(
        { error: '학명을 입력해주세요.' },
        { status: 400 }
      );
    }

    // WoRMS에서 이명 추출
    const result = await extractSynonyms(scientificName.trim());

    if (!result.success) {
      return NextResponse.json({
        success: false,
        inputName: scientificName,
        error: result.error || 'WoRMS에서 해당 학명을 찾을 수 없습니다.'
      });
    }

    // 검색 URL 생성 (옵션 적용)
    const searchUrls = generateSearchUrlsWithOptions(result, {
      yearFrom: options.yearFrom,
      yearTo: options.yearTo,
      customKeywords: options.customKeywords,
      includeKoreaKeywords: options.includeKoreaKeywords ?? true
    });

    return NextResponse.json({
      success: true,
      inputName: result.inputName,
      acceptedName: result.acceptedName,
      aphiaId: result.aphiaId,
      synonyms: result.synonyms,
      searchUrls
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
