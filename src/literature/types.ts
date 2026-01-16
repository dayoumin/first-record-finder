/**
 * 문헌 수집 타입 정의
 */

// 문헌 소스
export type LiteratureSource =
  | 'bhl'           // Biodiversity Heritage Library
  | 'semantic'      // Semantic Scholar
  | 'openalex'      // OpenAlex (현대 논문 - 주력)
  | 'jstage'        // J-STAGE (일본)
  | 'cinii'         // CiNii (일본)
  | 'gbif'          // GBIF (표본 데이터) - 보조 자료
  | 'obis'          // OBIS (해양생물 분포) - 보조 자료
  | 'kci'           // KCI (한국학술지인용색인)
  | 'riss'          // RISS (학술연구정보서비스)
  | 'scienceon'     // ScienceON (KISTI 과학기술 지식인프라)
  | 'manual';       // 수동 업로드

// 소스 설정 (활성화/비활성화)
export interface LiteratureSourceConfig {
  source: LiteratureSource;
  enabled: boolean;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
}

// 기본 소스 설정
export const DEFAULT_SOURCE_CONFIGS: LiteratureSourceConfig[] = [
  // === 학술 논문 (최초기록 판정에 적합) ===
  { source: 'bhl', enabled: true, name: 'BHL', description: '역사적 문헌 (1800~1970)', requiresApiKey: true, apiKeyEnvVar: 'BHL_API_KEY' },
  { source: 'openalex', enabled: true, name: 'OpenAlex', description: '현대 논문 (주력, 2억+ 논문)', requiresApiKey: false },
  { source: 'semantic', enabled: false, name: 'Semantic Scholar', description: '현대 논문 (백업)', requiresApiKey: false },
  { source: 'jstage', enabled: true, name: 'J-STAGE', description: '일본 학술지 (일제강점기)', requiresApiKey: false },
  { source: 'cinii', enabled: true, name: 'CiNii', description: '일본 학술 DB', requiresApiKey: false },

  // === 한국 논문 DB ===
  // ScienceON이 가장 포괄적 (2억 건: 국내+해외 논문, 특허 5천만 건, 연구보고서, 동향정보)
  // KCI/RISS는 ScienceON으로 대체 가능하므로 기본 비활성화
  // - KCI 장점: 피인용 횟수 제공 (필요시 활성화)
  // - RISS 장점: 학위논문 특화 (필요시 활성화)
  // - 셋 다 API로 PDF 직접 다운로드 불가 (메타데이터만 제공)
  { source: 'scienceon', enabled: true, name: 'ScienceON', description: 'KISTI 통합 (논문 2억+특허 5천만)', requiresApiKey: true, apiKeyEnvVar: 'SCIENCEON_API_KEY' },
  { source: 'kci', enabled: false, name: 'KCI', description: '한국학술지 (피인용 횟수 제공)', requiresApiKey: true, apiKeyEnvVar: 'KCI_API_KEY' },
  { source: 'riss', enabled: false, name: 'RISS', description: '한국 학위논문 특화', requiresApiKey: true, apiKeyEnvVar: 'RISS_API_KEY' },

  // === 보조 자료 (표본 데이터, 분포 정보 - 참고용) ===
  { source: 'gbif', enabled: false, name: 'GBIF', description: '표본 데이터 (참고용)', requiresApiKey: false },
  { source: 'obis', enabled: false, name: 'OBIS', description: '해양생물 분포 (참고용)', requiresApiKey: false },

  // === 수동 업로드 ===
  { source: 'manual', enabled: true, name: '수동 업로드', description: 'PDF 직접 업로드', requiresApiKey: false },
];

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

// 분석 소스 타입
export type AnalysisSource = 'pdf_fulltext' | 'abstract_only' | 'metadata_only';

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

  // 분석 소스 구분
  analysisSource: AnalysisSource;  // PDF 전문 vs 초록만 vs 메타데이터만
  needsManualReview?: boolean;     // 수동 확인 필요 여부

  // LLM 분석 디버깅 정보 (선택적)
  llmDebug?: {
    inputText: string;             // LLM에 전달된 텍스트 (앞부분만)
    inputLength: number;           // 전체 입력 텍스트 길이
    rawResponse?: string;          // LLM의 원본 응답
    promptUsed?: string;           // 사용된 프롬프트 템플릿
  };
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
  contentType?: ScienceOnTarget;  // ScienceON 전용: 콘텐츠 타입
}

// ScienceON 콘텐츠 타입
export type ScienceOnTarget = 'ARTI' | 'PATE' | 'REPO';

// ScienceON 특허 정보
export interface PatentItem {
  id: string;
  source: 'scienceon';
  contentType: 'PATE';

  // 기본 정보
  title: string;
  applicant: string;              // 출원인
  inventor?: string;              // 발명자
  applicationNumber: string;      // 출원번호
  applicationDate: string;        // 출원일
  registrationNumber?: string;    // 등록번호
  registrationDate?: string;      // 등록일
  publicationNumber?: string;     // 공개번호
  publicationDate?: string;       // 공개일

  // 분류 정보
  ipcCodes: string[];             // IPC 분류
  cpcCodes?: string[];            // CPC 분류

  // 링크 및 상세
  abstract?: string;
  url: string;
  searchedName: string;
}

// ScienceON 연구보고서 정보
export interface ReportItem {
  id: string;
  source: 'scienceon';
  contentType: 'REPO';

  // 기본 정보
  title: string;
  authors: string[];
  organization: string;           // 연구수행기관
  projectName?: string;           // 과제명
  projectNumber?: string;         // 과제번호
  year: number | null;

  // 분류 정보
  ministry?: string;              // 소관부처
  researchType?: string;          // 연구유형

  // 링크 및 상세
  abstract?: string;
  url: string;
  pdfUrl?: string;
  searchedName: string;
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
