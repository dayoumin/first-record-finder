/**
 * 문헌 수집 API
 *
 * POST /api/literature - 문헌 검색 및 PDF 다운로드
 * GET /api/literature?species=xxx - 저장된 결과 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  collectLiterature,
  loadSearchResult,
  getAvailableSources,
  LiteratureSearchRequest,
  LiteratureSource,
} from '@/src/literature';

// 입력 검증
const MAX_SYNONYMS = 50;
const MAX_RESULTS = 100;

interface RequestBody {
  scientificName: string;
  synonyms?: string[];
  sources?: LiteratureSource[];
  yearFrom?: number;
  yearTo?: number;
  maxResults?: number;
  searchStrategy?: 'historical' | 'korea' | 'both';
}

function validateRequest(body: RequestBody): string | null {
  if (!body.scientificName || typeof body.scientificName !== 'string') {
    return 'scientificName is required';
  }

  if (body.scientificName.trim().length === 0) {
    return 'scientificName cannot be empty';
  }

  if (body.synonyms && !Array.isArray(body.synonyms)) {
    return 'synonyms must be an array';
  }

  if (body.synonyms && body.synonyms.length > MAX_SYNONYMS) {
    return `Too many synonyms (max ${MAX_SYNONYMS})`;
  }

  if (body.maxResults && (body.maxResults < 1 || body.maxResults > MAX_RESULTS)) {
    return `maxResults must be between 1 and ${MAX_RESULTS}`;
  }

  if (body.yearFrom && (body.yearFrom < 1700 || body.yearFrom > 2100)) {
    return 'Invalid yearFrom';
  }

  if (body.yearTo && (body.yearTo < 1700 || body.yearTo > 2100)) {
    return 'Invalid yearTo';
  }

  return null;
}

/**
 * POST: 문헌 검색 및 수집
 */
export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    // 입력 검증
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const searchRequest: LiteratureSearchRequest = {
      scientificName: body.scientificName.trim(),
      synonyms: body.synonyms || [],
      sources: body.sources,
      yearFrom: body.yearFrom,
      yearTo: body.yearTo,
      maxResults: body.maxResults || 30,
      searchStrategy: body.searchStrategy || 'both',
    };

    console.log(`[Literature API] Collecting for: ${searchRequest.scientificName}`);
    console.log(`[Literature API] Synonyms: ${searchRequest.synonyms.length}`);
    console.log(`[Literature API] Sources: ${searchRequest.sources || 'all'}`);

    // 문헌 수집 실행
    const result = await collectLiterature(searchRequest);

    const downloadedCount = result.items.filter(i => i.pdfDownloaded).length;

    console.log(`[Literature API] Found: ${result.totalFound} items`);
    console.log(`[Literature API] Downloaded: ${downloadedCount} PDFs`);

    return NextResponse.json({
      success: true,
      scientificName: result.scientificName,
      totalFound: result.totalFound,
      downloadedCount,
      items: result.items,
      errors: result.errors,
      availableSources: getAvailableSources(),
    });
  } catch (error) {
    console.error('[Literature API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Collection failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: 저장된 검색 결과 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const species = searchParams.get('species');

    if (!species) {
      // 사용 가능한 소스 목록 반환
      return NextResponse.json({
        success: true,
        availableSources: getAvailableSources(),
      });
    }

    const result = loadSearchResult(species);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'No results found for this species' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Literature API] GET Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load results',
      },
      { status: 500 }
    );
  }
}
