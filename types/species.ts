/**
 * 학명 관련 프론트엔드 타입 정의
 */

// 이명 정보
export interface Synonym {
  name: string;
  author: string;
  year: number | null;
  status: string;
  aphiaId: number;
}

// 검색 URL 정보
export interface SearchUrl {
  name: string;
  scholar: string;
  kci: string;
}

// 배치 아이템 상태
export type BatchItemStatus = 'pending' | 'processing' | 'completed' | 'error';

// 학명 배치 아이템
export interface BatchItem {
  id: string;
  inputName: string;
  status: BatchItemStatus;
  // 결과 데이터
  acceptedName?: string;
  aphiaId?: number;
  synonymCount?: number;
  synonyms?: Synonym[];
  searchUrls?: SearchUrl[];
  error?: string;
}

// OCR 품질 등급
export type OCRQuality = 'good' | 'fair' | 'poor' | 'manual_needed';

// OCR 품질 정보
export interface OCRQualityInfo {
  quality: OCRQuality;
  score: number;
  issues: string[];
  recommendation: string;
}

// 분석 결과
export interface AnalysisResult {
  hasKoreaRecord: boolean | null;
  confidence: number;
  locality?: string;
  collectionDate?: string;
  specimenInfo?: string;
  relevantQuotes?: string[];
  reasoning?: string;
}

// PDF 업로드 및 분석 결과
export interface UploadedPDF {
  pdfId: string;
  fileName: string;
  uploadedAt: string;
  textLength?: number;
  textPreview?: string;
  extractionError?: string;
  ocrQuality?: OCRQualityInfo;
  analysis?: AnalysisResult;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisError?: string;
}

// 자동 수집된 문헌 아이템
export interface CollectedLiterature {
  id: string;
  source: 'bhl' | 'semantic' | 'jstage' | 'cinii' | 'manual';
  title: string;
  authors: string[];
  year: number | null;
  journal?: string;
  url: string;
  pdfUrl?: string;
  searchedName: string;
  snippet?: string;
  relevanceScore?: number;
  pdfDownloaded: boolean;
  pdfPath?: string;
  ocrQuality?: OCRQualityInfo;
  analysis?: AnalysisResult;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisError?: string;
}

// 문헌 수집 진행 상황
export interface LiteratureCollectionProgress {
  phase: 'idle' | 'searching' | 'downloading' | 'analyzing' | 'completed';
  currentSource?: string;
  currentItem?: string;
  searched: number;
  downloaded: number;
  analyzed: number;
  total: number;
  errors: string[];
}

// 검색 옵션
export interface SearchOptions {
  customKeywords: string;
  yearFrom: number | '';
  yearTo: number | '';
  includeKoreaKeywords: boolean;
}

// 문헌 수집 옵션
export interface CollectionOptions {
  sources: ('bhl' | 'semantic')[];
  searchStrategy: 'historical' | 'korea' | 'both';
  yearFrom: number | '';
  yearTo: number | '';
  maxResults: number;
}

// LLM 제공자 타입
export type LLMProvider = 'ollama' | 'openrouter' | 'grok' | 'openai' | 'anthropic';

// LLM 설정
export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

// LLM 제공자 설정
export interface LLMProviderConfig {
  value: LLMProvider;
  label: string;
  models: string[];
  needsKey: boolean;
}

// Rate Limit 상태
export interface RateLimitStatus {
  used: number;
  remaining: number;
  limit: number;
  isWarning: boolean;
  isExceeded: boolean;
  resetsAt: string;
  warningMessage: string | null;
}
