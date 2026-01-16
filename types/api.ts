/**
 * API 요청/응답 타입 정의
 * 프론트엔드에서 사용하는 API 관련 타입
 */

// ============================================
// Common API Response
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Species / WoRMS
// ============================================

export interface SpeciesSearchParams {
  query: string;
  includeKoreanKeywords?: boolean;
  additionalKeywords?: string[];
  yearStart?: number;
  yearEnd?: number;
}

export interface SpeciesInfo {
  scientificName: string;
  aphiaId: number;
  status: 'accepted' | 'unaccepted' | 'uncertain';
  rank: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  authority?: string;
}

export interface SynonymInfo {
  scientificName: string;
  aphiaId: number;
  status: string;
  authority?: string;
}

export interface SpeciesResult {
  species: SpeciesInfo;
  synonyms: SynonymInfo[];
  searchUrls: SearchUrl[];
}

// ============================================
// Literature Search
// ============================================

export type LiteratureSource =
  | 'bhl'
  | 'jstage'
  | 'cinii'
  | 'kci'
  | 'riss'
  | 'scienceon'
  | 'openalex'
  | 'semantic'
  | 'gbif'
  | 'obis';

export type ScienceOnTarget = 'ARTI' | 'PATE' | 'REPO';

export interface SearchUrl {
  source: LiteratureSource;
  url: string;
  label: string;
}

export interface LiteratureItem {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: LiteratureSource;
  doi?: string;
  url?: string;
  pdfUrl?: string;
  abstract?: string;
  citation?: string;
  confidenceLevel?: 1 | 2 | 3 | 4;
}

export interface LiteratureSearchParams {
  scientificName: string;
  synonyms?: string[];
  sources: LiteratureSource[];
  yearStart?: number;
  yearEnd?: number;
  includeKoreanKeywords?: boolean;
}

export interface LiteratureCollectionProgress {
  source: LiteratureSource;
  status: 'pending' | 'searching' | 'completed' | 'error';
  found: number;
  message?: string;
}

// ============================================
// ScienceON Extended (논문/특허/보고서)
// ============================================

export interface PaperItem extends LiteratureItem {
  type: 'paper';
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
}

export interface PatentItem {
  id: string;
  title: string;
  applicant: string;
  applicationNumber: string;
  applicationDate: string;
  registrationNumber?: string;
  registrationDate?: string;
  ipcCodes: string[];
  abstract?: string;
  url?: string;
}

export interface ReportItem {
  id: string;
  title: string;
  authors: string[];
  organization: string;
  projectName?: string;
  year: number;
  abstract?: string;
  url?: string;
}

// ============================================
// PDF Analysis
// ============================================

export interface PdfUploadParams {
  file: File;
  speciesId?: string;
  scientificName?: string;
}

export interface PdfAnalysisResult {
  id: string;
  filename: string;
  extractedText: string;
  ocrQuality: number;
  analysisResult: {
    isKoreanRecord: boolean;
    confidenceLevel: 1 | 2 | 3 | 4;
    evidence: string[];
    location?: string;
    collectionDate?: string;
    specimenInfo?: string;
  };
}

// ============================================
// LLM
// ============================================

export type LlmProvider = 'ollama' | 'openrouter' | 'grok' | 'openai' | 'anthropic';

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface LlmUsageInfo {
  provider: LlmProvider;
  model: string;
  tokensUsed?: number;
  requestsRemaining?: number;
  resetAt?: string;
}

// ============================================
// Export
// ============================================

export interface ExportParams {
  speciesIds: string[];
  format: 'xlsx' | 'csv';
  includePdfs?: boolean;
}

export interface ExportResult {
  downloadUrl: string;
  filename: string;
  size: number;
}

// ============================================
// Dashboard Statistics
// ============================================

export interface SourceStatistics {
  source: LiteratureSource | 'patent' | 'report';
  count: number;
  label: string;
}

export interface YearlyTrend {
  year: number;
  papers: number;
  patents: number;
  reports: number;
}

export interface DashboardData {
  speciesName: string;
  totalItems: number;
  sourceStats: SourceStatistics[];
  yearlyTrend: YearlyTrend[];
  insights: string[];
}
