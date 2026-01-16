/**
 * Docling 클라이언트
 *
 * PDF 텍스트/표 추출 (OCR 포함)
 * - Docker API 서버 연동
 * - Python CLI 직접 호출 (fallback)
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  IPDFClient,
  DoclingResult,
  PDFProcessOptions,
  DoclingAPIResponse,
  ExtractedTable,
  ExtractedFigure,
  DEFAULT_PDF_OPTIONS,
} from './types';
import { assessOCRQuality } from './ocr-quality';

/** 기본 타임아웃 설정 */
const DEFAULT_API_TIMEOUT_MS = 10000;   // 10초 (API) - 서버 없으면 빠르게 실패
const DEFAULT_CLI_TIMEOUT_MS = 30000;   // 30초 (CLI) - 짧게 설정, 실패 시 메타데이터로 폴백

/** 타임아웃 에러 */
class DoclingTimeoutError extends Error {
  constructor(mode: 'API' | 'CLI', timeoutMs: number) {
    super(`Docling ${mode} timed out after ${timeoutMs}ms`);
    this.name = 'DoclingTimeoutError';
  }
}

/**
 * Docling 클라이언트
 */
export class DoclingClient implements IPDFClient {
  private apiUrl: string;
  private useApi: boolean;
  private apiTimeoutMs: number;
  private cliTimeoutMs: number;

  constructor(options: {
    apiUrl?: string;
    useApi?: boolean;
    apiTimeoutMs?: number;
    cliTimeoutMs?: number;
  } = {}) {
    this.apiUrl = options.apiUrl || process.env.DOCLING_API_URL || 'http://localhost:5000';
    this.useApi = options.useApi ?? true;
    this.apiTimeoutMs = options.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
    this.cliTimeoutMs = options.cliTimeoutMs ?? DEFAULT_CLI_TIMEOUT_MS;
  }

  /**
   * PDF 파일 처리
   */
  async processFile(filePath: string, options?: PDFProcessOptions): Promise<DoclingResult> {
    const opts = { ...DEFAULT_PDF_OPTIONS, ...options };

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`[Docling] Processing: ${path.basename(filePath)}`);
    const startTime = Date.now();

