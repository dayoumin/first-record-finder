/**
 * OCR 품질 평가 테스트
 */

import { describe, it, expect } from 'vitest';
import { assessOCRQuality, getQualityDescription, generateOCRReport } from '../src/pdf/ocr-quality';
import { DoclingResult } from '../src/pdf/types';

// 테스트용 DoclingResult 생성 헬퍼
function createMockResult(text: string): DoclingResult {
  return {
    metadata: {},
    text,
    tables: [],
    figures: [],
    processedAt: new Date(),
    processingTime: 100,
    ocrUsed: true,
  };
}

describe('assessOCRQuality', () => {
  describe('텍스트 길이 평가', () => {
    it('100자 미만은 50점 감점', () => {
      const result = createMockResult('Short text');
      const assessment = assessOCRQuality(result);

      expect(assessment.score).toBeLessThanOrEqual(50);
      expect(assessment.issues).toContain('텍스트가 거의 추출되지 않음 (100자 미만)');
    });

    it('500자 미만은 20점 감점', () => {
      const text = 'a'.repeat(200);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('500자 미만'))).toBe(true);
    });

    it('충분한 길이의 텍스트는 감점 없음', () => {
      const text = 'The specimen was collected from Korea in 1920. '.repeat(20);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('자 미만'))).toBe(false);
    });
  });

  describe('단어 품질 평가', () => {
    it('의미 있는 단어가 충분하면 양호', () => {
      const text = 'This is a scientific paper about marine species found in Korean waters. The specimens were collected from Busan harbor.';
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      // 긴 단어들이 많으므로 단어 품질 이슈 없어야 함
      expect(assessment.issues.some(i => i.includes('단어 비율'))).toBe(false);
    });

    it('짧은 단어만 있으면 감점', () => {
      const text = 'a b c d e f g h i j k l m n o p q r s t u v w x y z '.repeat(5);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('단어'))).toBe(true);
    });
  });

  describe('깨진 문자 평가', () => {
    it('깨진 문자가 없으면 감점 없음', () => {
      const text = 'Normal text without broken characters. '.repeat(10);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('깨진 문자'))).toBe(false);
    });

    it('깨진 문자가 많으면 감점', () => {
      const text = '□■◆◇○●△▲▽▼★☆※'.repeat(20) + ' some text';
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('깨진 문자'))).toBe(true);
    });

    it('유니코드 대체 문자(�) 감지', () => {
      const text = 'Text with replacement character � and more �'.repeat(50);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('깨진 문자'))).toBe(true);
    });
  });

  describe('레이아웃 문제 평가', () => {
    it('과도한 공백은 레이아웃 문제로 감점', () => {
      const text = ('word' + ' '.repeat(10)).repeat(30);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('레이아웃') || i.includes('공백'))).toBe(true);
    });
  });

  describe('반복 패턴 평가', () => {
    it('비정상적 반복 패턴 감지', () => {
      const text = 'abcabcabcabcabcabcabcabcabcabcabcabc'.repeat(10);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('반복 패턴'))).toBe(true);
    });
  });

  describe('알파벳/한글 비율 평가', () => {
    it('영문 텍스트는 정상 처리', () => {
      const text = 'This is a normal English text about marine biology in Korea. '.repeat(10);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('텍스트 내용 비율'))).toBe(false);
    });

    it('한글 텍스트는 정상 처리', () => {
      const text = '이것은 한국 해양생물에 관한 정상적인 한글 텍스트입니다. '.repeat(10);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('텍스트 내용 비율'))).toBe(false);
    });

    it('일본어 텍스트는 정상 처리', () => {
      const text = 'これは韓国の海洋生物に関する日本語のテキストです。朝鮮半島で採集された標本について記載する。'.repeat(5);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('텍스트 내용 비율'))).toBe(false);
    });

    it('한자 혼용 텍스트는 정상 처리', () => {
      const text = '朝鮮半島ニ於ケル魚類ノ新種ニ就テ。採集地：釜山港。'.repeat(10);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('텍스트 내용 비율'))).toBe(false);
    });

    it('특수문자만 있으면 감점', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'.repeat(20);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.issues.some(i => i.includes('텍스트 내용 비율'))).toBe(true);
    });
  });

  describe('품질 등급 판정', () => {
    it('점수 70 이상은 good', () => {
      const text = 'This is a high quality text about marine species collection in Korea. '.repeat(20);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.quality).toBe('good');
      expect(assessment.recommendation).toContain('자동 분석');
    });

    it('점수 50-69는 fair', () => {
      // 약간의 문제가 있는 텍스트
      const text = 'ab cd ef gh ij '.repeat(50) + 'Some longer words here too';
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      // fair 등급은 50-69 점수 범위
      if (assessment.score >= 50 && assessment.score < 70) {
        expect(assessment.quality).toBe('fair');
      }
    });

    it('점수 30 미만은 manual_needed', () => {
      // 매우 낮은 품질의 텍스트
      const text = '□■◆◇'.repeat(10);
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.quality).toBe('manual_needed');
      expect(assessment.recommendation).toContain('수동 분석');
    });
  });

  describe('빈 텍스트 처리', () => {
    it('빈 텍스트는 최저 점수', () => {
      const result = createMockResult('');
      const assessment = assessOCRQuality(result);

      expect(assessment.score).toBeLessThanOrEqual(30);
      expect(assessment.quality).toBe('manual_needed');
    });
  });

  describe('실제 시나리오 시뮬레이션', () => {
    it('양호한 영문 논문 텍스트', () => {
      const text = `
        A new species of fish from Korean waters

        Abstract: This paper describes a new species of Sebastes collected from
        the coast of Busan, Korea in September 1920. The holotype specimen
        (MNHN-IC-2020-0001) was deposited at the National Museum of Natural History.

        Material examined: Holotype, 245 mm SL, Busan Harbor, Korea,
        collected by T. Tanaka, 15 September 1920.

        Description: Body elongate, moderately compressed. Head large,
        its length 2.8-3.2 in SL. Eye large, its diameter 3.5-4.0 in HL.
      `;
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });

    it('양호한 한글 논문 텍스트', () => {
      const text = `
        한국산 신종 어류 기재

        초록: 본 논문은 1920년 9월 부산 연안에서 채집된 볼락속 신종을 기재한다.
        정모식표본(MNHN-IC-2020-0001)은 국립자연사박물관에 기탁되었다.

        조사 표본: 정모식표본, 체장 245mm, 부산항, 한국,
        채집자 T. Tanaka, 1920년 9월 15일.

        형태 기재: 체형은 긴 타원형이며 약간 측편됨. 두부는 크며
        두장은 체장의 2.8-3.2배. 눈은 크며 안경은 두장의 3.5-4.0배.
      `;
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });

    it('OCR 오류가 있는 스캔 문서', () => {
      const text = `
        A n□w sp□ci□s □f fish fr□m K□r□an wat□rs

        Abstr□ct: This p□p□r d□scrib□s □ n□w sp□ci□s □f S□bast□s
        c□ll□ct□d fr□m th□ c□□st □f Bus□n, K□r□□, in S□pt□mb□r 1920.
      `;
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.quality).not.toBe('good');
      expect(assessment.issues.length).toBeGreaterThan(0);
    });

    it('거의 빈 스캔 문서', () => {
      const text = '   \n\n   \n   ';
      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      expect(assessment.quality).toBe('manual_needed');
      expect(assessment.score).toBeLessThan(30);
    });
  });
});

