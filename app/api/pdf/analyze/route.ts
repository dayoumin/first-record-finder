/**
 * PDF 분석 API
 *
 * POST /api/pdf/analyze
 * - LLM을 사용하여 PDF 텍스트에서 한국 기록 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { createLLMClient, loadLLMConfigFromEnv } from '@/src/llm';
import { LLMConfig, LiteratureAnalysisResult } from '@/src/llm/types';

const RESULTS_DIR = path.join(process.cwd(), 'data', 'results');

// 입력 검증 상수
const MAX_TEXT_LENGTH = 500000;  // 500KB 텍스트 제한
const MAX_PDF_ID_LENGTH = 200;
const MAX_SCIENTIFIC_NAME_LENGTH = 200;
const PDF_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const SCIENTIFIC_NAME_PATTERN = /^[a-zA-Z][a-zA-Z\s.\-()×']+$/;

/**
 * 입력 검증 에러
 */
interface ValidationError {
  field: string;
  message: string;
}

/**
 * 요청 본문 검증
 */
function validateRequest(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // pdfId 검증
  if (body.pdfId !== undefined) {
    const pdfId = body.pdfId;
    if (typeof pdfId !== 'string') {
      errors.push({ field: 'pdfId', message: 'pdfId must be a string' });
    } else if (pdfId.length > MAX_PDF_ID_LENGTH) {
      errors.push({ field: 'pdfId', message: `pdfId too long (max ${MAX_PDF_ID_LENGTH} chars)` });
    } else if (!PDF_ID_PATTERN.test(pdfId)) {
      errors.push({ field: 'pdfId', message: 'pdfId contains invalid characters' });
    }
  }

  // scientificName 검증
  const scientificName = body.scientificName;
  if (!scientificName) {
    errors.push({ field: 'scientificName', message: 'scientificName is required' });
  } else if (typeof scientificName !== 'string') {
    errors.push({ field: 'scientificName', message: 'scientificName must be a string' });
  } else if (scientificName.trim().length === 0) {
    errors.push({ field: 'scientificName', message: 'scientificName cannot be empty' });
  } else if (scientificName.length > MAX_SCIENTIFIC_NAME_LENGTH) {
    errors.push({ field: 'scientificName', message: `scientificName too long (max ${MAX_SCIENTIFIC_NAME_LENGTH} chars)` });
  } else if (!SCIENTIFIC_NAME_PATTERN.test(scientificName.trim())) {
    errors.push({ field: 'scientificName', message: 'scientificName contains invalid characters' });
  }

  // text 검증
  if (body.text !== undefined) {
    const text = body.text;
    if (typeof text !== 'string') {
      errors.push({ field: 'text', message: 'text must be a string' });
    } else if (text.length > MAX_TEXT_LENGTH) {
      errors.push({ field: 'text', message: `text too long (max ${MAX_TEXT_LENGTH} chars, got ${text.length})` });
    }
  }

  // synonyms 검증
  if (body.synonyms !== undefined) {
    if (!Array.isArray(body.synonyms)) {
      errors.push({ field: 'synonyms', message: 'synonyms must be an array' });
    } else if (!body.synonyms.every((s: unknown) => typeof s === 'string')) {
      errors.push({ field: 'synonyms', message: 'all synonyms must be strings' });
    }
  }

  return errors;
}

// 디렉토리 확인
function ensureDirectories() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureDirectories();

    // JSON 파싱 에러 처리
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 입력 검증
    const validationErrors = validateRequest(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    const {
      pdfId,
      text,
      scientificName,
      synonyms = [],
      llmConfig,
    } = body as {
      pdfId?: string;
      text?: string;
      scientificName: string;
      synonyms?: string[];
      llmConfig?: LLMConfig;
    };

    // 텍스트 가져오기 (직접 전달 또는 pdfId로 조회)
    let analysisText = text;

    if (!analysisText && pdfId) {
      const extractionPath = path.join(RESULTS_DIR, `${pdfId}_extraction.json`);

      // 경로 조작 방지: 결과 디렉토리 내부인지 확인
      const resolvedPath = path.resolve(extractionPath);
      if (!resolvedPath.startsWith(path.resolve(RESULTS_DIR))) {
        return NextResponse.json(
          { success: false, error: 'Invalid pdfId' },
          { status: 400 }
        );
      }

      if (!fs.existsSync(extractionPath)) {
        return NextResponse.json(
          { success: false, error: `No extraction found for pdfId: ${pdfId}` },
          { status: 404 }
        );
      }

      const extractionData = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));
      analysisText = extractionData.extraction?.text;

      if (!analysisText) {
        return NextResponse.json(
          { success: false, error: 'No text content in extraction' },
          { status: 400 }
        );
      }
    }

    if (!analysisText) {
      return NextResponse.json(
        { success: false, error: 'Either text or pdfId is required' },
        { status: 400 }
      );
    }

    // LLM 설정 (요청에서 전달하거나 환경변수 사용)
    const config: LLMConfig = llmConfig || loadLLMConfigFromEnv();

    console.log(`[PDF Analyze] Using ${config.provider}/${config.model}`);
    console.log(`[PDF Analyze] Text length: ${analysisText.length}`);
    console.log(`[PDF Analyze] Species: ${scientificName}`);

    // LLM 클라이언트 생성 및 분석
    const llm = createLLMClient(config);

    let result: LiteratureAnalysisResult;

    try {
      result = await llm.analyzeLiterature({
        text: analysisText,
        scientificName,
        synonyms,
        maxChunkSize: 8000,
      });
    } catch (llmError) {
      console.error('[LLM] Analysis failed:', llmError);

      return NextResponse.json(
        {
          success: false,
          error: `LLM analysis failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`,
          provider: config.provider,
          model: config.model,
        },
        { status: 500 }
      );
    }

    // 분석 결과 저장
    if (pdfId) {
      const analysisPath = path.join(RESULTS_DIR, `${pdfId}_analysis.json`);
      fs.writeFileSync(analysisPath, JSON.stringify({
        pdfId,
        scientificName,
        synonyms,
        result,
        analyzedAt: new Date().toISOString(),
      }, null, 2));
    }

    return NextResponse.json({
      success: true,
      pdfId: pdfId || null,
      scientificName,
      result,
    });
  } catch (error) {
    console.error('[PDF Analyze] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}
