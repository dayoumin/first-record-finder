/**
 * Semantic Scholar API 클라이언트
 *
 * 영문 학술 논문 검색
 * API 문서: https://api.semanticscholar.org/api-docs/
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

const SEMANTIC_API_BASE = 'https://api.semanticscholar.org/graph/v1';
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';

// API 호출 간격 (ms) - 인증 없으면 100req/5min
const API_DELAY = 500;

// 검색 결과 타입
interface SemanticSearchResult {
  total: number;
  offset: number;
  next?: number;
  data: SemanticPaper[];
}

interface SemanticPaper {
  paperId: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
  };
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  publicationVenue?: {
    name?: string;
    type?: string;
  };
  year?: number;
  referenceCount?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  fieldsOfStudy?: string[];
  publicationTypes?: string[];
  publicationDate?: string;
  journal?: {
    name?: string;
    volume?: string;
    pages?: string;
  };
  authors?: SemanticAuthor[];
  tldr?: {
    model: string;
    text: string;
  };
}

interface SemanticAuthor {
  authorId: string;
  name: string;
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Semantic Scholar API 클라이언트
 */
export class SemanticScholarClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'semantic';
  private lastRequestTime = 0;

  /**
   * 학명으로 논문 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    await this.rateLimit();

    // 검색 쿼리 구성 (기본: 학명만, 옵션으로 Korea 추가)
    const includeKorea = options?.includeKoreaKeyword !== false;
    const searchQuery = includeKorea ? `${query} Korea` : query;
    const limit = Math.min(options?.maxResults || 20, 100);

    const fields = [
      'paperId',
      'externalIds',
      'url',
      'title',
      'abstract',
      'venue',
      'year',
      'isOpenAccess',
      'openAccessPdf',
      'journal',
      'authors',
      'citationCount',
    ].join(',');

    const params = new URLSearchParams({
      query: searchQuery,
      limit: limit.toString(),
      fields,
    });

    // 연도 필터
    if (options?.yearFrom) {
      params.append('year', `${options.yearFrom}-`);
    }
    if (options?.yearTo && !options?.yearFrom) {
      params.append('year', `-${options.yearTo}`);
    }
    if (options?.yearFrom && options?.yearTo) {
      params.set('year', `${options.yearFrom}-${options.yearTo}`);
    }

    const url = `${SEMANTIC_API_BASE}/paper/search?${params}`;
    console.log(`[Semantic] Searching: ${searchQuery}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (API_KEY) {
      headers['x-api-key'] = API_KEY;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    const data: SemanticSearchResult = await response.json();

    return this.convertPapers(data.data, query, options);
  }

  /**
   * 검색 결과를 LiteratureItem으로 변환
   */
  private convertPapers(
    papers: SemanticPaper[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    for (const paper of papers) {
      // 연도 필터 (API에서 처리 안 된 경우 추가 확인)
      if (options?.yearFrom && paper.year && paper.year < options.yearFrom) continue;
      if (options?.yearTo && paper.year && paper.year > options.yearTo) continue;

      items.push({
        id: `semantic_${paper.paperId}`,
        source: 'semantic',
        title: paper.title,
        authors: paper.authors?.map(a => a.name) || [],
        year: paper.year || null,
        journal: paper.journal?.name || paper.venue,
        volume: paper.journal?.volume,
        pages: paper.journal?.pages,
        doi: paper.externalIds?.DOI,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        pdfUrl: paper.openAccessPdf?.url,
        searchedName,
        snippet: paper.abstract?.slice(0, 300),
        relevanceScore: this.calculateRelevance(paper),
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
  private calculateRelevance(paper: SemanticPaper): number {
    let score = 0.5;

    // 오픈 액세스 PDF 있으면 가산점
    if (paper.isOpenAccess && paper.openAccessPdf?.url) {
      score += 0.2;
    }

    // 인용 수 기반 가산점 (최대 0.2)
    if (paper.citationCount) {
      score += Math.min(paper.citationCount / 100, 0.2);
    }

    // 생물학 분야면 가산점
    if (paper.fieldsOfStudy?.some(f =>
      f.toLowerCase().includes('biology') ||
      f.toLowerCase().includes('marine') ||
      f.toLowerCase().includes('fish')
    )) {
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

      console.log(`[Semantic] Downloading PDF: ${item.title}`);

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
      console.error(`[Semantic] Download error for ${item.id}:`, error);
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
