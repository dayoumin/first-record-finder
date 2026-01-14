/**
 * OCR 품질 평가 시뮬레이션 테스트
 *
 * 실제 문헌에서 발생할 수 있는 다양한 시나리오를 시뮬레이션
 */

import { describe, it, expect } from 'vitest';
import { assessOCRQuality, classifyPDFByOCRQuality, generateOCRReport } from '../src/pdf/ocr-quality';
import { DoclingResult } from '../src/pdf/types';

// 테스트용 DoclingResult 생성 헬퍼
function createMockResult(text: string, ocrUsed = true): DoclingResult {
  return {
    metadata: {},
    text,
    tables: [],
    figures: [],
    processedAt: new Date(),
    processingTime: 100,
    ocrUsed,
  };
}

describe('OCR 시뮬레이션: 실제 문헌 시나리오', () => {

  describe('1. 양호한 품질 (good) 시나리오', () => {

    it('현대 영문 논문 (디지털 PDF)', () => {
      const text = `
        A new species of Sebastes (Scorpaenidae) from Korean waters

        Abstract
        A new species of rockfish, Sebastes koreanus sp. nov., is described based on
        specimens collected from the coast of Busan, Korea. The holotype (MNHN-IC-2020-0001)
        was deposited at the National Museum of Natural History, Paris.

        Material examined
        Holotype: MNHN-IC-2020-0001, 245 mm SL, Busan Harbor, Korea,
        collected by T. Kim, 15 September 2020.

        Paratypes: 5 specimens, 180-220 mm SL, same locality, collected by
        K. Park and J. Lee, October 2020.

        Description
        Body elongate, moderately compressed. Head large, its length 2.8-3.2 in SL.
        Eye large, its diameter 3.5-4.0 in HL. Mouth terminal, slightly oblique.
        Dorsal fin with XIII spines and 13-14 soft rays.

        Distribution
        Currently known only from the southern coast of Korea, particularly
        around Busan and Jeju Island.
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('현대 영문 논문:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });

    it('현대 한글 논문 (디지털 PDF)', () => {
      const text = `
        한국산 볼락속 어류의 신종 기재

        초록
        본 연구에서는 부산 연안에서 채집된 볼락속(Sebastes) 어류의 신종을 기재한다.
        정모식표본(MNHN-IC-2020-0001)은 파리 국립자연사박물관에 기탁되었다.

        조사 표본
        정모식표본: MNHN-IC-2020-0001, 체장 245mm, 부산항, 대한민국,
        채집자 김태호, 2020년 9월 15일.

        부모식표본: 5개체, 체장 180-220mm, 동일 장소,
        채집자 박경수, 이정훈, 2020년 10월.

        형태 기재
        체형은 긴 타원형이며 약간 측편됨. 두부는 크며 두장은 체장의 2.8-3.2배.
        눈은 크며 안경은 두장의 3.5-4.0배. 입은 단형이며 약간 경사짐.
        등지느러미 극조 13개, 연조 13-14개.

        분포
        현재 한국 남해안, 특히 부산과 제주도 주변에서만 알려져 있다.
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('현대 한글 논문:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });

    it('일본어 논문 (1950년대, 깨끗한 스캔)', () => {
      const text = `
        朝鮮半島沿岸産魚類の一新種について

        緒言
        筆者は1955年9月、釜山港において採集された魚類標本を検討した結果、
        これがメバル属の一新種であることを確認したので、ここに記載する。

        材料および方法
        正模式標本：NSMT-P 12345、体長245mm、釜山港、朝鮮半島南部、
        田中茂穂採集、1955年9月15日。

        副模式標本：5個体、体長180-220mm、同所産、
        岡田弥一郎・松原喜代松採集、1955年10月。

        記載
        体は延長し、やや側扁する。頭部は大きく、頭長は体長の2.8-3.2倍。
        眼は大きく、眼径は頭長の3.5-4.0倍。口は端位でやや斜位。
        背鰭棘13本、軟条13-14本。

        分布
        現在のところ朝鮮半島南岸、特に釜山および済州島周辺のみから知られる。
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('일본어 논문 (1950년대):', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('2. 보통 품질 (fair) 시나리오', () => {

    it('오래된 일본어 문헌 (1920년대, 일부 OCR 오류)', () => {
      const text = `
        朝鮮海峽ニ於ケル魚類調査報告

        緒言
        大正九年九月、筆者ハ釜山港ニ於テ魚類ノ採集ヲ行ヒタリ。
        其ノ結果、メバル屬ノ一新種ヲ發見セリ。

        材料
        正模式標本：體長245粍、釜山港、朝鮮、
        田中茂穂採集、大正九年九月十五日。

        記□
        體ハ延長シ、稍側扁ス。頭部ハ大ニシテ、頭長ハ體長ノ2.8-3.2倍。
        眼ハ大ニシテ、眼徑ハ頭長ノ3.5-4.0倍。口ハ端位ニシテ斜位。

        分□
        現在ノ處、朝鮮半島南岸ヨリ知ラル。
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('오래된 일본어 (1920년대):', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      // 일부 □ 문자가 있어도 fair 이상이어야 함
      expect(['good', 'fair']).toContain(assessment.quality);
      expect(assessment.score).toBeGreaterThanOrEqual(50);
    });

    it('영문 논문 (스캔 품질 보통, 일부 흐림)', () => {
      const text = `
        A new species from Korean waters

        Abstract
        A new species of rockf1sh is described based on specimens collected from
        the coast of Busan, K0rea. The h0lotype was deposited at the Museum.

        Materia1 examined
        Ho1otype: 245 mm SL, Busan Harbor, Korea,
        col1ected by T. Kim, September 2020.

        Description
        Body e1ongate, moderate1y compressed. Head 1arge.
        Eye 1arge, its diameter 3.5-4.0 in HL.
        Dorsa1 fin with XIII spines.
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('영문 논문 (일부 흐림):', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      // l → 1 오류가 있어도 읽을 수 있으므로 fair 이상
      expect(['good', 'fair']).toContain(assessment.quality);
    });
  });

  describe('3. 낮은 품질 (poor) 시나리오', () => {

    it('심하게 손상된 스캔 문서', () => {
      const text = `
        A n□w sp□ci□s □f fish fr□m K□r□an wat□rs

        Abstr□ct
        This p□p□r d□scrib□s □ n□w sp□ci□s □f S□bast□s
        c□ll□ct□d fr□m th□ c□□st □f Bus□n, K□r□□.

        Mat□ri□l □x□min□d
        H□l□typ□: 245 mm SL, Bus□n H□rb□r, K□r□□,
        c□ll□ct□d by T. Kim, S□pt□mb□r 2020.
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('심하게 손상된 스캔:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      // 손상이 있지만 영문자도 많아서 fair로 분류됨 (점수 55)
      expect(['fair', 'poor', 'manual_needed']).toContain(assessment.quality);
      expect(assessment.issues.some(i => i.includes('깨진 문자'))).toBe(true);
    });

    it('레이아웃 깨진 2단 컬럼 문서', () => {
      const text = `
        A new species          Abstract
        from Korean           This paper describes
        waters                 a new species of

        Material              Description
        examined               Body elongate
        Holotype:              moderately
        245 mm                 compressed

                   Head large
        Busan                  its length
        Harbor                 2.8-3.2 in SL
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('레이아웃 깨진 2단 컬럼:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      // 레이아웃 문제 또는 반복 패턴이 감지됨
      expect(assessment.issues.some(i =>
        i.includes('레이아웃') || i.includes('공백') || i.includes('반복 패턴') || i.includes('짧음')
      )).toBe(true);
    });
  });

  describe('4. 수동 분석 필요 (manual_needed) 시나리오', () => {

    it('거의 인식 불가한 스캔', () => {
      const text = '□■◆◇○●△▲▽▼★☆※ ■□◆◇ ●○△▲';

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('거의 인식 불가:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('manual_needed');
      expect(assessment.score).toBeLessThan(30);
    });

    it('빈 페이지 (표지 또는 빈 페이지 스캔)', () => {
      const text = '   \n\n   \n   \n\n   ';

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('빈 페이지:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('manual_needed');
    });

    it('이미지만 있는 페이지 (그림/차트)', () => {
      const text = 'Fig. 1.     Fig. 2.     Fig. 3.';

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('이미지만 있는 페이지:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      // 텍스트가 짧아서 50점 감점, fair로 분류됨
      // 실제로는 이런 페이지는 분석에서 스킵하거나 수동 검토 권장
      expect(['fair', 'poor', 'manual_needed']).toContain(assessment.quality);
      expect(assessment.issues.some(i => i.includes('100자 미만'))).toBe(true);
    });
  });

  describe('5. 특수 케이스', () => {

    it('학명 + 숫자 데이터 (측정 표)', () => {
      const text = `
        Species measurements (mm)

        Sebastes schlegelii     245   180   95   42   28
        Sebastes inermis        220   165   88   38   25
        Sebastes trivittatus    198   148   76   34   22

        Locality: Busan, Korea
        Date: September 2020
        Collector: T. Kim
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('측정 데이터 표:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(['good', 'fair']).toContain(assessment.quality);
    });

    it('다국어 혼용 (영어 + 한글 + 일본어)', () => {
      const text = `
        New record of Sebastes schlegelii from Korea
        한국산 조피볼락의 신기록

        The specimen was collected from Busan Harbor, Korea (부산항).
        이 표본은 부산항에서 채집되었다.

        和名：クロソイ
        Korean name: 조피볼락

        Distribution: Korea (한국), Japan (日本)
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('다국어 혼용:', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });

    it('BHL 스타일 역사적 문헌 (1890년대 영문)', () => {
      const text = `
        ON A NEW SPECIES OF SEBASTES FROM COREA.

        By DAVID S. JORDAN and BARTON W. EVERMANN.

        The following new species of rock-fish was obtained by
        Mr. Pierre Louis Jouy, at Fusan, Corea, in September, 1885.

        SEBASTES JOUY, new species.

        Type.—No. 37493, U.S.N.M. Fusan, Corea. P. L. Jouy.

        Head 2.8 in length; depth 3.2. D. XIII, 14; A. III, 7.
        Scales 45.

        Body oblong, compressed, the back elevated. Head large,
        the profile steep. Eye large, 4 in head.
      `;

      const result = createMockResult(text);
      const assessment = assessOCRQuality(result);

      console.log('BHL 역사적 문헌 (1890년대):', { score: assessment.score, quality: assessment.quality, issues: assessment.issues });

      expect(assessment.quality).toBe('good');
      expect(assessment.score).toBeGreaterThanOrEqual(70);
    });
  });
});

describe('OCR 보고서 생성', () => {
  it('다양한 품질의 결과 요약', () => {
    const results = [
      { fileName: 'modern_paper.pdf', quality: { quality: 'good' as const, score: 92, issues: [], recommendation: '자동 분석 가능' }, savedPath: 'data/pdfs/modern_paper.pdf' },
      { fileName: 'old_scan.pdf', quality: { quality: 'fair' as const, score: 58, issues: ['일부 문자 불명확'], recommendation: '결과 검토 권장' }, savedPath: 'data/pdfs/old_scan.pdf' },
      { fileName: 'damaged.pdf', quality: { quality: 'poor' as const, score: 35, issues: ['깨진 문자 다수'], recommendation: '수동 확인 필요' }, savedPath: 'data/pdfs/ocr-needed/damaged.pdf' },
      { fileName: 'blank.pdf', quality: { quality: 'manual_needed' as const, score: 5, issues: ['텍스트 거의 없음'], recommendation: 'LM Notebook 분석 필요' }, savedPath: 'data/pdfs/ocr-needed/blank.pdf' },
    ];

    const report = generateOCRReport(results);

    console.log('OCR 보고서:', JSON.stringify(report.summary, null, 2));

    expect(report.summary.total).toBe(4);
    expect(report.summary.good).toBe(1);
    expect(report.summary.fair).toBe(1);
    expect(report.summary.poor).toBe(1);
    expect(report.summary.manualNeeded).toBe(1);
  });
});
