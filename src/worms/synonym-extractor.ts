/**
 * WoRMS API를 통한 이명(synonym) 추출 모듈
 *
 * 주요 기능:
 * - 학명으로 AphiaID 조회
 * - 해당 종의 모든 이명 추출
 * - 원기재 정보 추출
 */

import { fetchWithRetry, delay } from '../utils/fetchWithRetry';
import { WormsSynonym, WormsRecord } from '../types';

const WORMS_BASE_URL = 'https://www.marinespecies.org/rest';

// WoRMS API 응답 타입
interface WormsApiRecord {
  AphiaID: number;
  scientificname: string;
  authority: string;
  status: string;
  rank: string;
  valid_AphiaID?: number;
  valid_name?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  isMarine?: number;
  isBrackish?: number;
  isFreshwater?: number;
  isTerrestrial?: number;
  modified?: string;
}

interface WormsSynonymApiRecord {
  AphiaID: number;
  scientificname: string;
  authority: string;
  status: string;
}

interface WormsSourceRecord {
  source_id: number;
  use: string;
  reference: string;
  link?: string;
  doi?: string;
}

export interface SynonymExtractionResult {
  success: boolean;
  inputName: string;

  // 유효 학명 정보
  acceptedName: string | null;
  aphiaId: number | null;
  authority: string | null;
  status: string | null;

  // 분류 정보
  taxonomy: {
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus?: string;
    rank?: string;
  };

  // 이명 목록
  synonyms: WormsSynonym[];

  // 원기재 정보
  originalDescription?: {
    reference: string;
    link?: string;
    doi?: string;
  };

  // 에러 정보
  error?: string;
}

/**
 * 학명으로 WoRMS 레코드 조회
 */
