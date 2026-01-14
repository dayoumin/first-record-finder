/**
 * GBIF (Global Biodiversity Information Facility) API 클라이언트
 *
 * 전 세계 생물다양성 표본/관찰 데이터
 * 문헌 기록을 표본 데이터로 검증하거나, 문헌보다 오래된 표본 기록 발견 가능
 * API 문서: https://www.gbif.org/developer/summary
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

const GBIF_API_BASE = 'https://api.gbif.org/v1';

// API 호출 간격 (ms)
const API_DELAY = 300;

// 한국 국가 코드
const KOREA_COUNTRY_CODE = 'KR';

// GBIF Occurrence 응답 타입
interface GBIFOccurrenceResponse {
  offset: number;
  limit: number;
  endOfRecords: boolean;
  count: number;
  results: GBIFOccurrence[];
}

interface GBIFOccurrence {
  key: number;
  datasetKey: string;
  publishingOrgKey: string;
  publishingCountry: string;
  protocol: string;
  lastCrawled: string;
  lastParsed: string;
  crawlId: number;
  basisOfRecord: string;   // PRESERVED_SPECIMEN, HUMAN_OBSERVATION, etc.
  taxonKey: number;
  kingdomKey: number;
  phylumKey: number;
  classKey: number;
  orderKey: number;
  familyKey: number;
  genusKey: number;
  speciesKey: number;
  acceptedTaxonKey: number;
  scientificName: string;
  acceptedScientificName: string;
  kingdom: string;
  phylum: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  genericName: string;
  specificEpithet: string;
  taxonRank: string;
  country: string;
  countryCode: string;
  locality: string;
  stateProvince: string;
  decimalLatitude: number;
  decimalLongitude: number;
  coordinateUncertaintyInMeters: number;
  eventDate: string;
  day: number;
  month: number;
  year: number;
  institutionCode: string;
  collectionCode: string;
  catalogNumber: string;
  recordNumber: string;
  identifiedBy: string;
  dateIdentified: string;
  recordedBy: string;
  occurrenceStatus: string;
  references: string;      // 문헌 참조
  license: string;
  rightsHolder: string;
  occurrenceID: string;
  datasetName: string;
  // 추가 필드들...
}

// Species 검색 응답 타입
interface GBIFSpeciesSearchResponse {
  offset: number;
  limit: number;
  endOfRecords: boolean;
  results: GBIFSpecies[];
}

interface GBIFSpecies {
  key: number;
  nubKey: number;
  nameKey: number;
  taxonID: string;
  sourceTaxonKey: number;
  kingdom: string;
  phylum: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  kingdomKey: number;
  phylumKey: number;
  classKey: number;
  orderKey: number;
  familyKey: number;
  genusKey: number;
  speciesKey: number;
  datasetKey: string;
  constituentKey: string;
  parentKey: number;
  parent: string;
  scientificName: string;
  canonicalName: string;
  vernacularName: string;
  authorship: string;
  nameType: string;
  rank: string;
  origin: string;
  taxonomicStatus: string;
  nomenclaturalStatus: string[];
  remarks: string;
  numDescendants: number;
  lastCrawled: string;
  lastInterpreted: string;
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GBIF API 클라이언트
 */
export class GBIFClient implements ILiteratureClient {
  readonly source: LiteratureSource = 'gbif';
  private lastRequestTime = 0;

  /**
   * 학명으로 표본 데이터 검색
   */
  async search(query: string, options?: SearchOptions): Promise<LiteratureItem[]> {
    const items: LiteratureItem[] = [];

    try {
      // 1. 먼저 종 키 조회
      const speciesKey = await this.findSpeciesKey(query);

      // 2. 한국 표본 데이터 검색
      const occurrences = await this.searchOccurrences(
        speciesKey ? { speciesKey } : { scientificName: query },
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
      console.error('[GBIF] Search error:', error);
      throw error;
    }

    // 연도순 정렬 및 결과 수 제한
    const maxResults = options?.maxResults || 20;
    return items
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .slice(0, maxResults);
  }

  /**
   * 종 키 조회 (GBIF Backbone Taxonomy의 nubKey 사용)
   */
  private async findSpeciesKey(scientificName: string): Promise<number | null> {
    await this.rateLimit();

    const params = new URLSearchParams({
      q: scientificName,
      rank: 'SPECIES',
      limit: '5',  // 여러 결과 중 nubKey가 있는 것 찾기
    });

    const url = `${GBIF_API_BASE}/species/search?${params}`;
    console.log(`[GBIF] Finding species key for: ${scientificName}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[GBIF] Species search failed: ${response.status}`);
      return null;
    }

    const data: GBIFSpeciesSearchResponse = await response.json();

    // nubKey (GBIF Backbone Taxonomy key) 우선 사용
    // nubKey가 occurrence 검색에서 실제로 동작함
    for (const result of data.results) {
      if (result.nubKey) {
        console.log(`[GBIF] Found nubKey: ${result.nubKey} for ${scientificName}`);
        return result.nubKey;
      }
    }

    // nubKey가 없으면 speciesKey 시도
    if (data.results.length > 0 && data.results[0].speciesKey) {
      return data.results[0].speciesKey;
    }

    return data.results.length > 0 ? data.results[0].key : null;
  }

