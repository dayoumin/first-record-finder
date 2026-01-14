/**
 * OCR 품질 평가 및 파일 분류
 *
 * Docling 추출 결과를 분석하여 OCR 품질을 평가하고
 * 수동 분석이 필요한 문서를 별도 폴더로 분류
 */

import * as fs from 'fs';
import * as path from 'path';
import { OCRQuality, OCRQualityAssessment, DoclingResult } from './types';

// PDF 저장 폴더 경로
const PDF_BASE_DIR = 'data/pdfs';
const OCR_NEEDED_DIR = 'data/pdfs/ocr-needed';

/**
 * OCR 품질 평가
 *
 * 텍스트 품질을 여러 지표로 평가:
 * 1. 텍스트 길이 (너무 짧으면 추출 실패)
 * 2. 단어 비율 (의미 있는 단어 vs 깨진 문자)
 * 3. 특수문자 비율 (OCR 오류 징후)
 * 4. 연속 공백/줄바꿈 (레이아웃 문제)
 * 5. 반복 패턴 (OCR 아티팩트)
 */
export function assessOCRQuality(result: DoclingResult): OCRQualityAssessment {
  const text = result.text || '';
  const issues: string[] = [];
  let score = 100;

  // 1. 텍스트 길이 검사
  if (text.length < 100) {
    score -= 50;
    issues.push('텍스트가 거의 추출되지 않음 (100자 미만)');
  } else if (text.length < 500) {
    score -= 20;
    issues.push('텍스트가 매우 짧음 (500자 미만)');
  }

  // 2. 의미 있는 단어 비율 (최소 3글자 단어)
  const words = text.split(/\s+/).filter(w => w.length >= 3);
  const validWordRatio = words.length / Math.max(text.split(/\s+/).length, 1);
  if (validWordRatio < 0.3) {
    score -= 30;
    issues.push(`의미 있는 단어 비율이 낮음 (${Math.round(validWordRatio * 100)}%)`);
  } else if (validWordRatio < 0.5) {
    score -= 15;
    issues.push(`단어 품질이 보통 (${Math.round(validWordRatio * 100)}%)`);
  }

  // 3. 특수문자/깨진 문자 비율
  const brokenChars = text.match(/[□■◆◇○●△▲▽▼★☆※�\uFFFD]/g) || [];
  const brokenRatio = brokenChars.length / Math.max(text.length, 1);
  if (brokenRatio > 0.05) {
    score -= 25;
    issues.push(`깨진 문자가 많음 (${brokenChars.length}개)`);
  } else if (brokenRatio > 0.01) {
    score -= 10;
    issues.push(`깨진 문자 발견 (${brokenChars.length}개)`);
  }

  // 4. 연속 공백/줄바꿈 (레이아웃 문제)
  const consecutiveSpaces = text.match(/\s{5,}/g) || [];
  if (consecutiveSpaces.length > 20) {
    score -= 15;
    issues.push('레이아웃 추출 문제 (과도한 공백)');
  }

  // 5. 반복 패턴 검사 (OCR 아티팩트)
  // 3글자 이상 패턴이 3번 이상 연속 반복되면 감지
  const repeatedPatterns = text.match(/(.{3,}?)\1{2,}/g) || [];
  // 전체 반복 문자 수가 텍스트의 10% 이상이면 문제로 판단
  const repeatedCharsCount = repeatedPatterns.reduce((sum, p) => sum + p.length, 0);
  if (repeatedCharsCount > text.length * 0.1 || repeatedPatterns.length > 5) {
    score -= 20;
    issues.push('반복 패턴 감지 (OCR 아티팩트)');
  }

  // 6. 알파벳/한글/일본어 비율 검사 (의미 있는 텍스트인지)
  // 히라가나: \u3040-\u309F, 가타카나: \u30A0-\u30FF, 한자: \u4E00-\u9FFF
  const validChars = text.match(/[a-zA-Z0-9가-힣\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || [];
  const validCharRatio = validChars.length / Math.max(text.length, 1);
  if (validCharRatio < 0.3) {
    score -= 20;
    issues.push(`텍스트 내용 비율이 낮음 (${Math.round(validCharRatio * 100)}%)`);
  }

  // 점수 범위 제한
  score = Math.max(0, Math.min(100, score));

  // 품질 등급 결정
  let quality: OCRQuality;
  let recommendation: string;

  if (score >= 70) {
    quality = 'good';
    recommendation = '자동 분석 가능';
  } else if (score >= 50) {
    quality = 'fair';
    recommendation = '분석 결과 검토 권장';
  } else if (score >= 30) {
    quality = 'poor';
    recommendation = 'OCR 품질 낮음, 수동 확인 필요';
  } else {
    quality = 'manual_needed';
    recommendation = 'LM Notebook에서 수동 분석 필요';
  }

  return {
    quality,
    score,
    issues,
    recommendation,
  };
}

/**
 * OCR 품질에 따라 PDF 파일 분류
 *
 * @param sourcePath 원본 PDF 경로
 * @param result Docling 처리 결과
 * @returns 최종 저장 경로와 품질 정보
 */
export async function classifyPDFByOCRQuality(
  sourcePath: string,
  result: DoclingResult
): Promise<{
  savedPath: string;
  needsManualReview: boolean;
  quality: OCRQualityAssessment;
}> {
  const quality = assessOCRQuality(result);
  const fileName = path.basename(sourcePath);

  // 수동 분석 필요 여부
  const needsManualReview = quality.quality === 'manual_needed' || quality.quality === 'poor';

  // 저장 폴더 결정
  const targetDir = needsManualReview ? OCR_NEEDED_DIR : PDF_BASE_DIR;

  // 폴더 생성
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, fileName);

  // 파일 복사 (원본이 다른 위치에 있는 경우)
  if (sourcePath !== targetPath && fs.existsSync(sourcePath)) {
    // 이미 같은 파일이 있으면 덮어쓰지 않음
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  return {
    savedPath: targetPath,
    needsManualReview,
    quality,
  };
}

/**
 * OCR 품질 보고서 생성 (JSON)
 */
export function generateOCRReport(
  results: Array<{
    fileName: string;
    quality: OCRQualityAssessment;
    savedPath: string;
  }>
): {
  summary: {
    total: number;
    good: number;
    fair: number;
    poor: number;
    manualNeeded: number;
  };
  details: typeof results;
} {
  const summary = {
    total: results.length,
    good: results.filter(r => r.quality.quality === 'good').length,
    fair: results.filter(r => r.quality.quality === 'fair').length,
    poor: results.filter(r => r.quality.quality === 'poor').length,
    manualNeeded: results.filter(r => r.quality.quality === 'manual_needed').length,
  };

  return { summary, details: results };
}

/**
 * 수동 분석 필요 폴더의 파일 목록 조회
 */
export function getManualReviewFiles(): string[] {
  if (!fs.existsSync(OCR_NEEDED_DIR)) {
    return [];
  }

  return fs.readdirSync(OCR_NEEDED_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(OCR_NEEDED_DIR, f));
}

/**
 * 품질 등급별 한국어 설명
 */
export function getQualityDescription(quality: OCRQuality): string {
  switch (quality) {
    case 'good':
      return '양호 - 자동 분석 가능';
    case 'fair':
      return '보통 - 결과 검토 권장';
    case 'poor':
      return '낮음 - 수동 확인 필요';
    case 'manual_needed':
      return '수동 분석 필요';
    default:
      return '알 수 없음';
  }
}
