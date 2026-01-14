/**
 * OpenAlex API 클라이언트
 *
 * 현대 학술 논문 검색 (주력)
 * - 2억+ 논문, 무료, 인증 불필요
 * - 일일 10만 요청 (이메일 추가 시 우선 처리)
 * API 문서: https://docs.openalex.org/
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ILiteratureClient,
  LiteratureItem,
  LiteratureSource,
  PdfDownloadResult,
  SearchOptions,
} from './types';

const OPENALEX_API_BASE = 'https://api.openalex.org';

// Polite pool을 위한 이메일 (설정 가능)
const CONTACT_EMAIL = process.env.OPENALEX_EMAIL || 'firstrecordfinder@example.com';

// API 호출 간격 (ms) - 무료 사용자 권장
const API_DELAY = 100;

// OpenAlex Work 타입
interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  type?: string;
  cited_by_count?: number;
  is_oa?: boolean;
  open_access?: {
    is_oa: boolean;
    oa_status?: string;
    oa_url?: string;
  };
  primary_location?: {
    source?: {
      display_name?: string;
      type?: string;
    };
    pdf_url?: string;
    landing_page_url?: string;
  };
  best_oa_location?: {
    pdf_url?: string;
    landing_page_url?: string;
  };
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
    raw_author_name?: string;
  }>;
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  abstract_inverted_index?: Record<string, number[]>;
}

// 검색 결과 타입
interface OpenAlexSearchResult {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Inverted index에서 abstract 복원
 */
function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
  if (!invertedIndex) return '';

  const words: Array<{ word: string; position: number }> = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      words.push({ word, position });
    }
  }

  words.sort((a, b) => a.position - b.position);
  return words.map(w => w.word).join(' ');
}

/**
 * OpenAlex API 클라이언트
 */
export class OpenAlexClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'openalex';
  private lastRequestTime = 0;

  /**
   * 학명으로 논문 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    await this.rateLimit();

    // 검색 쿼리 구성
    const includeKorea = options?.includeKoreaKeyword !== false;
    const searchQuery = includeKorea ? `${query} Korea` : query;
    const perPage = Math.min(options?.maxResults || 20, 100);

    // URL 구성
    const params = new URLSearchParams({
      search: searchQuery,
      per_page: perPage.toString(),
      mailto: CONTACT_EMAIL,
    });

    // 연도 필터
    if (options?.yearFrom && options?.yearTo) {
      params.append('filter', `publication_year:${options.yearFrom}-${options.yearTo}`);
    } else if (options?.yearFrom) {
      params.append('filter', `publication_year:>=${options.yearFrom}`);
    } else if (options?.yearTo) {
      params.append('filter', `publication_year:<=${options.yearTo}`);
    }

    const url = `${OPENALEX_API_BASE}/works?${params}`;
    console.log(`[OpenAlex] Searching: ${searchQuery}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FirstRecordFinder/1.0 (mailto:' + CONTACT_EMAIL + ')',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAlex API error: ${response.status} - ${error}`);
    }

    const data: OpenAlexSearchResult = await response.json();

    return this.convertWorks(data.results, query, options);
  }

  /**
   * 검색 결과를 LiteratureItem으로 변환
   */
  private convertWorks(
    works: OpenAlexWork[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    for (const work of works) {
      // 연도 필터 (API에서 처리 안 된 경우 추가 확인)
      if (options?.yearFrom && work.publication_year && work.publication_year < options.yearFrom) continue;
      if (options?.yearTo && work.publication_year && work.publication_year > options.yearTo) continue;

      // OpenAlex ID에서 순수 ID 추출 (https://openalex.org/W1234 -> W1234)
      const openAlexId = work.id.replace('https://openalex.org/', '');

      // 저자 추출
      const authors = work.authorships?.map(a =>
        a.author?.display_name || a.raw_author_name || 'Unknown'
      ) || [];

      // PDF URL 찾기
      const pdfUrl = work.best_oa_location?.pdf_url ||
        work.primary_location?.pdf_url ||
        work.open_access?.oa_url;

      // 원문 URL
      const url = work.primary_location?.landing_page_url ||
        (work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : '') ||
        `https://openalex.org/${openAlexId}`;

      // 페이지 정보
      const pages = work.biblio?.first_page && work.biblio?.last_page
        ? `${work.biblio.first_page}-${work.biblio.last_page}`
        : work.biblio?.first_page;

      // Abstract 복원
      const abstract = reconstructAbstract(work.abstract_inverted_index);

      items.push({
        id: `openalex_${openAlexId}`,
        source: 'openalex',
        title: work.display_name || work.title || 'Untitled',
        authors,
        year: work.publication_year || null,
        journal: work.primary_location?.source?.display_name,
        volume: work.biblio?.volume,
        pages,
        doi: work.doi?.replace('https://doi.org/', ''),
        url,
        pdfUrl,
        searchedName,
        snippet: abstract.slice(0, 300),
        relevanceScore: this.calculateRelevance(work),
        pdfDownloaded: false,
        analyzed: false,
      });
    }

    // 관련성 점수로 정렬
    items.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    return items;
  }

  /**
   * 관련성 점수 계산
   */
  private calculateRelevance(work: OpenAlexWork): number {
    let score = 0.5;

    // 오픈 액세스 PDF 있으면 가산점
    if (work.is_oa || work.open_access?.is_oa) {
      score += 0.2;
    }

    // 인용 수 기반 가산점 (최대 0.2)
    if (work.cited_by_count) {
      score += Math.min(work.cited_by_count / 100, 0.2);
    }

    // DOI 있으면 가산점
    if (work.doi) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * PDF 다운로드
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    if (!item.pdfUrl) {
      return {
        itemId: item.id,
        success: false,
        error: 'No PDF URL available (not open access)',
      };
    }

    try {
      await this.rateLimit();

      console.log(`[OpenAlex] Downloading PDF: ${item.title}`);

      const response = await fetch(item.pdfUrl, {
        headers: {
          'User-Agent': 'FirstRecordFinder/1.0 (Academic Research)',
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('pdf')) {
        throw new Error(`Not a PDF: ${contentType}`);
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // 디렉토리 생성
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(destPath, uint8Array);

      return {
        itemId: item.id,
        success: true,
        pdfPath: destPath,
        fileSize: uint8Array.length,
      };
    } catch (error) {
      console.error(`[OpenAlex] Download error for ${item.id}:`, error);
      return {
        itemId: item.id,
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  /**
   * API 호출 속도 제한
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < API_DELAY) {
      await delay(API_DELAY - elapsed);
    }

    this.lastRequestTime = Date.now();
  }
}
