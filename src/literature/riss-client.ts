/**
 * RISS (학술연구정보서비스) API 클라이언트
 *
 * 한국 학위논문 및 학술논문 검색 - 최근 한국 해역 신규 기록 문헌 검색용
 * API: 공공데이터포털 학술연구정보 OpenAPI
 * https://www.data.go.kr/data/3046254/openapi.do
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

const RISS_API_BASE = 'http://openapi.riss.kr/openapi/search';
const API_KEY = process.env.RISS_API_KEY || '';

// API 호출 간격 (ms)
const API_DELAY = 500;

// RISS API 응답 타입
interface RissSearchResponse {
  result: {
    resultCode: string;
    resultMessage: string;
    pageNo: number;
    numOfRows: number;
    totalCount: number;
  };
  body?: {
    items?: RissArticle[];
  };
}

interface RissArticle {
  articleId?: string;
  controlNo?: string;
  title?: string;
  creator?: string;          // 저자
  publisher?: string;        // 발행처
  publicationYear?: string;  // 발행년
  journalName?: string;
  volume?: string;
  issue?: string;
  startPage?: string;
  endPage?: string;
  abstract?: string;
  keyword?: string;
  language?: string;
  doi?: string;
  url?: string;
  detailLink?: string;
  pdfLink?: string;
  thesisType?: string;       // 학위 유형 (학위논문인 경우)
  degreeGrantor?: string;    // 학위수여기관
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * RISS API 클라이언트
 */
export class RissClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'riss';
  private lastRequestTime = 0;

  /**
   * 학명으로 논문 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    if (!API_KEY) {
      console.warn('[RISS] API key not configured. Set RISS_API_KEY environment variable.');
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.maxResults || 20, 100);

    // RISS API 파라미터 구성
    const params = new URLSearchParams({
      serviceKey: API_KEY,
      query: query,
      searchType: 'all',        // 통합검색
      numOfRows: limit.toString(),
      pageNo: '1',
    });

    // 연도 필터
    if (options?.yearFrom) {
      params.append('startYear', options.yearFrom.toString());
    }
    if (options?.yearTo) {
      params.append('endYear', options.yearTo.toString());
    }

    const url = `${RISS_API_BASE}/totalSearch?${params}`;
    console.log(`[RISS] Searching: ${query}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[RISS] API error: ${response.status} - ${error}`);
        return [];
      }

      const data: RissSearchResponse = await response.json();

      if (data.result.resultCode !== '00') {
        console.error(`[RISS] Search failed: ${data.result.resultMessage}`);
        return [];
      }

      const items = this.convertArticles(data.body?.items || [], query, options);
      console.log(`[RISS] Found ${items.length} articles`);

      return items;
    } catch (error) {
      console.error('[RISS] Search error:', error);
      return [];
    }
  }

  /**
   * 검색 결과를 LiteratureItem으로 변환
   */
  private convertArticles(
    articles: RissArticle[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    for (const article of articles) {
      const year = article.publicationYear ? parseInt(article.publicationYear, 10) : null;

      // 연도 필터
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      const pages = article.startPage && article.endPage
        ? `${article.startPage}-${article.endPage}`
        : article.startPage || undefined;

      const id = article.articleId || article.controlNo || `riss_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      items.push({
        id: `riss_${id}`,
        source: 'riss',
        title: article.title || '',
        authors: article.creator?.split(';').map(a => a.trim()) || [],
        year,
        journal: article.journalName || article.publisher,
        volume: article.volume,
        pages,
        doi: article.doi,
        url: article.detailLink || article.url || `https://www.riss.kr/link?id=${id}`,
        pdfUrl: article.pdfLink,
        searchedName,
        snippet: article.abstract?.slice(0, 300),
        relevanceScore: this.calculateRelevance(article, searchedName),
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
  private calculateRelevance(article: RissArticle, searchedName: string): number {
    let score = 0.5;

    // 제목에 학명이 포함되면 가산점
    const title = article.title || '';
    if (title.toLowerCase().includes(searchedName.toLowerCase())) {
      score += 0.3;
    }

    // 초록에 학명이 포함되면 가산점
    const abstract = article.abstract || '';
    if (abstract.toLowerCase().includes(searchedName.toLowerCase())) {
      score += 0.1;
    }

    // PDF 링크 있으면 가산점
    if (article.pdfLink) {
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
        error: 'No PDF URL available. RISS may require login for PDF download.',
      };
    }

    try {
      await this.rateLimit();

      console.log(`[RISS] Downloading PDF: ${item.title}`);

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
        throw new Error(`Not a PDF: ${contentType}. RISS may require authentication.`);
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
      console.error(`[RISS] Download error for ${item.id}:`, error);
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
