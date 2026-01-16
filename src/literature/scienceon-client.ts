/**
 * ScienceON (KISTI) API 클라이언트
 *
 * 한국 과학기술 논문/특허/연구보고서 검색 - KISTI 과학기술 지식인프라
 * API: https://scienceon.kisti.re.kr/apigateway
 *
 * 지원 콘텐츠 타입:
 * - ARTI: 논문 (기본)
 * - PATE: 특허 (4,400만 건)
 * - REPO: 연구보고서 (39만 건)
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
  ScienceOnTarget,
  PatentItem,
  ReportItem,
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

// 특허 XML 응답 인터페이스
interface ScienceOnPatent {
  cn: string;              // 콘텐츠 ID
  title: string;           // 발명명칭
  applicant?: string;      // 출원인
  inventor?: string;       // 발명자
  appNo?: string;          // 출원번호
  appDate?: string;        // 출원일
  regNo?: string;          // 등록번호
  regDate?: string;        // 등록일
  pubNo?: string;          // 공개번호
  pubDate?: string;        // 공개일
  ipc?: string;            // IPC 분류
  cpc?: string;            // CPC 분류
  abstract?: string;       // 초록
  url?: string;            // 상세 URL
}

// 연구보고서 XML 응답 인터페이스
interface ScienceOnReport {
  cn: string;              // 콘텐츠 ID
  title: string;           // 보고서명
  author?: string;         // 연구책임자
  org?: string;            // 연구수행기관
  projectName?: string;    // 과제명
  projectNo?: string;      // 과제번호
  pubyear?: string;        // 발행연도
  ministry?: string;       // 소관부처
  researchType?: string;   // 연구유형
  abstract?: string;       // 초록
  url?: string;            // 상세 URL
  pdfUrl?: string;         // PDF URL
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
 * XML 텍스트에서 CDATA 포함 태그 값 추출
 */
