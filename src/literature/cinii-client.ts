/**
 * CiNii (NII Scholarly and Academic Information Navigator) API 클라이언트
 *
 * 일본 학술 논문 및 학위논문 검색
 * J-STAGE에 없는 일본 문헌 보완
 * API 문서: https://support.nii.ac.jp/ja/cinii/api/a_opensearch
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

const CINII_API_BASE = 'https://cir.nii.ac.jp/opensearch/articles';

// API 호출 간격 (ms)
const API_DELAY = 1000;

// 일본어 한국 키워드
const JAPAN_KOREA_KEYWORDS = [
  '朝鮮',      // 조선
  '韓国',      // 한국
  '済州',      // 제주
  '釜山',      // 부산
  'Korea',
];

// OpenSearch 응답 타입 (JSON)
interface CiNiiResponse {
  '@context': object;
  '@id': string;
  '@type': string;
  title: string;
  link: {
    '@id': string;
    '@type': string;
  };
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  items: CiNiiItem[];
}

interface CiNiiItem {
  '@id': string;
  '@type': string;
  title: string;
  link: {
    '@id': string;
    '@type': string;
  };
  'dc:creator'?: string[];           // 저자
  'dc:publisher'?: string;           // 출판사
  'prism:publicationName'?: string;  // 저널명
  'prism:issn'?: string;
  'prism:volume'?: string;
  'prism:number'?: string;           // 호
  'prism:startingPage'?: string;
  'prism:endingPage'?: string;
  'prism:publicationDate'?: string;  // 출판일
  'dc:description'?: string;         // 초록
  'prism:doi'?: string;
  'cinii:naid'?: string;             // CiNii Article ID
  'cinii:ncid'?: string;             // NACSIS-CAT ID
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * CiNii API 클라이언트
 */