    try {
      // API 서버 사용 시도
      if (this.useApi) {
        try {
          return await this.processViaAPI(filePath, opts);
        } catch (apiError) {
          console.warn('[Docling] API failed, falling back to CLI:', apiError);
        }
      }

      // CLI fallback
      return await this.processViaCLI(filePath, opts);
    } finally {
      console.log(`[Docling] Completed in ${Date.now() - startTime}ms`);
    }
  }

  /**
   * PDF 버퍼 처리
   */
  async processBuffer(buffer: Buffer, options?: PDFProcessOptions): Promise<DoclingResult> {
    // 임시 파일로 저장
    const tempDir = process.env.TEMP || '/tmp';
    const tempPath = path.join(tempDir, `docling_${Date.now()}.pdf`);

    try {
      fs.writeFileSync(tempPath, buffer);
      return await this.processFile(tempPath, options);
    } finally {
      // 임시 파일 삭제
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  /**
   * 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      return response.ok;
    } catch {
      // API 실패 시 CLI 확인
      return this.checkCLI();
    }
  }

  // ============================================================
  // API 서버 연동
  // ============================================================

  /**
   * Docling API 서버로 처리 (타임아웃 포함)
   */
  private async processViaAPI(
    filePath: string,
    options: PDFProcessOptions
  ): Promise<DoclingResult> {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, path.basename(filePath));

    // 옵션 추가
    formData.append('ocr', String(options.enableOCR));
    if (options.ocrLanguages) {
      formData.append('ocr_languages', options.ocrLanguages.join(','));
    }
    formData.append('extract_tables', String(options.extractTables));
    formData.append('extract_figures', String(options.extractFigures));

    // 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.apiTimeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/convert`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: DoclingAPIResponse = await response.json();

      if (data.status === 'error') {
        throw new Error(data.error || 'Unknown API error');
      }

      return this.parseAPIResponse(data);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DoclingTimeoutError('API', this.apiTimeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * API 응답 파싱
   */
  private parseAPIResponse(data: DoclingAPIResponse): DoclingResult {
    if (!data.document) {
      throw new Error('No document in API response');
    }
    const doc = data.document;

    const tables: ExtractedTable[] = (doc.content.tables || []).map((t, i) => ({
      id: `table-${i}`,
      page: t.page,
      caption: t.caption,
      headers: t.data[0] || [],
      rows: t.data.slice(1),
      rawMarkdown: this.tableToMarkdown(t.data),
    }));

    const figures: ExtractedFigure[] = (doc.content.figures || []).map((f, i) => ({
      id: `figure-${i}`,
      page: f.page,
      caption: f.caption,
    }));

    const result: DoclingResult = {
      metadata: {
        title: doc.metadata.title as string | undefined,
        authors: doc.metadata.authors as string | undefined,
        year: doc.metadata.year as number | undefined,
        pages: doc.metadata.pages as number | undefined,
      },
      text: doc.content.text,
      tables,
      figures,
      processedAt: new Date(),
      processingTime: data.processing_time || 0,
      ocrUsed: true,
    };

    // OCR 품질 평가 추가
    result.ocrQuality = assessOCRQuality(result);

    return result;
  }

  // ============================================================
  // CLI 직접 호출
  // ============================================================

  /**
   * Docling CLI로 처리 (타임아웃 포함)
   */
  private async processViaCLI(
    filePath: string,
    options: PDFProcessOptions
  ): Promise<DoclingResult> {
    return new Promise((resolve, reject) => {
      const outputDir = path.join(path.dirname(filePath), '.docling_output');

      // 출력 디렉토리 생성
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const args = [
        filePath,
        '--output', outputDir,
        '--to', 'json',
      ];

      if (options.enableOCR) {
        args.push('--ocr');
      }

      const startTime = Date.now();
      // docling CLI 직접 실행 (python -m docling 대신)
      const childProcess = spawn('docling', args, { shell: true });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        childProcess.kill('SIGTERM');
        // 강제 종료가 안되면 SIGKILL
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }, this.cliTimeoutMs);

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (isTimedOut) {
          reject(new DoclingTimeoutError('CLI', this.cliTimeoutMs));
          return;
        }

        if (code !== 0) {
          reject(new Error(`Docling CLI failed: ${stderr}`));
          return;
        }

        try {
          // 출력 JSON 파일 읽기
          const baseName = path.basename(filePath, '.pdf');
          const jsonPath = path.join(outputDir, `${baseName}.json`);

          if (!fs.existsSync(jsonPath)) {
            // JSON이 없으면 마크다운 시도
            const mdPath = path.join(outputDir, `${baseName}.md`);
            if (fs.existsSync(mdPath)) {
              const text = fs.readFileSync(mdPath, 'utf-8');
              const ocrUsed = options.enableOCR || false;
              const mdResult: DoclingResult = {
                metadata: {},
                text,
                tables: [],
                figures: [],
                processedAt: new Date(),
                processingTime: Date.now() - startTime,
                ocrUsed,
              };
              // OCR 사용 시 품질 평가 추가
              if (ocrUsed) {
                mdResult.ocrQuality = assessOCRQuality(mdResult);
              }
              resolve(mdResult);
              return;
            }
            throw new Error('No output file found');
          }

          const result = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          resolve(this.parseCLIOutput(result, Date.now() - startTime, options.enableOCR || false));
        } catch (parseError) {
          reject(parseError);
        }
      });

      childProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to start Docling: ${err.message}`));
      });
    });
  }

  /**
   * CLI 출력 파싱
   */
  private parseCLIOutput(data: unknown, processingTime: number, ocrUsed: boolean): DoclingResult {
    // Docling JSON 형식에 따라 파싱
    // 실제 구조는 Docling 버전에 따라 다를 수 있음
    const doc = data as {
      metadata?: Record<string, unknown>;
      text?: string;
      content?: string;
      tables?: Array<{ rows: string[][] }>;
    };

    const result: DoclingResult = {
      metadata: {
        title: doc.metadata?.title as string | undefined,
        authors: doc.metadata?.author as string | undefined,
      },
      text: doc.text || doc.content || '',
      tables: [],
      figures: [],
      processedAt: new Date(),
      processingTime,
      ocrUsed,
    };

    // OCR 사용 시 품질 평가 추가
    if (ocrUsed) {
      result.ocrQuality = assessOCRQuality(result);
    }

    return result;
  }

  /**
   * CLI 사용 가능 여부 확인
   */
  private async checkCLI(): Promise<boolean> {
    return new Promise((resolve) => {
      const childProcess = spawn('python', ['-m', 'docling', '--version']);

      childProcess.on('close', (code) => {
        resolve(code === 0);
      });

      childProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  /**
   * 표 데이터를 마크다운으로 변환
   */
  private tableToMarkdown(data: string[][]): string {
    if (!data || data.length === 0) return '';

    const headers = data[0];
    const rows = data.slice(1);

    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of rows) {
      md += '| ' + row.join(' | ') + ' |\n';
    }

    return md;
  }
}

/**
 * Docling 클라이언트 팩토리
 */
export function createDoclingClient(options?: {
  apiUrl?: string;
  useApi?: boolean;
}): IPDFClient {
  return new DoclingClient(options);
}
