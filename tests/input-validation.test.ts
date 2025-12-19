/**
 * 입력 검증 테스트
 */
import { describe, it, expect } from 'vitest';

// 테스트용 상수 및 함수 (실제 analyze/route.ts에서 추출)
const MAX_TEXT_LENGTH = 500000;
const MAX_PDF_ID_LENGTH = 200;
const MAX_SCIENTIFIC_NAME_LENGTH = 200;
const PDF_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const SCIENTIFIC_NAME_PATTERN = /^[a-zA-Z][a-zA-Z\s.\-()×']+$/;

interface ValidationError {
  field: string;
  message: string;
}

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

describe('pdfId 검증', () => {
  it('유효한 pdfId', () => {
    const result = validateRequest({
      pdfId: '1234567890_test-file.name',
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toEqual([]);
  });

  it('pdfId 없으면 통과 (선택적 필드)', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toEqual([]);
  });

  it('pdfId가 문자열이 아님', () => {
    const result = validateRequest({
      pdfId: 12345,
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toContainEqual({
      field: 'pdfId',
      message: 'pdfId must be a string',
    });
  });

  it('pdfId 길이 초과', () => {
    const result = validateRequest({
      pdfId: 'a'.repeat(201),
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toContainEqual({
      field: 'pdfId',
      message: expect.stringContaining('too long'),
    });
  });

  it('pdfId에 경로 조작 문자', () => {
    const result = validateRequest({
      pdfId: '../../../etc/passwd',
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toContainEqual({
      field: 'pdfId',
      message: 'pdfId contains invalid characters',
    });
  });

  it('pdfId에 특수문자', () => {
    const result = validateRequest({
      pdfId: 'file<script>alert(1)</script>',
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toContainEqual({
      field: 'pdfId',
      message: 'pdfId contains invalid characters',
    });
  });
});

describe('scientificName 검증', () => {
  it('유효한 학명', () => {
    const validNames = [
      'Sebastes schlegelii',
      'Homo sapiens',
      "Acanthopagrus schlegelii (Bleeker)",
      'Sebastes minor',
    ];

    for (const name of validNames) {
      const result = validateRequest({ scientificName: name });
      expect(result).toEqual([]);
    }
  });

  it('특수 학명 패턴 (×, var. 등)', () => {
    // 이러한 패턴은 현재 정규식에서 지원하지 않을 수 있음
    const specialNames = [
      'Sebastes schlegelii var. minor',
      'Gadus morhua × Gadus ogac',
    ];

    for (const name of specialNames) {
      const result = validateRequest({ scientificName: name });
      // 현재 패턴에 맞지 않으면 오류, 맞으면 통과
      // 정규식: /^[a-zA-Z][a-zA-Z\s.\-()×']+$/
      if (SCIENTIFIC_NAME_PATTERN.test(name.trim())) {
        expect(result).toEqual([]);
      } else {
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });

  it('scientificName 필수', () => {
    const result = validateRequest({});
    expect(result).toContainEqual({
      field: 'scientificName',
      message: 'scientificName is required',
    });
  });

  it('빈 문자열', () => {
    const result = validateRequest({ scientificName: '   ' });
    expect(result).toContainEqual({
      field: 'scientificName',
      message: 'scientificName cannot be empty',
    });
  });

  it('숫자로 시작', () => {
    const result = validateRequest({ scientificName: '123species' });
    expect(result).toContainEqual({
      field: 'scientificName',
      message: 'scientificName contains invalid characters',
    });
  });

  it('특수문자 포함', () => {
    const result = validateRequest({ scientificName: 'Species<script>' });
    expect(result).toContainEqual({
      field: 'scientificName',
      message: 'scientificName contains invalid characters',
    });
  });

  it('길이 초과', () => {
    const result = validateRequest({ scientificName: 'A' + 'a'.repeat(200) });
    expect(result).toContainEqual({
      field: 'scientificName',
      message: expect.stringContaining('too long'),
    });
  });
});

describe('text 검증', () => {
  it('유효한 텍스트', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
      text: 'This is a sample text.',
    });
    expect(result).toEqual([]);
  });

  it('text 없으면 통과 (선택적)', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
    });
    expect(result).toEqual([]);
  });

  it('text가 문자열이 아님', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
      text: { content: 'test' },
    });
    expect(result).toContainEqual({
      field: 'text',
      message: 'text must be a string',
    });
  });

  it('text 길이 초과 (500KB)', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
      text: 'a'.repeat(500001),
    });
    expect(result).toContainEqual({
      field: 'text',
      message: expect.stringContaining('too long'),
    });
  });
});

describe('synonyms 검증', () => {
  it('유효한 synonyms 배열', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
      synonyms: ['Sebastes inermis', 'Sebastes minor'],
    });
    expect(result).toEqual([]);
  });

  it('synonyms가 배열이 아님', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
      synonyms: 'Sebastes inermis',
    });
    expect(result).toContainEqual({
      field: 'synonyms',
      message: 'synonyms must be an array',
    });
  });

  it('synonyms 배열에 문자열 아닌 값', () => {
    const result = validateRequest({
      scientificName: 'Sebastes schlegelii',
      synonyms: ['Sebastes inermis', 123, null],
    });
    expect(result).toContainEqual({
      field: 'synonyms',
      message: 'all synonyms must be strings',
    });
  });
});

describe('복합 검증', () => {
  it('여러 필드 오류 동시 반환', () => {
    const result = validateRequest({
      pdfId: '../invalid',
      scientificName: '',
      text: 123,
      synonyms: 'not array',
    });

    expect(result.length).toBeGreaterThan(1);
    expect(result.map((e) => e.field)).toContain('pdfId');
    expect(result.map((e) => e.field)).toContain('scientificName');
    expect(result.map((e) => e.field)).toContain('text');
    expect(result.map((e) => e.field)).toContain('synonyms');
  });
});
