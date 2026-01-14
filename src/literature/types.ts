/**
 * 문헌 수집 타입 정의
 */

// 문헌 소스
export type LiteratureSource =
  | 'bhl'           // Biodiversity Heritage Library
  | 'semantic'      // Semantic Scholar
  | 'jstage'        // J-STAGE (일본)
  | 'cinii'         // CiNii (일본)
  | 'gbif'          // GBIF (표본 데이터)
  | 'obis'          // OBIS (해양생물 분포)
  | 'kci'           // KCI (한국학술지인용색인)
  | 'riss'          // RISS (학술연구정보서비스)
  | 'manual';       // 수동 업로드

// 검색된 문헌 메타데이터
export interface LiteratureItem {
  id: string;                    // 고유 ID (source_원본ID)
  source: LiteratureSource;

  // 기본 정보
  title: string;
  authors: string[];
  year: number | null;
  journal?: string;
  volume?: string;
  pages?: string;
  doi?: string;

  // 링크
  url: string;                   // 원문 페이지 URL
  pdfUrl?: string;               // PDF 직접 다운로드 URL

  // 검색 관련
  searchedName: string;          // 검색에 사용된 학명
  snippet?: string;              // 검색 결과 미리보기
  relevanceScore?: number;       // 관련성 점수 (0-1)

  // 상태
  pdfDownloaded: boolean;
  pdfPath?: string;              // 로컬 저장 경로
  analyzed: boolean;
  analysisResult?: LiteratureAnalysis;
}

// 문헌 분석 결과
export interface LiteratureAnalysis {
  hasKoreaRecord: boolean | null;
  confidence: number;
  locality?: string;
  collectionDate?: string;
  specimenInfo?: string;
  relevantQuotes: string[];
  reasoning: string;
  analyzedAt: Date;
  modelUsed: string;
}

// 검색 전략
export type SearchStrategy = 'historical' | 'korea' | 'both';

// 검색 요청
export interface LiteratureSearchRequest {
  scientificName: string;
  synonyms: string[];
  sources?: LiteratureSource[];  // 기본: 모든 소스
  yearFrom?: number;
  yearTo?: number;
  maxResults?: number;           // 소스별 최대 결과 수 (기본: 20)
  searchStrategy?: SearchStrategy;  // 검색 전략 (기본: both)
}

// 검색 결과
export interface LiteratureSearchResult {
  scientificName: string;
  totalFound: number;
  items: LiteratureItem[];
  errors: SourceError[];
}

// 소스별 에러
export interface SourceError {
  source: LiteratureSource;
  error: string;
}

// PDF 다운로드 결과
export interface PdfDownloadResult {
  itemId: string;
  success: boolean;
  pdfPath?: string;
  error?: string;
  fileSize?: number;
}

// 문헌 수집 클라이언트 인터페이스
export interface ILiteratureClient {
  readonly source: LiteratureSource;

  // 문헌 검색
  search(query: string, options?: SearchOptions): Promise<LiteratureItem[]>;

  // PDF 다운로드
  downloadPdf(item: LiteratureItem, destPath: string): Promise<PdfDownloadResult>;
}

// 검색 옵션
export interface SearchOptions {
  yearFrom?: number;
  yearTo?: number;
  maxResults?: number;
  includeKoreaKeyword?: boolean;  // Korea 키워드 포함 여부 (기본: true)
}

// 문헌 수집 진행 상황
export interface CollectionProgress {
  phase: 'searching' | 'downloading' | 'analyzing' | 'completed';
  currentSource?: LiteratureSource;
  currentItem?: string;
  searched: number;
  downloaded: number;
  analyzed: number;
  total: number;
  errors: string[];
}
