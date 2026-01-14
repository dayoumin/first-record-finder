/**
 * J-STAGE API 클라이언트
 *
 * 일본 학술지 논문 검색 (1880년대~현재)
 * 일제강점기(1910-1945) 한국 해역 논문 검색에 필수
 * API 문서: https://www.jstage.jst.go.jp/static/pages/JstageServices/TAB3/-char/ja
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

const JSTAGE_API_BASE = 'https://api.jstage.jst.go.jp/searchapi/do';

// API 호출 간격 (ms)
const API_DELAY = 1000;

// 일본어 한국 키워드 (식민지 시대 표기)
const JAPAN_KOREA_KEYWORDS = [
  '朝鮮',      // 조선
  '韓国',      // 한국
  '済州',      // 제주
  '釜山',      // 부산
  '仁川',      // 인천
  '元山',      // 원산
  '鬱陵',      // 울릉
  '日本海',    // 동해 (일본명)
  '黄海',      // 황해
  'Korea',
  'Korean',
  'Corea',
];

/**
 * XML 태그 및 CDATA 제거
 */
function stripXmlTags(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')  // CDATA 제거
    .replace(/<[^>]+>/g, '')                         // XML 태그 제거
    .trim();
}

// XML 파서 (간단한 구현)
function parseXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? stripXmlTags(match[1].trim()) : null;
}

function parseXmlArray(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
  const matches = xml.matchAll(regex);
  return Array.from(matches).map(m => stripXmlTags(m[1].trim()));
}

// J-STAGE 검색 결과 항목
interface JStageEntry {
  title: string | null;
  link: string | null;
  authorName: string[];
  publisherName: string | null;
  publicationName: string | null;  // 저널명
  issn: string | null;
  volume: string | null;
  issue: string | null;
  startingPage: string | null;
  endingPage: string | null;
  pubyear: string | null;
  doi: string | null;
  systemcode: string | null;
  systemname: string | null;
  cdjournal: string | null;
  materialTitle: string | null;
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * J-STAGE API 클라이언트
 */
export class JStageClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'jstage';
  private lastRequestTime = 0;