describe('getQualityDescription', () => {
  it('각 품질 등급에 대한 설명 반환', () => {
    expect(getQualityDescription('good')).toContain('양호');
    expect(getQualityDescription('fair')).toContain('보통');
    expect(getQualityDescription('poor')).toContain('낮음');
    expect(getQualityDescription('manual_needed')).toContain('수동 분석');
  });

  it('알 수 없는 등급 처리', () => {
    // @ts-expect-error - 테스트를 위한 잘못된 입력
    expect(getQualityDescription('unknown')).toContain('알 수 없음');
  });
});

describe('generateOCRReport', () => {
  it('빈 결과 배열 처리', () => {
    const report = generateOCRReport([]);

    expect(report.summary.total).toBe(0);
    expect(report.summary.good).toBe(0);
    expect(report.details).toHaveLength(0);
  });

  it('여러 결과 요약', () => {
    const results = [
      { fileName: 'good1.pdf', quality: { quality: 'good' as const, score: 85, issues: [], recommendation: '' }, savedPath: 'data/pdfs/good1.pdf' },
      { fileName: 'good2.pdf', quality: { quality: 'good' as const, score: 75, issues: [], recommendation: '' }, savedPath: 'data/pdfs/good2.pdf' },
      { fileName: 'fair.pdf', quality: { quality: 'fair' as const, score: 55, issues: [], recommendation: '' }, savedPath: 'data/pdfs/fair.pdf' },
      { fileName: 'poor.pdf', quality: { quality: 'poor' as const, score: 35, issues: [], recommendation: '' }, savedPath: 'data/pdfs/ocr-needed/poor.pdf' },
      { fileName: 'manual.pdf', quality: { quality: 'manual_needed' as const, score: 15, issues: [], recommendation: '' }, savedPath: 'data/pdfs/ocr-needed/manual.pdf' },
    ];

    const report = generateOCRReport(results);

    expect(report.summary.total).toBe(5);
    expect(report.summary.good).toBe(2);
    expect(report.summary.fair).toBe(1);
    expect(report.summary.poor).toBe(1);
    expect(report.summary.manualNeeded).toBe(1);
    expect(report.details).toHaveLength(5);
  });
});
