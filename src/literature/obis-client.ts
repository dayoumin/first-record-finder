/**
 * OBIS (Ocean Biodiversity Information System) API 클라이언트
 *
 * 해양생물 분포 데이터베이스
 * GBIF 보완, 해양생물 특화
 * API 문서: https://api.obis.org/
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

const OBIS_API_BASE = 'https://api.obis.org/v3';

// API 호출 간격 (ms)
const API_DELAY = 500;

// 한국 해역 WKT (대략적인 경계)
// 한반도 주변 해역을 포함하는 polygon
const KOREA_WATERS_GEOMETRY = 'POLYGON((124 33, 124 43, 132 43, 132 33, 124 33))';

// OBIS Occurrence 응답 타입
interface OBISOccurrenceResponse {
  total: number;
  results: OBISOccurrence[];
}

interface OBISOccurrence {
  id: number;
  datasetID: string;
  decimalLongitude: number;
  decimalLatitude: number;
  eventDate: string;
  coordinateUncertaintyInMeters: number;
  depth: number;
  minimumDepthInMeters: number;
  maximumDepthInMeters: number;
  scientificName: string;
  originalScientificName: string;
  scientificNameAuthorship: string;
  aphiaID: number;        // WoRMS AphiaID
  taxonRank: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  specificEpithet: string;
  basisOfRecord: string;
  occurrenceStatus: string;
  eventID: string;
  locality: string;
  country: string;
  recordedBy: string;
  identifiedBy: string;
  catalogNumber: string;
  collectionCode: string;
  institutionCode: string;
  datasetName: string;
  bibliographicCitation: string;
  references: string;
  year: number;
  month: number;
  day: number;
  dateIdentified: string;
  modified: string;
  rightsHolder: string;
  ownerInstitutionCode: string;
  dropped: boolean;
  absence: boolean;
  flags: string[];
}

// Taxon 검색 응답 타입
interface OBISTaxonResponse {
  total: number;
  results: OBISTaxon[];
}

interface OBISTaxon {
  taxonID: number;
  scientificName: string;
  scientificNameAuthorship: string;
  acceptedNameUsage: string;
  acceptedNameUsageID: number;
  taxonomicStatus: string;
  taxonRank: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  records: number;
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * OBIS API 클라이언트
 */
