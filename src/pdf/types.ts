/**
 * PDF 처리 타입 정의
 */

// Docling 추출 결과
export interface DoclingResult {
  // 문서 메타데이터
  metadata: {
    title?: string;
    authors?: string;
    year?: number;
    pages?: number;
    language?: string;
  };

  // 추출된 콘텐츠
  text: string;                 // 전체 텍스트
  tables: ExtractedTable[];     // 표 목록
  figures: ExtractedFigure[];   // 그림/캡션 목록

  // 처리 정보
  processedAt: Date;
  processingTime: number;       // ms
  ocrUsed: boolean;             // OCR 사용 여부
}

// 추출된 표
export interface ExtractedTable {
  id: string;
  page: number;
  caption?: string;
  headers: string[];
  rows: string[][];
  rawMarkdown: string;          // 마크다운 형식
}

// 추출된 그림
export interface ExtractedFigure {
  id: string;
  page: number;
  caption?: string;
  altText?: string;
}

// PDF 처리 옵션
export interface PDFProcessOptions {
  enableOCR?: boolean;          // OCR 활성화 (기본: true)
  ocrLanguages?: string[];      // OCR 언어 (기본: ['eng', 'kor'])
  extractTables?: boolean;      // 표 추출 (기본: true)
  extractFigures?: boolean;     // 그림 추출 (기본: true)
  maxPages?: number;            // 최대 페이지 수 (0 = 전체)
}

// 기본 옵션
export const DEFAULT_PDF_OPTIONS: PDFProcessOptions = {
  enableOCR: true,
  ocrLanguages: ['eng', 'kor'],
  extractTables: true,
  extractFigures: true,
  maxPages: 0,
};

// Docling API 응답 (Docker/API 서버용)
export interface DoclingAPIResponse {
  status: 'success' | 'error';
  document?: {
    metadata: Record<string, unknown>;
    content: {
      text: string;
      tables: Array<{
        page: number;
        caption?: string;
        data: string[][];
      }>;
      figures: Array<{
        page: number;
        caption?: string;
      }>;
    };
  };
  error?: string;
  processing_time?: number;
}

// PDF 클라이언트 인터페이스
export interface IPDFClient {
  // PDF 파일 처리
  processFile(filePath: string, options?: PDFProcessOptions): Promise<DoclingResult>;

  // PDF 버퍼 처리
  processBuffer(buffer: Buffer, options?: PDFProcessOptions): Promise<DoclingResult>;

  // 연결 테스트
  testConnection(): Promise<boolean>;
}