export class CiNiiClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'cinii';
  private lastRequestTime = 0;

  /**
   * 학명으로 문헌 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    const items: LiteratureItem[] = [];

    try {
      // 1. 학명만으로 검색
      const basicResults = await this.searchCiNii(query, options);
      items.push(...basicResults);

      // 2. 한국 키워드와 함께 검색
      if (options?.includeKoreaKeyword !== false && items.length < (options?.maxResults || 20)) {
        for (const keyword of JAPAN_KOREA_KEYWORDS.slice(0, 2)) {
          if (items.length >= (options?.maxResults || 20)) break;

          const keywordResults = await this.searchCiNii(`${query} ${keyword}`, options);

          // 중복 제거
          for (const item of keywordResults) {
            if (!items.some(i => i.id === item.id || i.title === item.title)) {
              items.push(item);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CiNii] Search error:', error);
      throw error;
    }

    // 연도순 정렬 및 결과 수 제한
    const maxResults = options?.maxResults || 20;
    return items
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .slice(0, maxResults);
  }

  /**
   * CiNii API 검색 실행
   */
  private async searchCiNii(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      count: '50',
      start: '1',
    });

    // 연도 필터 (from/until 파라미터)
    if (options?.yearFrom) {
      params.append('from', options.yearFrom.toString());
    }
    if (options?.yearTo) {
      params.append('until', options.yearTo.toString());
    }

    const url = `${CINII_API_BASE}?${params}`;
    console.log(`[CiNii] Searching: ${query}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CiNii API error: ${response.status}`);
    }

    const data: CiNiiResponse = await response.json();
    return this.convertItems(data.items || [], query, options);
  }

  /**
   * CiNii 항목을 LiteratureItem으로 변환
   */
  private convertItems(
    items: CiNiiItem[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const results: LiteratureItem[] = [];

    for (const item of items) {
      // 제목이 없으면 건너뛰기
      if (!item.title) continue;

      const year = this.parseYear(item['prism:publicationDate']);

      // 연도 필터 (API에서 처리 안 된 경우)
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      const pages = item['prism:startingPage'] && item['prism:endingPage']
        ? `${item['prism:startingPage']}-${item['prism:endingPage']}`
        : item['prism:startingPage'] || undefined;

      // CiNii ID 추출
      const naid = item['cinii:naid'] || this.extractNaidFromUrl(item['@id']);

      results.push({
        id: `cinii_${naid || Date.now()}_${results.length}`,
        source: 'cinii',
        title: item.title,
        authors: item['dc:creator'] || [],
        year,
        journal: item['prism:publicationName'],
        volume: item['prism:volume'],
        pages,
        doi: item['prism:doi'],
        url: item.link?.['@id'] || item['@id'],
        pdfUrl: this.generatePdfUrl(naid),
        searchedName,
        snippet: item['dc:description']?.slice(0, 300),
        relevanceScore: this.calculateRelevance(item),
        pdfDownloaded: false,
        analyzed: false,
      });
    }

    return results;
  }

  /**
   * URL에서 NAID 추출
   */
  private extractNaidFromUrl(url: string): string | null {
    // https://cir.nii.ac.jp/crid/1234567890 형식
    const match = url.match(/\/crid\/(\d+)/);
    if (match) return match[1];

    // https://ci.nii.ac.jp/naid/1234567890 형식
    const naidMatch = url.match(/\/naid\/(\d+)/);
    return naidMatch ? naidMatch[1] : null;
  }

  /**
   * PDF URL 생성 (가능한 경우)
   */
  private generatePdfUrl(naid: string | null): string | undefined {
    // CiNii는 대부분 외부 링크로 PDF 제공
    // 직접 PDF URL 생성이 어려움
    return undefined;
  }

  /**
   * 관련성 점수 계산
   */
  private calculateRelevance(item: CiNiiItem): number {
    let score = 0.5;

    // 초록이 있으면 가산점
    if (item['dc:description']) {
      score += 0.1;
    }

    // DOI가 있으면 가산점
    if (item['prism:doi']) {
      score += 0.1;
    }

    // 저널명이 있으면 가산점
    if (item['prism:publicationName']) {
      score += 0.1;
    }

    // 저자가 있으면 가산점
    if (item['dc:creator'] && item['dc:creator'].length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 연도 파싱
   */
  private parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;

    // "2023", "2023-01", "2023-01-15" 등 처리
    const match = dateStr.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * PDF 다운로드
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    // CiNii는 대부분 외부 사이트에서 PDF 제공
    // 직접 다운로드가 어려운 경우가 많음
    if (!item.pdfUrl) {
      // 메타데이터를 JSON으로 저장
      return this.saveMetadata(item, destPath);
    }

    try {
      await this.rateLimit();

      console.log(`[CiNii] Downloading PDF: ${item.title}`);
      const response = await fetch(item.pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('pdf')) {
        // PDF가 아니면 메타데이터만 저장
        return this.saveMetadata(item, destPath);
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

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
      console.error(`[CiNii] Download error for ${item.id}:`, error);
      return this.saveMetadata(item, destPath);
    }
  }

  /**
   * 메타데이터를 JSON으로 저장
   */
  private saveMetadata(item: LiteratureItem, destPath: string): PdfDownloadResult {
    try {
      const jsonPath = destPath.replace(/\.pdf$/i, '.json');
      const dir = path.dirname(jsonPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const metadata = {
        id: item.id,
        source: item.source,
        title: item.title,
        authors: item.authors,
        year: item.year,
        journal: item.journal,
        volume: item.volume,
        pages: item.pages,
        doi: item.doi,
        url: item.url,
        searchedName: item.searchedName,
        snippet: item.snippet,
        note: 'PDF not available directly. Please visit the URL to access the full text.',
      };

      fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

      return {
        itemId: item.id,
        success: true,
        pdfPath: jsonPath,
        fileSize: Buffer.from(JSON.stringify(metadata)).length,
      };
    } catch (error) {
      return {
        itemId: item.id,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save metadata',
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