export class OBISClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'obis';
  private lastRequestTime = 0;

  /**
   * 학명으로 해양생물 분포 데이터 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    const items: LiteratureItem[] = [];

    try {
      // 1. 먼저 taxon 검색으로 AphiaID 획득
      const taxonId = await this.findTaxonId(query);

      // 2. 한국 해역 occurrence 검색
      const occurrences = await this.searchOccurrences(
        taxonId ? { taxonId } : { scientificName: query },
        options
      );

      // 3. LiteratureItem으로 변환
      for (const occ of occurrences) {
        const item = this.convertToLiteratureItem(occ, query);
        if (item) {
          items.push(item);
        }
      }
    } catch (error) {
      console.error('[OBIS] Search error:', error);
      throw error;
    }

    // 연도순 정렬 및 결과 수 제한
    const maxResults = options?.maxResults || 20;
    return items
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .slice(0, maxResults);
  }

  /**
   * Taxon ID (AphiaID) 조회
   */
  private async findTaxonId(scientificName: string): Promise<number | null> {
    await this.rateLimit();

    const params = new URLSearchParams({
      scientificname: scientificName,
    });

    const url = `${OBIS_API_BASE}/taxon?${params}`;
    console.log(`[OBIS] Finding taxon ID for: ${scientificName}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[OBIS] Taxon search failed: ${response.status}`);
      return null;
    }

    const data: OBISTaxonResponse = await response.json();
    return data.results.length > 0 ? data.results[0].taxonID : null;
  }

  /**
   * 한국 해역 occurrence 검색
   */
  private async searchOccurrences(
    searchParams: { taxonId?: number; scientificName?: string },
    options?: SearchOptions
  ): Promise<OBISOccurrence[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      geometry: KOREA_WATERS_GEOMETRY,  // 한국 해역
      size: '100',
    });

    if (searchParams.taxonId) {
      params.append('taxonid', searchParams.taxonId.toString());
    } else if (searchParams.scientificName) {
      params.append('scientificname', searchParams.scientificName);
    }

    // 연도 필터
    if (options?.yearFrom) {
      params.append('startdate', `${options.yearFrom}-01-01`);
    }
    if (options?.yearTo) {
      params.append('enddate', `${options.yearTo}-12-31`);
    }

    const url = `${OBIS_API_BASE}/occurrence?${params}`;
    console.log(`[OBIS] Searching occurrences in Korean waters`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OBIS API error: ${response.status}`);
    }

    const data: OBISOccurrenceResponse = await response.json();
    return data.results;
  }

  /**
   * OBIS Occurrence를 LiteratureItem으로 변환
   */
  private convertToLiteratureItem(occ: OBISOccurrence, searchedName: string): LiteratureItem | null {
    // 기본 정보가 없으면 제외
    if (!occ.scientificName) return null;

    // 제목 생성
    const title = this.generateTitle(occ);

    // 저자 (기록자)
    const authors: string[] = [];
    if (occ.recordedBy) {
      authors.push(occ.recordedBy);
    }
    if (occ.identifiedBy && occ.identifiedBy !== occ.recordedBy) {
      authors.push(`(ID: ${occ.identifiedBy})`);
    }

    // 위치 정보
    const locationInfo = this.generateLocationInfo(occ);

    // 깊이 정보
    const depthInfo = this.generateDepthInfo(occ);

    return {
      id: `obis_${occ.id}`,
      source: 'obis',
      title,
      authors,
      year: occ.year || null,
      journal: occ.datasetName || occ.institutionCode,
      volume: occ.collectionCode || undefined,
      pages: occ.catalogNumber || undefined,
      url: `https://obis.org/occurrence/${occ.id}`,
      searchedName,
      snippet: `${occ.basisOfRecord || 'record'} | ${locationInfo} | ${occ.eventDate || occ.year || 'date unknown'}${depthInfo ? ` | depth: ${depthInfo}` : ''}`,
      relevanceScore: this.calculateRelevance(occ),
      pdfDownloaded: false,
      analyzed: false,
    };
  }

  /**
   * 제목 생성
   */
  private generateTitle(occ: OBISOccurrence): string {
    const parts: string[] = [occ.scientificName];

    if (occ.scientificNameAuthorship) {
      parts.push(occ.scientificNameAuthorship);
    }

    if (occ.institutionCode) {
      parts.push(`[${occ.institutionCode}]`);
    }

    if (occ.catalogNumber) {
      parts.push(occ.catalogNumber);
    }

    return parts.join(' ');
  }

  /**
   * 위치 정보 생성
   */
  private generateLocationInfo(occ: OBISOccurrence): string {
    const parts: string[] = [];

    if (occ.locality) {
      parts.push(occ.locality);
    } else if (occ.country) {
      parts.push(occ.country);
    }

    if (occ.decimalLatitude && occ.decimalLongitude) {
      parts.push(`(${occ.decimalLatitude.toFixed(2)}°N, ${occ.decimalLongitude.toFixed(2)}°E)`);
    }

    return parts.length > 0 ? parts.join(' ') : 'Korean waters';
  }

  /**
   * 깊이 정보 생성
   */
  private generateDepthInfo(occ: OBISOccurrence): string | null {
    if (occ.depth) {
      return `${occ.depth}m`;
    }
    if (occ.minimumDepthInMeters !== undefined && occ.maximumDepthInMeters !== undefined) {
      if (occ.minimumDepthInMeters === occ.maximumDepthInMeters) {
        return `${occ.minimumDepthInMeters}m`;
      }
      return `${occ.minimumDepthInMeters}-${occ.maximumDepthInMeters}m`;
    }
    return null;
  }

  /**
   * 관련성 점수 계산
   */
  private calculateRelevance(occ: OBISOccurrence): number {
    let score = 0.5;

    // PRESERVED_SPECIMEN이면 가산점
    if (occ.basisOfRecord === 'PreservedSpecimen') {
      score += 0.2;
    }

    // 좌표 정확도가 좋으면 가산점
    if (occ.coordinateUncertaintyInMeters && occ.coordinateUncertaintyInMeters < 1000) {
      score += 0.1;
    }

    // 정확한 날짜가 있으면 가산점
    if (occ.day && occ.month && occ.year) {
      score += 0.1;
    }

    // 깊이 정보가 있으면 가산점
    if (occ.depth || occ.minimumDepthInMeters !== undefined) {
      score += 0.05;
    }

    // 문헌 참조가 있으면 가산점
    if (occ.bibliographicCitation || occ.references) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * PDF 다운로드 (OBIS는 표본 데이터라 PDF 없음)
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    // OBIS는 표본 데이터베이스라 PDF가 없음
    // 대신 메타데이터를 JSON으로 저장
    try {
      const occurrenceId = item.id.replace('obis_', '');
      await this.rateLimit();

      const url = `${OBIS_API_BASE}/occurrence/${occurrenceId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch occurrence: ${response.status}`);
      }

      const data = await response.json();

      // JSON으로 저장
      const jsonPath = destPath.replace(/\.pdf$/i, '.json');
      const dir = path.dirname(jsonPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

      return {
        itemId: item.id,
        success: true,
        pdfPath: jsonPath,
        fileSize: Buffer.from(JSON.stringify(data)).length,
      };
    } catch (error) {
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
