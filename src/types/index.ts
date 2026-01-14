/**
 * 한국 수산생물 최초기록 검색 시스템 - 타입 정의
 */

// ============================================================
// WoRMS 관련 타입
// ============================================================

export interface WormsSynonym {
  name: string;           // 학명
  author: string;         // 저자
  year: number | null;    // 발표 연도
  status: string;         // "synonym", "basionym", "accepted" 등
  aphiaId: number;
  originalCitation?: string;  // 원기재 문헌
}

export interface WormsRecord {
  aphiaId: number;
  scientificName: string;
  authority: string;
  status: string;
  rank: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
}

// ============================================================
// 문헌 검색 관련 타입
// ============================================================

export interface LiteratureSource {
  type: 'google_scholar' | 'kci' | 'crossref' | 'manual';
  url?: string;
  searchQuery: string;
  searchedAt: Date;
}

export interface LiteratureRecord {
  // 기본 정보
  id: string;
  citation: string;          // 전체 인용 정보
  year: number | null;
  authors: string;
  title: string;
  source: string;            // 저널/도서명
  doi?: string;
  url?: string;

  // 검색 정보
  matchedName: string;       // 어떤 이명으로 찾았는지
  searchSource: LiteratureSource;
}

// ============================================================
// 서식 근거 관련 타입
// ============================================================

export type AmbiguityReason =
  | 'no_locality'              // 채집지 정보 없음
  | 'no_specimen'              // 표본 정보 없음
  | 'unclear_if_citation'      // 인용인지 직접 기록인지 불분명
  | 'distribution_list_only'   // 분포 목록에만 기재
  | 'korea_unspecified'        // 한국 내 구체적 위치 불명
  | 'date_missing'             // 채집 날짜 없음
  | 'other';

export type ConfidenceLevel = 1 | 2 | 3 | 4;
// Level 1: 확정 (Confirmed) - 검색 중단
// Level 2: 유력 (Probable) - 기록, 계속 탐색
// Level 3: 검토 필요 (Needs Review) - 수동 검토 대기
// Level 4: 제외 (Excluded) - 참고용

export type VerificationStatus =
  | 'confirmed'        // 명확한 한국 서식 근거
  | 'probable'         // 유력하나 일부 정보 부족
  | 'needs_review'     // 언급은 있으나 추가 검토 필요
  | 'citation_only'    // 단순 인용/목록
  | 'excluded'         // 제외 (한국 기록 아님)
  | 'not_checked';     // 아직 미확인

export interface Evidence {
  hasKoreaRecord: boolean | null;    // 한국 기록 여부
  page: string | null;               // 페이지
  quote: string | null;              // 원문 인용
  specimenInfo: string | null;       // 표본 정보 (번호, 기관)
  localityInfo: string | null;       // 채집지 정보
  collectionDate: string | null;     // 채집 일자
  collector: string | null;          // 채집자
}

export interface ManualReview {
  reviewedBy: string;
  reviewedAt: Date;
  decision: 'confirmed' | 'rejected' | 'still_uncertain';
  notes: string;
}

// ============================================================
// 검색 결과 타입
// ============================================================

export interface CandidateRecord extends LiteratureRecord {
  evidence: Evidence;
  confidenceLevel: ConfidenceLevel;
  verificationStatus: VerificationStatus;
  ambiguityReasons: AmbiguityReason[];
  notes: string;
  manualReview?: ManualReview;
}

export interface FirstRecordResult {
  // 입력 정보
  inputName: string;
  searchedAt: Date;

  // WoRMS 정보
  acceptedName: string;
  aphiaId: number;
  koreanName?: string;        // 국명 (별도 조회 필요)

  // 이명 목록
  synonyms: WormsSynonym[];

  // 후보 문헌들 (연도순 정렬)
  candidateRecords: CandidateRecord[];

  // 최종 판정
  firstRecord: {
    citation: string;
    year: number;
    confidenceLevel: ConfidenceLevel;
    needsManualReview: boolean;
  } | null;

  // 검색 상태
  searchStatus: 'completed' | 'in_progress' | 'error';
  searchNotes?: string;
}

// ============================================================
// 검색 상태 관리
// ============================================================

export interface SearchState {
  // 현재까지 발견된 가장 오래된 기록
  earliestRecord: {
    year: number;
    citation: string;
    confidenceLevel: ConfidenceLevel;
  } | null;

  // 검색 상태
  status:
    | 'searching'           // 검색 중
    | 'confirmed'           // 명확한 기록 확정 → 중단
    | 'tentative'           // 잠정 기록 있음, 더 오래된 것 탐색 중
    | 'exhausted';          // 모든 연대 검색 완료

  // 검색한 연도 범위
  searchedYearRange: {
    from: number;
    to: number;
  };

  // 검색 로그
  searchLog: {
    timestamp: Date;
    action: string;
    details: string;
  }[];
}

// ============================================================
// 엑셀 출력 타입
// ============================================================

export interface ExcelSummaryRow {
  scientificName: string;
  koreanName: string;
  firstRecordCitation: string;
  year: number | null;
  confidence: string;
  status: string;
  notes: string;
}

export interface ExcelDetailRow {
  scientificName: string;
  citation: string;
  year: number | null;
  page: string;
  matchedName: string;
  quote: string;
  localityInfo: string;
  specimenInfo: string;
  verificationStatus: string;
  ambiguityReasons: string;
}

export interface ExcelSynonymRow {
  acceptedName: string;
  synonym: string;
  author: string;
  year: number | null;
  status: string;
}

// ============================================================
// 일괄 처리 타입
// ============================================================

export type BatchItemStatus =
  | 'pending'      // 대기 중
  | 'processing'   // 처리 중
  | 'completed'    // 완료
  | 'error';       // 오류

export interface BatchItem {
  id: string;
  inputName: string;           // 입력된 학명
  status: BatchItemStatus;
  acceptedName?: string;       // WoRMS 유효명
  aphiaId?: number;
  synonymCount?: number;       // 이명 개수
  searchUrls?: Array<{ name: string; scholar: string; kci: string }>;
  error?: string;
  processedAt?: Date;
}

export interface BatchJob {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  fileName?: string;           // 업로드된 파일명
  totalCount: number;          // 총 학명 수
  completedCount: number;      // 완료 수
  errorCount: number;          // 오류 수
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  items: BatchItem[];
}

export interface BatchProgress {
  current: number;
  total: number;
  percentage: number;
  currentName: string;
  status: BatchJob['status'];
  estimatedRemaining?: string;  // 예상 남은 시간
}
