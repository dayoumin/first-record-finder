/**
 * KCI (한국학술지인용색인) API 클라이언트
 *
 * 한국 학술 논문 검색 - 최근 한국 해역 신규 기록 문헌 검색용
 * API: 공공데이터포털 KCI논문정보 OpenAPI
 * https://www.data.go.kr/data/3049042/openapi.do
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

const KCI_API_BASE = 'http://open.kci.go.kr/openapi/search';
const API_KEY = process.env.KCI_API_KEY || '';

// API 호출 간격 (ms)
const API_DELAY = 500;

// KCI API 응답 타입
interface KciSearchResponse {
  outputData: {
    resultCode: string;
    resultMessage: string;
    result: KciArticle[];
    totalCount: number;
  };
}

interface KciArticle {
  articleId: string;
  title: string;
  titleEn?: string;
  author?: string;          // 저자 (쉼표 구분)
  journalName?: string;
  issn?: string;
  volume?: string;
  issue?: string;
  startPage?: string;
  endPage?: string;
  pubYear?: string;
  pubMonth?: string;
  abstract?: string;
  abstractEn?: string;
  keyword?: string;
  doi?: string;
  url?: string;
  citation?: number;        // 피인용 횟수
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * KCI API 클라이언트
 */
export class KciClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'kci';
  private lastRequestTime = 0;

  /**
   * 학명으로 논문 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    if (!API_KEY) {
      console.warn('[KCI] API key not configured. Set KCI_API_KEY environment variable.');
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.maxResults || 20, 100);

    // KCI API 파라미터 구성
    const params = new URLSearchParams({
      apiCode: 'articleSearch',
      key: API_KEY,
      title: query,              // 논문 제목에서 검색
      displayCount: limit.toString(),
      page: '1',
    });

    // 연도 필터
    if (options?.yearFrom) {
      params.append('startYear', options.yearFrom.toString());
    }
    if (options?.yearTo) {
      params.append('endYear', options.yearTo.toString());
    }

    const url = `${KCI_API_BASE}/articleSearch?${params}`;
    console.log(`[KCI] Searching: ${query}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[KCI] API error: ${response.status} - ${error}`);
        return [];
      }

      const data: KciSearchResponse = await response.json();

      if (data.outputData.resultCode !== 'S') {
        console.error(`[KCI] Search failed: ${data.outputData.resultMessage}`);
        return [];
      }

      const items = this.convertArticles(data.outputData.result || [], query, options);
      console.log(`[KCI] Found ${items.length} articles`);

      return items;
    } catch (error) {
      console.error('[KCI] Search error:', error);
      return [];
    }
  }

  /**
   * 검색 결과를 LiteratureItem으로 변환
   */
  private convertArticles(
    articles: KciArticle[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    for (const article of articles) {
      const year = article.pubYear ? parseInt(article.pubYear, 10) : null;

      // 연도 필터
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      const pages = article.startPage && article.endPage
        ? `${article.startPage}-${article.endPage}`
        : article.startPage || undefined;

      items.push({
        id: `kci_${article.articleId}`,
        source: 'kci',
        title: article.title || article.titleEn || '',
        authors: article.author?.split(',').map(a => a.trim()) || [],
        year,
        journal: article.journalName,
        volume: article.volume,
        pages,
        doi: article.doi,
        url: article.url || `https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=${article.articleId}`,
        pdfUrl: undefined,  // KCI는 직접 PDF 제공 안 함
        searchedName,
        snippet: article.abstract?.slice(0, 300) || article.abstractEn?.slice(0, 300),
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
  private calculateRelevance(article: KciArticle, searchedName: string): number {
    let score = 0.5;

    // 제목에 학명이 포함되면 가산점
    const title = (article.title || '') + (article.titleEn || '');
    if (title.toLowerCase().includes(searchedName.toLowerCase())) {
      score += 0.3;
    }

    // 초록에 학명이 포함되면 가산점
    const abstract = (article.abstract || '') + (article.abstractEn || '');
    if (abstract.toLowerCase().includes(searchedName.toLowerCase())) {
      score += 0.1;
    }

    // 피인용 횟수 기반 가산점 (최대 0.1)
    if (article.citation) {
      score += Math.min(article.citation / 50, 0.1);
    }

    return Math.min(score, 1.0);
  }

  /**
   * PDF 다운로드 - KCI는 직접 다운로드 미지원
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    // KCI는 PDF 직접 다운로드를 제공하지 않음
    // 사용자가 직접 KCI 사이트에서 다운로드 필요
    return {
      itemId: item.id,
      success: false,
      error: 'KCI does not provide direct PDF download. Please download manually from the KCI website.',
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
