/**
 * 문헌 수집 모듈
 */

// 타입 export
export * from './types';

// 클라이언트 export
export { BhlClient } from './bhl-client';
export { SemanticScholarClient } from './semantic-client';
export { OpenAlexClient } from './openalex-client';
export { JStageClient } from './jstage-client';
export { CiNiiClient } from './cinii-client';
export { GBIFClient } from './gbif-client';
export { OBISClient } from './obis-client';
export { KciClient } from './kci-client';
export { RissClient } from './riss-client';

// 통합 수집기 export
export {
  searchLiterature,
  downloadPdfs,
  collectLiterature,
  loadSearchResult,
  getAvailableSources,
  getSourceConfigs,
  updateSourceConfig,
  getEnabledSources,
} from './collector';

// 분석 파이프라인 export
export {
  analyzeLiteratureItem,
  analyzeLiteratureItems,
  summarizeAnalysisResults,
} from './analyzer';
export type { AnalysisProgress, AnalyzeOptions } from './analyzer';