async function fetchWormsRecord(scientificName: string): Promise<WormsApiRecord | null> {
  const encodedName = encodeURIComponent(scientificName);
  const url = `${WORMS_BASE_URL}/AphiaRecordsByMatchNames?scientificnames[]=${encodedName}&marine_only=false`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`WoRMS API error: ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0])) {
      return null;
    }

    const records = data[0] as WormsApiRecord[];

    // 정확한 매칭 찾기
    const normalizedInput = scientificName.toLowerCase().trim();
    const exactMatch = records.find(r =>
      r.scientificname.toLowerCase().trim() === normalizedInput
    );

    return exactMatch || records[0] || null;
  } catch (error) {
    console.error('WoRMS record fetch error:', error);
    throw error;
  }
}

/**
 * AphiaID로 이명 목록 조회
 */
async function fetchSynonyms(aphiaId: number): Promise<WormsSynonymApiRecord[]> {
  const url = `${WORMS_BASE_URL}/AphiaSynonymsByAphiaID/${aphiaId}`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 204 || !response.ok) {
      return [];
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }

    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('WoRMS synonyms fetch error:', error);
    return [];
  }
}

/**
 * AphiaID로 원기재 정보 조회
 */
async function fetchSources(aphiaId: number): Promise<WormsSourceRecord[]> {
  const url = `${WORMS_BASE_URL}/AphiaSourcesByAphiaID/${aphiaId}`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 204 || !response.ok) {
      return [];
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }

    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('WoRMS sources fetch error:', error);
    return [];
  }
}

/**
 * AphiaID로 상세 레코드 조회
 */
async function fetchRecordById(aphiaId: number): Promise<WormsApiRecord | null> {
  const url = `${WORMS_BASE_URL}/AphiaRecordByAphiaID/${aphiaId}`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 204 || !response.ok) {
      return null;
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    return JSON.parse(text) as WormsApiRecord;
  } catch (error) {
    console.error('WoRMS record by ID fetch error:', error);
    return null;
  }
}

/**
 * 저자 정보에서 연도 추출
 */
function extractYearFromAuthority(authority: string): number | null {
  if (!authority) return null;

  // 패턴: "Author, 1880" 또는 "(Author, 1880)" 등
  const match = authority.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 메인 함수: 학명에서 모든 이명 추출
 */
export async function extractSynonyms(scientificName: string): Promise<SynonymExtractionResult> {
  const result: SynonymExtractionResult = {
    success: false,
    inputName: scientificName,
    acceptedName: null,
    aphiaId: null,
    authority: null,
    status: null,
    taxonomy: {},
    synonyms: []
  };

  try {
    // 1. 학명으로 WoRMS 레코드 조회
    console.log(`[WoRMS] Searching for: ${scientificName}`);
    const record = await fetchWormsRecord(scientificName);

    if (!record) {
      result.error = 'Species not found in WoRMS';
      return result;
    }

    // 2. 유효 학명 정보 가져오기
    let validRecord = record;
    let validAphiaId = record.AphiaID;

    // 입력한 학명이 이명인 경우 유효 학명 정보 조회
    if (record.status !== 'accepted' && record.valid_AphiaID) {
      validAphiaId = record.valid_AphiaID;
      const fetchedValid = await fetchRecordById(record.valid_AphiaID);
      if (fetchedValid) {
        validRecord = fetchedValid;
      }
      await delay(200); // API 부하 방지
    }

    result.aphiaId = validAphiaId;
    result.acceptedName = validRecord.scientificname;
    result.authority = validRecord.authority;
    result.status = validRecord.status;
    result.taxonomy = {
      kingdom: validRecord.kingdom,
      phylum: validRecord.phylum,
      class: validRecord.class,
      order: validRecord.order,
      family: validRecord.family,
      genus: validRecord.genus,
      rank: validRecord.rank
    };

    // 3. 이명 목록 조회
    console.log(`[WoRMS] Fetching synonyms for AphiaID: ${validAphiaId}`);
    await delay(200);
    const synonymsData = await fetchSynonyms(validAphiaId);

    result.synonyms = synonymsData.map(syn => ({
      name: syn.scientificname,
      author: syn.authority,
      year: extractYearFromAuthority(syn.authority),
      status: syn.status,
      aphiaId: syn.AphiaID
    }));

    // 현재 유효 학명도 이명 목록에 추가 (검색 편의)
    const acceptedSynonym: WormsSynonym = {
      name: validRecord.scientificname,
      author: validRecord.authority,
      year: extractYearFromAuthority(validRecord.authority),
      status: 'accepted',
      aphiaId: validRecord.AphiaID
    };

    // 중복 체크 후 추가
    if (!result.synonyms.find(s => s.aphiaId === acceptedSynonym.aphiaId)) {
      result.synonyms.unshift(acceptedSynonym);
    }

    // 4. 원기재 정보 조회
    console.log(`[WoRMS] Fetching sources for AphiaID: ${validAphiaId}`);
    await delay(200);
    const sources = await fetchSources(validAphiaId);

    const originalDesc = sources.find(s => s.use === 'original description');
    if (originalDesc) {
      result.originalDescription = {
        reference: originalDesc.reference,
        link: originalDesc.link,
        doi: originalDesc.doi
      };
    }

    result.success = true;
    console.log(`[WoRMS] Found ${result.synonyms.length} synonyms for ${scientificName}`);

    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WoRMS] Extraction error:', error);
    return result;
  }
}

/**
 * 여러 학명 일괄 처리
 */
export async function extractSynonymsBatch(
  scientificNames: string[],
  options: {
    delayMs?: number;
    onProgress?: (current: number, total: number, result: SynonymExtractionResult) => void;
  } = {}
): Promise<SynonymExtractionResult[]> {
  const { delayMs = 500, onProgress } = options;
  const results: SynonymExtractionResult[] = [];

  for (let i = 0; i < scientificNames.length; i++) {
    const name = scientificNames[i];
    const result = await extractSynonyms(name);
    results.push(result);

    onProgress?.(i + 1, scientificNames.length, result);

    // API 부하 방지를 위한 딜레이
    if (i < scientificNames.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
}

/**
 * 이명 목록을 검색용 문자열 배열로 변환
 */
export function getSynonymSearchTerms(result: SynonymExtractionResult): string[] {
  if (!result.success) return [];

  const terms: string[] = [];

  for (const synonym of result.synonyms) {
    // 학명만
    terms.push(synonym.name);

    // 학명 + 저자
    if (synonym.author) {
      terms.push(`${synonym.name} ${synonym.author}`);
    }
  }

  return Array.from(new Set(terms)); // 중복 제거
}