  /**
   * 표본 데이터 검색
   */
  private async searchOccurrences(
    searchParams: { speciesKey?: number; scientificName?: string },
    options?: SearchOptions
  ): Promise<GBIFOccurrence[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      country: KOREA_COUNTRY_CODE,  // 한국 기록만
      limit: '100',
    });

    if (searchParams.speciesKey) {
      params.append('speciesKey', searchParams.speciesKey.toString());
    } else if (searchParams.scientificName) {
      params.append('scientificName', searchParams.scientificName);
    }

    // 연도 필터
    if (options?.yearFrom) {
      params.append('year', `${options.yearFrom},${options.yearTo || 2030}`);
    } else if (options?.yearTo) {
      params.append('year', `1700,${options.yearTo}`);
    }

    const url = `${GBIF_API_BASE}/occurrence/search?${params}`;
    console.log(`[GBIF] Searching occurrences in Korea`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GBIF API error: ${response.status}`);
    }

    const data: GBIFOccurrenceResponse = await response.json();
    return data.results;
  }

  /**
   * GBIF Occurrence를 LiteratureItem으로 변환
   */
  private convertToLiteratureItem(occ: GBIFOccurrence, searchedName: string): LiteratureItem | null {
    // 기본 정보가 없으면 제외
    if (!occ.scientificName) return null;

    // 제목 생성 (표본 정보 기반)
    const title = this.generateTitle(occ);

    // 저자 (기록자)
    const authors: string[] = [];
    if (occ.recordedBy) {
      authors.push(occ.recordedBy);
    }
    if (occ.identifiedBy && occ.identifiedBy !== occ.recordedBy) {
      authors.push(`(ID: ${occ.identifiedBy})`);
    }

    // 채집지 정보
    const locality = [
      occ.stateProvince,
      occ.locality,
    ].filter(Boolean).join(', ') || 'Korea';

    return {
      id: `gbif_${occ.key}`,
      source: 'gbif',
      title,
      authors,
      year: occ.year || null,
      journal: occ.datasetName || occ.institutionCode,
      volume: occ.collectionCode || undefined,
      pages: occ.catalogNumber || undefined,
      url: `https://www.gbif.org/occurrence/${occ.key}`,
      searchedName,
      snippet: `${occ.basisOfRecord} | ${locality} | ${occ.eventDate || occ.year || 'date unknown'} | ${occ.institutionCode || ''}`,
      relevanceScore: this.calculateRelevance(occ),
      pdfDownloaded: false,
      analyzed: false,
    };
  }

  /**
   * 표본 제목 생성
   */
  private generateTitle(occ: GBIFOccurrence): string {
    const parts: string[] = [occ.scientificName];

    if (occ.institutionCode) {
      parts.push(`[${occ.institutionCode}]`);
    }

    if (occ.catalogNumber) {
      parts.push(occ.catalogNumber);
    }

    if (occ.locality) {
      parts.push(`- ${occ.locality}`);
    }

    return parts.join(' ');
  }

  /**
   * 관련성 점수 계산
   */
  private calculateRelevance(occ: GBIFOccurrence): number {
    let score = 0.5;

    // PRESERVED_SPECIMEN이면 가산점 (실제 표본)
    if (occ.basisOfRecord === 'PRESERVED_SPECIMEN') {
      score += 0.2;
    }

    // 좌표 정보가 있으면 가산점
    if (occ.decimalLatitude && occ.decimalLongitude) {
      score += 0.1;
    }

    // 정확한 날짜가 있으면 가산점
    if (occ.day && occ.month && occ.year) {
      score += 0.1;
    }

    // 문헌 참조가 있으면 가산점
    if (occ.references) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * PDF 다운로드 (GBIF는 표본 데이터라 PDF 없음)
   */
  async downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult> {
    // GBIF는 표본 데이터베이스라 PDF가 없음
    // 대신 메타데이터를 JSON으로 저장
    try {
      const occurrenceId = item.id.replace('gbif_', '');
      await this.rateLimit();

      const url = `${GBIF_API_BASE}/occurrence/${occurrenceId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch occurrence: ${response.status}`);
      }

      const data = await response.json();

      // JSON으로 저장 (PDF 대신)
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
