/**
 * 문헌 검색 엔진
 *
 * 연도순 검색 + 최초 기록 확정 시 중단 로직
 */

import {
  SearchState,
  CandidateRecord,
  ConfidenceLevel,
  VerificationStatus,
  FirstRecordResult,
  WormsSynonym,
  Evidence
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { SynonymExtractionResult } from '../worms';

export interface SearchConfig {
  // 검색 연도 범위
  yearRange: {
    from: number;  // 시작 연도 (오래된 쪽)
    to: number;    // 끝 연도 (최근)
  };

  // 검색 중단 조건
  stopOnConfirmed: boolean;  // Level 1 확정 시 중단

  // 콜백
  onProgress?: (state: SearchState, currentYear: number) => void;
  onRecordFound?: (record: CandidateRecord) => void;
}

const DEFAULT_CONFIG: SearchConfig = {
  yearRange: {
    from: 1880,  // 근대 분류학 시작
    to: new Date().getFullYear()
  },
  stopOnConfirmed: true
};

/**
 * 검색 상태 초기화
 */
export function initSearchState(): SearchState {
  return {
    earliestRecord: null,
    status: 'searching',
    searchedYearRange: { from: 0, to: 0 },
    searchLog: []
  };
}

/**
 * 검색 중단 여부 판단
 */
export function shouldStopSearch(
  state: SearchState,
  currentYear: number,
  config: SearchConfig
): boolean {
  if (!config.stopOnConfirmed) return false;
  if (!state.earliestRecord) return false;

  // Level 1 (확정) 기록이 있고, 현재 검색 연도가 그 기록보다 최근이면 중단
  if (
    state.earliestRecord.confidenceLevel === 1 &&
    currentYear > state.earliestRecord.year
  ) {
    return true;
  }

  return false;
}

/**
 * 후보 기록의 신뢰도 레벨 판정
 */
export function determineConfidenceLevel(evidence: Evidence): ConfidenceLevel {
  // Level 1: 확정 - 채집지 + 날짜/표본 정보 있음
  if (
    evidence.hasKoreaRecord === true &&
    evidence.localityInfo &&
    (evidence.collectionDate || evidence.specimenInfo)
  ) {
    return 1;
  }

  // Level 2: 유력 - 한국 언급 있으나 일부 정보 부족
  if (
    evidence.hasKoreaRecord === true &&
    (evidence.localityInfo || evidence.quote)
  ) {
    return 2;
  }

  // Level 3: 검토 필요 - 학명은 있으나 한국 여부 불명확
  if (evidence.hasKoreaRecord === null || evidence.quote) {
    return 3;
  }

  // Level 4: 제외
  return 4;
}

/**
 * 신뢰도 레벨에서 검증 상태로 변환
 */
export function levelToStatus(level: ConfidenceLevel): VerificationStatus {
  switch (level) {
    case 1: return 'confirmed';
    case 2: return 'probable';
    case 3: return 'needs_review';
    case 4: return 'excluded';
    default: return 'not_checked';
  }
}

/**
 * 검색 결과 정렬 (연도 오름차순)
 */
export function sortRecordsByYear(records: CandidateRecord[]): CandidateRecord[] {
  return [...records].sort((a, b) => {
    // null 연도는 뒤로
    if (a.year === null && b.year === null) return 0;
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  });
}

/**
 * 최초 기록 판정
 */
export function determineFirstRecord(
  records: CandidateRecord[]
): FirstRecordResult['firstRecord'] {
  if (records.length === 0) return null;

  // 연도순 정렬
  const sorted = sortRecordsByYear(records);

  // Level 1, 2 중 가장 오래된 것 찾기
  const validRecords = sorted.filter(r =>
    r.confidenceLevel === 1 || r.confidenceLevel === 2
  );

  if (validRecords.length === 0) {
    // Level 3도 없으면 null
    const needsReview = sorted.filter(r => r.confidenceLevel === 3);
    if (needsReview.length === 0) return null;

    // Level 3 중 가장 오래된 것
    const oldest = needsReview[0];
    return {
      citation: oldest.citation,
      year: oldest.year || 0,
      confidenceLevel: 3,
      needsManualReview: true
    };
  }

  const oldest = validRecords[0];
  return {
    citation: oldest.citation,
    year: oldest.year || 0,
    confidenceLevel: oldest.confidenceLevel,
    needsManualReview: oldest.confidenceLevel !== 1
  };
}

/**
 * 빈 후보 기록 생성
 */
export function createEmptyCandidateRecord(
  matchedName: string,
  searchSource: 'google_scholar' | 'kci' | 'crossref' | 'manual'
): CandidateRecord {
  return {
    id: uuidv4(),
    citation: '',
    year: null,
    authors: '',
    title: '',
    source: '',
    matchedName,
    searchSource: {
      type: searchSource,
      searchQuery: matchedName,
      searchedAt: new Date()
    },
    evidence: {
      hasKoreaRecord: null,
      page: null,
      quote: null,
      specimenInfo: null,
      localityInfo: null,
      collectionDate: null,
      collector: null
    },
    confidenceLevel: 4,
    verificationStatus: 'not_checked',
    ambiguityReasons: [],
    notes: ''
  };
}

/**
 * 검색 결과를 FirstRecordResult 형식으로 변환
 */
export function createFirstRecordResult(
  synonymResult: SynonymExtractionResult,
  candidateRecords: CandidateRecord[]
): FirstRecordResult {
  const sorted = sortRecordsByYear(candidateRecords);
  const firstRecord = determineFirstRecord(sorted);

  return {
    inputName: synonymResult.inputName,
    searchedAt: new Date(),
    acceptedName: synonymResult.acceptedName || '',
    aphiaId: synonymResult.aphiaId || 0,
    authority: synonymResult.authority || '',
    synonyms: synonymResult.synonyms,
    candidateRecords: sorted,
    firstRecord,
    searchStatus: 'completed'
  };
}

/**
 * 한국 관련 검색 키워드 목록
 * - 역사적 표기 변화 고려 (Corea → Korea)
 * - 다양한 언어 표기 포함
 * - 지역명 포함
 */
export const KOREA_KEYWORDS = [
  // 영문 표기
  'Korea',
  'Korean',
  'Corea',           // 1900년대 초반까지 사용된 표기
  'Corean',

  // 한글 표기
  '한국',
  '조선',            // 일제강점기 및 그 이전
  '대한민국',
  '남한',

  // 해역/수역
  'Korean waters',
  'Korean seas',
  'Korea Strait',
  'East Sea',
  'Yellow Sea',
  'South Sea',       // 남해

  // 주요 지역명 (영문)
  'Busan',
  'Pusan',           // 과거 표기
  'Jeju',
  'Cheju',           // 과거 표기
  'Dokdo',
  'Ulleungdo',
  'Incheon',
  'Pohang',
  'Tongyeong',
  'Yeosu',
  'Mokpo',
  'Gunsan',
  'Sokcho',

  // 주요 지역명 (한글)
  '부산',
  '제주',
  '독도',
  '울릉도',
  '인천',
  '포항',
  '통영',
  '여수',
  '목포',
  '군산',
  '속초'
];

/**
 * Google Scholar 검색 URL 생성
 */
export function generateGoogleScholarUrl(
  searchTerm: string,
  options: {
    yearFrom?: number;
    yearTo?: number;
    koreanOnly?: boolean;
    includeAllKeywords?: boolean;  // 모든 한국 키워드 포함 여부
  } = {}
): string {
  const { yearFrom, yearTo, koreanOnly, includeAllKeywords = false } = options;

  let query = `"${searchTerm}"`;

  // 한국 관련 키워드 추가
  if (koreanOnly) {
    if (includeAllKeywords) {
      // 모든 키워드 포함 (너무 길어질 수 있음)
      const keywords = KOREA_KEYWORDS.map(k => k.includes(' ') ? `"${k}"` : k);
      query += ` (${keywords.join(' OR ')})`;
    } else {
      // 핵심 키워드만 (권장)
      query += ' (Korea OR Korean OR Corea OR 한국 OR 조선 OR "Korean waters" OR "East Sea" OR Busan OR Jeju)';
    }
  }

  let url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;

  if (yearFrom) {
    url += `&as_ylo=${yearFrom}`;
  }
  if (yearTo) {
    url += `&as_yhi=${yearTo}`;
  }

  return url;
}

/**
 * KCI 검색 URL 생성
 */
export function generateKciUrl(searchTerm: string): string {
  return `https://www.kci.go.kr/kciportal/search/search.kci?q=${encodeURIComponent(searchTerm)}`;
}

/**
 * 검색 URL 목록 생성 (수동 검색용)
 */
export function generateSearchUrls(
  synonymResult: SynonymExtractionResult,
  options: {
    yearFrom?: number;
    yearTo?: number;
  } = {}
): Array<{ name: string; scholar: string; kci: string }> {
  if (!synonymResult.success) return [];

  return synonymResult.synonyms.map(syn => ({
    name: syn.name,
    scholar: generateGoogleScholarUrl(syn.name, {
      ...options,
      koreanOnly: true
    }),
    kci: generateKciUrl(syn.name)
  }));
}

/**
 * 커스텀 옵션을 포함한 검색 URL 생성
 */
export function generateSearchUrlsWithOptions(
  synonymResult: SynonymExtractionResult,
  options: {
    yearFrom?: number;
    yearTo?: number;
    customKeywords?: string;
    includeKoreaKeywords?: boolean;
  } = {}
): Array<{ name: string; scholar: string; kci: string }> {
  if (!synonymResult.success) return [];

  const { yearFrom, yearTo, customKeywords, includeKoreaKeywords = true } = options;

  return synonymResult.synonyms.map(syn => {
    // 검색어 구성
    let searchTerm = `"${syn.name}"`;

    // 한국 키워드 추가
    if (includeKoreaKeywords) {
      searchTerm += ' (Korea OR Korean OR Corea OR 한국 OR 조선 OR "Korean waters" OR "East Sea" OR Busan OR Jeju)';
    }

    // 커스텀 키워드 추가
    if (customKeywords && customKeywords.trim()) {
      const keywords = customKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .map(k => k.includes(' ') ? `"${k}"` : k);

      if (keywords.length > 0) {
        searchTerm += ` (${keywords.join(' OR ')})`;
      }
    }

    // Google Scholar URL
    let scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(searchTerm)}`;
    if (yearFrom) {
      scholarUrl += `&as_ylo=${yearFrom}`;
    }
    if (yearTo) {
      scholarUrl += `&as_yhi=${yearTo}`;
    }

    // KCI URL (한국어 논문이므로 별도 키워드 불필요)
    const kciUrl = `https://www.kci.go.kr/kciportal/search/search.kci?q=${encodeURIComponent(syn.name)}`;

    return {
      name: syn.name,
      scholar: scholarUrl,
      kci: kciUrl
    };
  });
}
