/**
 * ScienceON (KISTI) API 클라이언트
 *
 * 한국 과학기술 논문 검색 - KISTI 과학기술 지식인프라
 * API: https://scienceon.kisti.re.kr/apigateway
 *
 * 필요 환경변수:
 * - SCIENCEON_CLIENT_ID: 클라이언트 ID (64자)
 * - SCIENCEON_API_KEY: API 토큰 (ACCESS_TOKEN)
 */

import {
  ILiteratureClient,
  LiteratureItem,
  LiteratureSource,
  PdfDownloadResult,
  SearchOptions,
} from './types';

const SCIENCEON_API_BASE = 'https://apigateway.kisti.re.kr/openapicall.do';

// 환경변수에서 API 키 가져오기 (getter 함수로 lazy loading)
function getClientId(): string {
  return process.env.SCIENCEON_CLIENT_ID || '';
}

function getApiToken(): string {
  return process.env.SCIENCEON_API_KEY || '';
}

// API 호출 간격 (ms)
const API_DELAY = 500;

// ScienceON XML 응답 파싱을 위한 인터페이스
interface ScienceOnArticle {
  cn: string;              // 콘텐츠 ID
  title: string;           // 제목
  author?: string;         // 저자
  jtitle?: string;         // 학술지명
  pubyear?: string;        // 발행연도
  volume?: string;         // 권
  issue?: string;          // 호
  startpage?: string;      // 시작페이지
  endpage?: string;        // 종료페이지
  doi?: string;            // DOI
  abstract?: string;       // 초록
  url?: string;            // 원문 URL
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * XML 텍스트에서 특정 태그 값 추출
 */
function extractXmlValue(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * XML에서 여러 record 추출
 */
function extractRecords(xml: string): string[] {
  const records: string[] = [];
  const regex = /<record[^>]*>([\s\S]*?)<\/record>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    records.push(match[1]);
  }
  return records;
}

/**
 * ScienceON API 클라이언트
 */
export class ScienceOnClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'scienceon';
  private lastRequestTime = 0;

  /**
   * 학명으로 논문 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    const clientId = getClientId();
    const apiToken = getApiToken();

    if (!clientId || !apiToken) {
      console.warn('[ScienceON] API credentials not configured. Set SCIENCEON_CLIENT_ID and SCIENCEON_API_KEY.');
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.maxResults || 20, 100);

    // 검색 쿼리 구성 (JSON 형식)
    const searchQuery: Record<string, string> = {
      title: query,  // 제목에서 검색
    };

    // 연도 필터 (yearFilter 형식: YYYY-YYYY)
    if (options?.yearFrom || options?.yearTo) {
      const fromYear = options.yearFrom || 1900;
      const toYear = options.yearTo || new Date().getFullYear();
      searchQuery.pubyear = `${fromYear}-${toYear}`;
    }

    // URL 파라미터 구성
    const params = new URLSearchParams({
      client_id: clientId,
      token: apiToken,
      action: 'search',
      target: 'ARTI',  // 논문 콘텐츠
      searchQuery: JSON.stringify(searchQuery),
      sortField: 'pubyear',  // 발행연도순 정렬
      curPage: '1',
      rowCount: limit.toString(),
    });

    const url = `${SCIENCEON_API_BASE}?${params}`;
    console.log(`[ScienceON] Searching: ${query}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/xml',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[ScienceON] API error: ${response.status} - ${error}`);
        return [];
      }

      const xmlText = await response.text();

      // 에러 체크
      const errorCode = extractXmlValue(xmlText, 'errorCode');
      if (errorCode && errorCode !== '0') {
        const errorMsg = extractXmlValue(xmlText, 'errorMsg');
        console.error(`[ScienceON] API error: ${errorCode} - ${errorMsg}`);
        return [];
      }

      const items = this.parseXmlResponse(xmlText, query, options);
      console.log(`[ScienceON] Found ${items.length} articles`);

      return items;
    } catch (error) {
      console.error('[ScienceON] Search error:', error);
      return [];
    }
  }

  /**
   * XML 응답을 LiteratureItem으로 변환
   */
  private parseXmlResponse(
    xml: string,
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];
    const records = extractRecords(xml);

    for (const record of records) {
      const article: ScienceOnArticle = {
        cn: extractXmlValue(record, 'cn'),
        title: extractXmlValue(record, 'title') || extractXmlValue(record, 'titleEn'),
        author: extractXmlValue(record, 'author'),
        jtitle: extractXmlValue(record, 'jtitle'),
        pubyear: extractXmlValue(record, 'pubyear'),
        volume: extractXmlValue(record, 'volume'),
        issue: extractXmlValue(record, 'issue'),
        startpage: extractXmlValue(record, 'startpage'),
        endpage: extractXmlValue(record, 'endpage'),
        doi: extractXmlValue(record, 'doi'),
        abstract: extractXmlValue(record, 'abstract'),
        url: extractXmlValue(record, 'url') || extractXmlValue(record, 'linkUrl'),
      };

      if (!article.cn || !article.title) continue;

      const year = article.pubyear ? parseInt(article.pubyear, 10) : null;

      // 연도 필터
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      const pages = article.startpage && article.endpage
        ? `${article.startpage}-${article.endpage}`
        : article.startpage || undefined;

      items.push({
        id: `scienceon_${article.cn}`,
        source: 'scienceon',
        title: article.title,
        authors: article.author?.split(/[,;]/).map(a => a.trim()).filter(Boolean) || [],
        year,
        journal: article.jtitle,
        volume: article.volume,
        pages,
        doi: article.doi,
        url: article.url || `https://scienceon.kisti.re.kr/srch/selectPORSrchArticle.do?cn=${article.cn}`,
        pdfUrl: undefined,  // ScienceON은 직접 PDF 링크 제공하지 않음
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
  private calculateRelevance(article: ScienceOnArticle, searchedName: string): number {
    let score = 0.5;

    // 제목에 학명이 포함되면 가산점
    if (article.title?.toLowerCase().includes(searchedName.toLowerCase())) {
      score += 0.3;
    }

    // 초록에 학명이 포함되면 가산점
    if (article.abstract?.toLowerCase().includes(searchedName.toLowerCase())) {
      score += 0.1;
    }

    // DOI가 있으면 가산점
    if (article.doi) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * PDF 다운로드 - ScienceON은 직접 다운로드 미지원
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    // ScienceON은 PDF 직접 다운로드를 제공하지 않음
    // 사용자가 ScienceON 사이트에서 직접 다운로드 필요
    return {
      itemId: item.id,
      success: false,
      error: 'ScienceON does not provide direct PDF download. Please download manually from the ScienceON website.',
    };
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
