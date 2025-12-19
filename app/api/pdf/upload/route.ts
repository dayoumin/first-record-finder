/**
 * PDF 업로드 API
 *
 * POST /api/pdf/upload
 * - PDF 파일을 업로드하고 Docling으로 텍스트 추출
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { createDoclingClient } from '@/src/pdf';
import { DoclingResult } from '@/src/pdf/types';

// PDF 저장 디렉토리
const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');
const RESULTS_DIR = path.join(process.cwd(), 'data', 'results');

// 보안 상수
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * PDF 파일 시그니처(magic bytes) 검증
 */
function isPdfSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return PDF_MAGIC_BYTES.every((byte, index) => buffer[index] === byte);
}

/**
 * 파일명 보안 처리 (경로 조작 방지)
 */
function sanitizeFileName(fileName: string): string {
  // 경로 구분자 제거 (Windows \ 및 Unix /)
  let safe = fileName.replace(/[\\\/]/g, '_');
  // 상위 디렉토리 이동 시도 제거
  safe = safe.replace(/\.\./g, '_');
  // 허용된 문자만 남기기
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');
  // 빈 문자열이면 기본값
  if (!safe || safe === '.pdf') {
    safe = 'unnamed';
  }
  // .pdf 확장자 제거 (나중에 다시 붙임)
  safe = safe.replace(/\.pdf$/i, '');
  return safe;
}

// 디렉토리 생성
function ensureDirectories() {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureDirectories();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const enableOCR = formData.get('enableOCR') !== 'false';
    const speciesName = formData.get('speciesName') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // 확장자 검사
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // 파일 크기 검사
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 413 }
      );
    }

    // 파일 내용 읽기
    const buffer = Buffer.from(await file.arrayBuffer());

    // PDF 시그니처(magic bytes) 검사
    if (!isPdfSignature(buffer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PDF file. File signature does not match PDF format.' },
        { status: 400 }
      );
    }

    // 파일명 보안 처리
    const timestamp = Date.now();
    const safeFileName = sanitizeFileName(file.name);
    const pdfId = `${timestamp}_${safeFileName}`;
    const filePath = path.join(PDF_DIR, `${pdfId}.pdf`);

    // 최종 경로가 PDF_DIR 내부인지 확인 (이중 체크)
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(PDF_DIR))) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    fs.writeFileSync(filePath, buffer);
    console.log(`[PDF Upload] Saved: ${filePath}`);

    // Docling으로 텍스트 추출
    const docling = createDoclingClient();
    let extractionResult: DoclingResult;

    try {
      extractionResult = await docling.processFile(filePath, {
        enableOCR,
        ocrLanguages: ['eng', 'kor'],
        extractTables: true,
        extractFigures: true,
      });
    } catch (doclingError) {
      // Docling 실패 시에도 파일은 저장된 상태
      console.error('[Docling] Extraction failed:', doclingError);

      return NextResponse.json({
        success: true,
        pdfId,
        fileName: file.name,
        filePath,
        extraction: null,
        extractionError: String(doclingError),
        message: 'PDF saved but text extraction failed. You can try manual analysis.',
      });
    }

    // 추출 결과 저장
    const resultPath = path.join(RESULTS_DIR, `${pdfId}_extraction.json`);
    fs.writeFileSync(resultPath, JSON.stringify({
      pdfId,
      fileName: file.name,
      speciesName,
      extraction: extractionResult,
      uploadedAt: new Date().toISOString(),
    }, null, 2));

    return NextResponse.json({
      success: true,
      pdfId,
      fileName: file.name,
      filePath,
      extraction: {
        textLength: extractionResult.text.length,
        textPreview: extractionResult.text.slice(0, 500),
        tableCount: extractionResult.tables.length,
        figureCount: extractionResult.figures.length,
        metadata: extractionResult.metadata,
        processingTime: extractionResult.processingTime,
        ocrUsed: extractionResult.ocrUsed,
      },
    });
  } catch (error) {
    console.error('[PDF Upload] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}

// GET: 업로드된 PDF 목록
export async function GET() {
  try {
    ensureDirectories();

    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const filePath = path.join(PDF_DIR, f);
        const stats = fs.statSync(filePath);
        const pdfId = f.replace('.pdf', '');

        // 추출 결과 확인
        const resultPath = path.join(RESULTS_DIR, `${pdfId}_extraction.json`);
        const hasExtraction = fs.existsSync(resultPath);

        return {
          pdfId,
          fileName: f,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
          hasExtraction,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error) {
    console.error('[PDF List] Error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to list files' },
      { status: 500 }
    );
  }
}
