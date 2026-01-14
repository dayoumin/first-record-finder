/**
 * BHL (Biodiversity Heritage Library) API 클라이언트
 *
 * 역사적 생물학 문헌 검색 (1800년대~)
 * API 문서: https://www.biodiversitylibrary.org/api3
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

const BHL_API_BASE = 'https://www.biodiversitylibrary.org/api3';
const BHL_API_KEY = process.env.BHL_API_KEY || '';  // 필수 - https://www.biodiversitylibrary.org/api2/key 에서 발급

// API 호출 간격 (ms)
const API_DELAY = 500;

// BHL 검색 결과 타입
interface BhlSearchResult {
  Status: string;
  Result: BhlItem[];
}

interface BhlItem {
  ItemID: number;
  TitleID: number;
  PrimaryTitleID: number;
  ThumbnailPageID: number;
  Source: string;
  SourceIdentifier: string;
  Volume: string;
  Year: string;
  Title: string;
  Authors: BhlAuthor[];
  Genre: string;
  MaterialType: string;
  PublicationDetails: string;
  Url: string;
  DownloadUrl: string;
  ItemUrl: string;
  ItemPDFUrl?: string;
  PartUrl?: string;
  PartID?: number;
}

interface BhlAuthor {
  Name: string;
  Dates: string;
  Role: string;
}

// Part 검색 결과 (논문/챕터)
interface BhlPartSearchResult {
  Status: string;
  Result: BhlPart[];
}

interface BhlPart {
  PartID: number;
  ItemID: number;
  StartPageID: number;
  SequenceOrder: number;
  Genre: string;
  Title: string;
  ContainerTitle: string;
  PublicationDetails: string;
  Volume: string;
  Series: string;
  Issue: string;
  Date: string;
  PageRange: string;
  StartPageNumber: string;
  EndPageNumber: string;
  Language: string;
  ExternalUrl: string;
  DownloadUrl: string;
  RightsStatus: string;
  Doi: string;
  Authors: BhlAuthor[];
  Subjects: string[];
  PartUrl: string;
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * BHL API 클라이언트
 */
export class BhlClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'bhl';
  private lastRequestTime = 0;

  /**
   * 학명으로 문헌 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    // API 키 확인 - 없으면 빈 결과 반환 (에러 대신)
    if (!BHL_API_KEY) {
      console.log('[BHL] Skipped - API key not configured');
      return [];
    }

    const items: LiteratureItem[] = [];

    try {
      // 1. Part(논문/챕터) 검색 - 더 정확한 결과
      const parts = await this.searchParts(query, options);
      items.push(...parts);

      // 2. Item(책/저널) 검색 - 추가 결과
      if (items.length < (options?.maxResults || 20)) {
        const itemResults = await this.searchItems(query, options);
        // 중복 제거
        for (const item of itemResults) {
          if (!items.some(i => i.id === item.id)) {
            items.push(item);
          }
        }
      }
    } catch (error) {
      console.error('[BHL] Search error:', error);
      throw error;
    }

    // 결과 수 제한
    const maxResults = options?.maxResults || 20;
    return items.slice(0, maxResults);
  }

  /**
   * Part(논문/챕터) 검색
   */
  private async searchParts(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      op: 'PartSearch',
      searchterm: query,
      searchtype: 'C',  // Contains
      format: 'json',
    });

    if (BHL_API_KEY) {
      params.append('apikey', BHL_API_KEY);
    }

    const url = `${BHL_API_BASE}?${params}`;
    console.log(`[BHL] Searching parts: ${query}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BHL API error: ${response.status}`);
    }

    const data: BhlPartSearchResult = await response.json();

    if (data.Status !== 'ok') {
      console.warn('[BHL] Search returned non-ok status:', data.Status);
      return [];
    }

    return this.convertParts(data.Result, query, options);
  }

  /**
   * Item(책/저널) 검색
   */
  private async searchItems(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      op: 'PublicationSearchAdvanced',
      title: query,
      format: 'json',
    });

    if (BHL_API_KEY) {
      params.append('apikey', BHL_API_KEY);
    }

    const url = `${BHL_API_BASE}?${params}`;
    console.log(`[BHL] Searching items: ${query}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BHL API error: ${response.status}`);
    }

    const data: BhlSearchResult = await response.json();

    if (data.Status !== 'ok') {
      console.warn('[BHL] Search returned non-ok status:', data.Status);
      return [];
    }

    return this.convertItems(data.Result, query, options);
  }

  /**
   * Part 결과를 LiteratureItem으로 변환
   */
  private convertParts(
    parts: BhlPart[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    for (const part of parts) {
      const year = this.parseYear(part.Date);

      // 연도 필터
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      items.push({
        id: `bhl_part_${part.PartID}`,
        source: 'bhl',
        title: part.Title || part.ContainerTitle,
        authors: part.Authors?.map(a => a.Name) || [],
        year,
        journal: part.ContainerTitle,
        volume: part.Volume,
        pages: part.PageRange,
        doi: part.Doi || undefined,
        url: part.PartUrl || part.ExternalUrl,
        pdfUrl: part.DownloadUrl || undefined,
        searchedName,
        pdfDownloaded: false,
        analyzed: false,
      });
    }

    return items;
  }

  /**
   * Item 결과를 LiteratureItem으로 변환
   */
  private convertItems(
    bhlItems: BhlItem[],
    searchedName: string,
    options?: SearchOptions
  ): LiteratureItem[] {
    const items: LiteratureItem[] = [];

    for (const item of bhlItems) {
      const year = this.parseYear(item.Year);

      // 연도 필터
      if (options?.yearFrom && year && year < options.yearFrom) continue;
      if (options?.yearTo && year && year > options.yearTo) continue;

      items.push({
        id: `bhl_item_${item.ItemID}`,
        source: 'bhl',
        title: item.Title,
        authors: item.Authors?.map(a => a.Name) || [],
        year,
        journal: item.PublicationDetails,
        volume: item.Volume,
        url: item.ItemUrl || item.Url,
        pdfUrl: item.ItemPDFUrl || item.DownloadUrl || undefined,
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
      return {
        itemId: item.id,
        success: false,
        error: 'No PDF URL available',
      };
    }

    try {
      await this.rateLimit();

      console.log(`[BHL] Downloading PDF: ${item.title}`);
      const response = await fetch(item.pdfUrl);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
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
      console.error(`[BHL] Download error for ${item.id}:`, error);
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

  /**
   * 연도 파싱
   */
  private parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;

    // "1880", "1880-1885", "c1900" 등 처리
    const match = dateStr.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
  }
}