function extractXmlValueWithCdata(xml: string, tagName: string): string {
  // CDATA 포함 패턴
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  // 일반 패턴
  return extractXmlValue(xml, tagName);
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
   * 학명으로 논문 검색 (ILiteratureClient 인터페이스 구현)
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    return this.searchArticles(query, options);
  }

  /**
   * 논문 검색 (ARTI)
   */
  async searchArticles(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    const xml = await this.callApi(query, 'ARTI', options);
    if (!xml) return [];

    return this.parseArticleResponse(xml, query, options);
  }

  /**
   * 특허 검색 (PATE)
   */
  async searchPatents(query: string, options?: SearchOptions): Promise<PatentItem[]> {
    const xml = await this.callApi(query, 'PATE', options);
    if (!xml) return [];

    return this.parsePatentResponse(xml, query);
  }

  /**
   * 연구보고서 검색 (REPO)
   */
  async searchReports(query: string, options?: SearchOptions): Promise<ReportItem[]> {
    const xml = await this.callApi(query, 'REPO', options);
    if (!xml) return [];

    return this.parseReportResponse(xml, query, options);
  }

  /**
   * 통합 검색 (논문 + 특허 + 보고서)
   */
  async searchAll(
    query: string,
    options?: SearchOptions
  ): Promise<{
    articles: LiteratureItem[];
    patents: PatentItem[];
    reports: ReportItem[];
  }> {
    // 병렬로 세 가지 타입 모두 검색
    const [articles, patents, reports] = await Promise.all([
      this.searchArticles(query, options),
      this.searchPatents(query, options),
      this.searchReports(query, options),
    ]);

    return { articles, patents, reports };
  }

  /**
   * ScienceON API 호출
   */
  private async callApi(
    query: string,
    target: ScienceOnTarget,
    options?: SearchOptions
  ): Promise<string | null> {
    const clientId = getClientId();
    const apiToken = getApiToken();

    if (!clientId || !apiToken) {
      console.warn('[ScienceON] API credentials not configured. Set SCIENCEON_CLIENT_ID and SCIENCEON_API_KEY.');
      return null;
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

    // 정렬 필드 (콘텐츠 타입별로 다름)
    const sortField = target === 'PATE' ? 'appDate' : 'pubyear';

    // URL 파라미터 구성
    const params = new URLSearchParams({
      client_id: clientId,
      token: apiToken,
      action: 'search',
      target,
      searchQuery: JSON.stringify(searchQuery),
      sortField,
      curPage: '1',
      rowCount: limit.toString(),
    });

    const url = `${SCIENCEON_API_BASE}?${params}`;
    const targetLabels: Record<ScienceOnTarget, string> = {
      ARTI: '논문',
      PATE: '특허',
      REPO: '보고서',
    };
    console.log(`[ScienceON] Searching ${targetLabels[target]}: ${query}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/xml',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[ScienceON] API error: ${response.status} - ${error}`);
        return null;
      }

      const xmlText = await response.text();

      // 에러 체크
      const errorCode = extractXmlValue(xmlText, 'errorCode');
      if (errorCode && errorCode !== '0') {
        const errorMsg = extractXmlValue(xmlText, 'errorMsg');
        console.error(`[ScienceON] API error: ${errorCode} - ${errorMsg}`);
        return null;
      }

      return xmlText;
    } catch (error) {
      console.error('[ScienceON] API call error:', error);
      return null;
    }
  }

  /**
   * 논문 XML 응답 파싱
   */
  private parseArticleResponse(
    xml: string,
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];
    const records = extractRecords(xml);

    for (const record of records) {
      const article: ScienceOnArticle = {
        cn: extractXmlValue(record, 'cn'),
        title: extractXmlValueWithCdata(record, 'title') || extractXmlValueWithCdata(record, 'titleEn'),
        author: extractXmlValue(record, 'author'),
        jtitle: extractXmlValue(record, 'jtitle'),
        pubyear: extractXmlValue(record, 'pubyear'),
        volume: extractXmlValue(record, 'volume'),
        issue: extractXmlValue(record, 'issue'),
        startpage: extractXmlValue(record, 'startpage'),
        endpage: extractXmlValue(record, 'endpage'),
        doi: extractXmlValue(record, 'doi'),
        abstract: extractXmlValueWithCdata(record, 'abstract'),
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
        relevanceScore: this.calculateArticleRelevance(article, searchedName),
        pdfDownloaded: false,
        analyzed: false,
      });
    }

    // 관련성 점수로 정렬
    items.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    console.log(`[ScienceON] Found ${items.length} articles`);

    return items;
  }

  /**
   * 특허 XML 응답 파싱
   */
  private parsePatentResponse(xml: string, searchedName: string): PatentItem[] {
    const items: PatentItem[] = [];
    const records = extractRecords(xml);

    for (const record of records) {
      const patent: ScienceOnPatent = {
        cn: extractXmlValue(record, 'cn'),
        title: extractXmlValueWithCdata(record, 'title') || extractXmlValueWithCdata(record, 'inventionTitle'),
        applicant: extractXmlValue(record, 'applicant') || extractXmlValue(record, 'applicantName'),
        inventor: extractXmlValue(record, 'inventor') || extractXmlValue(record, 'inventorName'),
        appNo: extractXmlValue(record, 'appNo') || extractXmlValue(record, 'applicationNumber'),
        appDate: extractXmlValue(record, 'appDate') || extractXmlValue(record, 'applicationDate'),
        regNo: extractXmlValue(record, 'regNo') || extractXmlValue(record, 'registrationNumber'),
        regDate: extractXmlValue(record, 'regDate') || extractXmlValue(record, 'registrationDate'),
        pubNo: extractXmlValue(record, 'pubNo') || extractXmlValue(record, 'publicationNumber'),
        pubDate: extractXmlValue(record, 'pubDate') || extractXmlValue(record, 'publicationDate'),
        ipc: extractXmlValue(record, 'ipc') || extractXmlValue(record, 'ipcCode'),
        cpc: extractXmlValue(record, 'cpc') || extractXmlValue(record, 'cpcCode'),
        abstract: extractXmlValueWithCdata(record, 'abstract'),
        url: extractXmlValue(record, 'url') || extractXmlValue(record, 'linkUrl'),
      };

      if (!patent.cn || !patent.title) continue;

      items.push({
        id: `scienceon_pate_${patent.cn}`,
        source: 'scienceon',
        contentType: 'PATE',
        title: patent.title,
        applicant: patent.applicant || '',
        inventor: patent.inventor,
        applicationNumber: patent.appNo || '',
        applicationDate: patent.appDate || '',
        registrationNumber: patent.regNo,
        registrationDate: patent.regDate,
        publicationNumber: patent.pubNo,
        publicationDate: patent.pubDate,
        ipcCodes: patent.ipc?.split(/[,;]/).map(c => c.trim()).filter(Boolean) || [],
        cpcCodes: patent.cpc?.split(/[,;]/).map(c => c.trim()).filter(Boolean),
        abstract: patent.abstract,
        url: patent.url || `https://scienceon.kisti.re.kr/srch/selectPORSrchPatent.do?cn=${patent.cn}`,
        searchedName,
      });
    }

    console.log(`[ScienceON] Found ${items.length} patents`);
    return items;
  }

  /**
   * 연구보고서 XML 응답 파싱
   */
  private parseReportResponse(
    xml: string,
    searchedName: string,
    options?: SearchOptions
  ): ReportItem[] {
    const items: ReportItem[] = [];
    const records = extractRecords(xml);

    for (const record of records) {
      const report: ScienceOnReport = {
        cn: extractXmlValue(record, 'cn'),
        title: extractXmlValueWithCdata(record, 'title') || extractXmlValueWithCdata(record, 'reportTitle'),
        author: extractXmlValue(record, 'author') || extractXmlValue(record, 'researcher'),
        org: extractXmlValue(record, 'org') || extractXmlValue(record, 'organization'),
        projectName: extractXmlValueWithCdata(record, 'projectName') || extractXmlValueWithCdata(record, 'projectTitle'),
        projectNo: extractXmlValue(record, 'projectNo') || extractXmlValue(record, 'projectNumber'),
        pubyear: extractXmlValue(record, 'pubyear') || extractXmlValue(record, 'year'),
        ministry: extractXmlValue(record, 'ministry'),
        researchType: extractXmlValue(record, 'researchType'),
        abstract: extractXmlValueWithCdata(record, 'abstract'),
        url: extractXmlValue(record, 'url') || extractXmlValue(record, 'linkUrl'),
        pdfUrl: extractXmlValue(record, 'pdfUrl') || extractXmlValue(record, 'fullTextUrl'),
      };

      if (!report.cn || !report.title) continue;

      const year = report.pubyear ? parseInt(report.pubyear, 10) : null;

      // 연도 필터
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      items.push({
        id: `scienceon_repo_${report.cn}`,
        source: 'scienceon',
        contentType: 'REPO',
        title: report.title,
        authors: report.author?.split(/[,;]/).map(a => a.trim()).filter(Boolean) || [],
        organization: report.org || '',
        projectName: report.projectName,
        projectNumber: report.projectNo,
        year,
        ministry: report.ministry,
        researchType: report.researchType,
        abstract: report.abstract,
        url: report.url || `https://scienceon.kisti.re.kr/srch/selectPORSrchReport.do?cn=${report.cn}`,
        pdfUrl: report.pdfUrl,
        searchedName,
      });
    }

    console.log(`[ScienceON] Found ${items.length} reports`);
    return items;
  }

  /**
   * 논문 관련성 점수 계산
   */
  private calculateArticleRelevance(article: ScienceOnArticle, searchedName: string): number {
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
