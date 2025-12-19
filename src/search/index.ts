/**
 * 문헌 검색 모듈
 */

export {
  initSearchState,
  shouldStopSearch,
  determineConfidenceLevel,
  levelToStatus,
  sortRecordsByYear,
  determineFirstRecord,
  createEmptyCandidateRecord,
  createFirstRecordResult,
  generateGoogleScholarUrl,
  generateKciUrl,
  generateSearchUrls,
  generateSearchUrlsWithOptions,
  KOREA_KEYWORDS,
  type SearchConfig
} from './search-engine';