  /**
   * 학명으로 문헌 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    const items: LiteratureItem[] = [];

    try {
      // 1. 학명만으로 검색 (기본)
      const basicResults = await this.searchJStage(query, options);
      items.push(...basicResults);

      // 2. 한국 키워드와 함께 검색 (includeKoreaKeyword !== false인 경우)
      if (options?.includeKoreaKeyword !== false && items.length < (options?.maxResults || 20)) {
        for (const keyword of JAPAN_KOREA_KEYWORDS.slice(0, 3)) {  // 주요 키워드 3개만
          if (items.length >= (options?.maxResults || 20)) break;

          const keywordResults = await this.searchJStage(`${query} ${keyword}`, options);

          // 중복 제거
          for (const item of keywordResults) {
            if (!items.some(i => i.id === item.id || i.title === item.title)) {
              items.push(item);
            }
          }
        }
      }
    } catch (error) {
      console.error('[J-STAGE] Search error:', error);
      throw error;
    }

    // 결과 수 제한 및 연도순 정렬
    const maxResults = options?.maxResults || 20;
    return items
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .slice(0, maxResults);
  }

  /**
   * J-STAGE API 검색 실행
   */
  private async searchJStage(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      service: '3',        // 논문 검색
      article: query,      // 검색어 (제목/초록)
      count: '50',         // 결과 수
      start: '1',          // 시작 위치
    });

    // 연도 필터
    if (options?.yearFrom) {
      params.append('pubyearfrom', options.yearFrom.toString());
    }
    if (options?.yearTo) {
      params.append('pubyearto', options.yearTo.toString());
    }

    const url = `${JSTAGE_API_BASE}?${params}`;
    console.log(`[J-STAGE] Searching: ${query}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`J-STAGE API error: ${response.status}`);
    }

    const xml = await response.text();
    return this.parseResponse(xml, query);
  }

  /**
   * XML 응답 파싱
   */
  private parseResponse(xml: string, searchedName: string): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    // 각 entry 추출
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    const entries = xml.matchAll(entryRegex);

    for (const entryMatch of entries) {
      const entryXml = entryMatch[1];

      const entry: JStageEntry = {
        title: parseXmlValue(entryXml, 'article_title') || parseXmlValue(entryXml, 'title'),
        link: parseXmlValue(entryXml, 'article_link') || parseXmlValue(entryXml, 'link'),
        authorName: parseXmlArray(entryXml, 'author_name'),
        publisherName: parseXmlValue(entryXml, 'publisher_name'),
        publicationName: parseXmlValue(entryXml, 'publication_name'),
        issn: parseXmlValue(entryXml, 'online_issn') || parseXmlValue(entryXml, 'print_issn'),
        volume: parseXmlValue(entryXml, 'volume'),
        issue: parseXmlValue(entryXml, 'issue'),
        startingPage: parseXmlValue(entryXml, 'starting_page'),
        endingPage: parseXmlValue(entryXml, 'ending_page'),
        pubyear: parseXmlValue(entryXml, 'pubyear'),
        doi: parseXmlValue(entryXml, 'doi'),
        systemcode: parseXmlValue(entryXml, 'systemcode'),
        systemname: parseXmlValue(entryXml, 'systemname'),
        cdjournal: parseXmlValue(entryXml, 'cdjournal'),
        materialTitle: parseXmlValue(entryXml, 'material_title'),
      };

      // 제목이 없으면 건너뛰기
      if (!entry.title) continue;

      const year = entry.pubyear ? parseInt(entry.pubyear, 10) : null;
      const pages = entry.startingPage && entry.endingPage
        ? `${entry.startingPage}-${entry.endingPage}`
        : entry.startingPage || undefined;

      // PDF URL 생성 (J-STAGE 패턴)
      let pdfUrl: string | undefined;
      if (entry.cdjournal && entry.volume && entry.startingPage) {
        // 일반적인 J-STAGE PDF URL 패턴
        pdfUrl = `https://www.jstage.jst.go.jp/article/${entry.cdjournal}/${entry.volume}/${entry.issue || '_'}/${entry.cdjournal}_${entry.volume}_${entry.issue || ''}_${entry.startingPage}/_pdf`;
      }

      items.push({
        id: `jstage_${entry.doi || entry.systemcode || Date.now()}_${items.length}`,
        source: 'jstage',
        title: entry.title,
        authors: entry.authorName,
        year,
        journal: entry.publicationName || entry.materialTitle || undefined,
        volume: entry.volume || undefined,
        pages,
        doi: entry.doi || undefined,
        url: entry.link || `https://www.jstage.jst.go.jp/search/-char/ja?item=8&word=${encodeURIComponent(entry.title)}`,
        pdfUrl,
        searchedName,
        pdfDownloaded: false,
        analyzed: false,
      });
    }

    return items;
  }

  /**
   * PDF 다운로드
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    if (!item.pdfUrl) {
      // PDF URL이 없으면 페이지에서 찾기 시도
      const pdfUrl = await this.findPdfUrl(item.url);
      if (!pdfUrl) {
        return {
          itemId: item.id,
          success: false,
          error: 'No PDF URL available',
        };
      }
      item.pdfUrl = pdfUrl;
    }

    try {
      await this.rateLimit();

      console.log(`[J-STAGE] Downloading PDF: ${item.title}`);
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
      console.error(`[J-STAGE] Download error for ${item.id}:`, error);
      return {
        itemId: item.id,
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  /**
   * 페이지에서 PDF URL 찾기
   */
  private async findPdfUrl(pageUrl: string): Promise<string | null> {
    try {
      await this.rateLimit();

      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) return null;

      const html = await response.text();

      // PDF 링크 패턴 찾기
      const pdfPatterns = [
        /href="([^"]*\/_pdf[^"]*)"/i,
        /href="([^"]*\.pdf)"/i,
        /data-pdf-url="([^"]*)"/i,
      ];

      for (const pattern of pdfPatterns) {
        const match = html.match(pattern);
        if (match) {
          let pdfUrl = match[1];
          // 상대 URL인 경우 절대 URL로 변환
          if (pdfUrl.startsWith('/')) {
            pdfUrl = `https://www.jstage.jst.go.jp${pdfUrl}`;
          }
          return pdfUrl;
        }
      }

      return null;
    } catch {
      return null;
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
