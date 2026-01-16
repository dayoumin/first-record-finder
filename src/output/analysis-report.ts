/**
 * 분석 결과 리포트 생성
 *
 * 종별 분석 결과를 엑셀로 저장
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineResult, AnalyzedLiterature } from '../analysis/pipeline';

/** 리포트 저장 옵션 */
export interface ReportOptions {
  outputDir?: string;
  includeRawText?: boolean;  // 추출된 텍스트 포함 여부
}

/** 기본 출력 디렉토리 */
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'data', 'reports');

/**
 * 분석 결과를 엑셀로 저장
 */
export function saveAnalysisReport(
  result: PipelineResult,
  options?: ReportOptions
): string {
  const outputDir = options?.outputDir || DEFAULT_OUTPUT_DIR;

  // 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 워크북 생성
  const workbook = XLSX.utils.book_new();

  // 1. 요약 시트
  const summarySheet = createSummarySheet(result);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '요약');

  // 2. 분석 결과 시트
  const analysisSheet = createAnalysisSheet(result.analyzedItems);
  XLSX.utils.book_append_sheet(workbook, analysisSheet, '분석결과');

  // 3. 수동 확인 필요 시트
  if (result.itemsNeedingManualReview.length > 0) {
    const manualReviewSheet = createManualReviewSheet(result.itemsNeedingManualReview);
    XLSX.utils.book_append_sheet(workbook, manualReviewSheet, '수동확인필요');
  }

  // 4. 최초 기록 시트 (발견된 경우)
  if (result.firstKoreaRecord) {
    const firstRecordSheet = createFirstRecordSheet(result.firstKoreaRecord);
    XLSX.utils.book_append_sheet(workbook, firstRecordSheet, '최초기록');
  }

  // 5. LLM 디버그 시트 (디버깅 정보가 있는 항목)
  const itemsWithDebug = result.analyzedItems.filter(item => item.analysis?.llmDebug);
  if (itemsWithDebug.length > 0) {
    const debugSheet = createLLMDebugSheet(itemsWithDebug);
    XLSX.utils.book_append_sheet(workbook, debugSheet, 'LLM분석상세');
  }

  // 파일명 생성
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = result.scientificName.replace(/\s+/g, '_');
  const filename = `분석결과_${safeName}_${timestamp}.xlsx`;
  const filePath = path.join(outputDir, filename);

  // 저장
  XLSX.writeFile(workbook, filePath);

  console.log(`[Report] 저장 완료: ${filePath}`);
  return filePath;
}

/**
 * 요약 시트 생성
 */
function createSummarySheet(result: PipelineResult): XLSX.WorkSheet {
  const data = [
    ['분석 대상 종', result.scientificName],
    ['분석 일시', new Date().toLocaleString('ko-KR')],
    [''],
    ['검색 결과', `${result.totalSearched}건`],
    ['분석 완료', `${result.totalAnalyzed}건`],
    ['조기 종료', result.stoppedEarly ? '예 (한국 기록 발견)' : '아니오'],
    [''],
    ['한국 기록 발견', result.firstKoreaRecord ? '예' : '아니오'],
    ['수동 확인 필요', `${result.itemsNeedingManualReview.length}건`],
    ['오류 발생', `${result.errors.length}건`],
  ];

  if (result.firstKoreaRecord) {
    data.push(
      [''],
      ['=== 최초 한국 기록 ==='],
      ['연도', result.firstKoreaRecord.year?.toString() || '불명'],
      ['제목', result.firstKoreaRecord.title],
      ['저자', result.firstKoreaRecord.authors?.join(', ') || '불명'],
      ['채집지', result.firstKoreaRecord.analysis?.locality || '불명'],
      ['채집일', result.firstKoreaRecord.analysis?.collectionDate || '불명'],
      ['신뢰도', `${((result.firstKoreaRecord.analysis?.confidence || 0) * 100).toFixed(0)}%`],
      ['분석 소스', getSourceLabel(result.firstKoreaRecord.analysis?.analysisSource)],
    );
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * 분석 결과 시트 생성
 */
function createAnalysisSheet(items: AnalyzedLiterature[]): XLSX.WorkSheet {
  const headers = [
    '순번',
    '연도',
    '제목',
    '저자',
    '저널',
    '소스',
    '분석방식',
    '한국기록',
    '신뢰도',
    '채집지',
    '채집일',
    '수동확인필요',
    '판단근거',
    'URL',
    'PDF URL',
    '오류',
  ];

  const rows = items.map((item, idx) => [
    idx + 1,
    item.year || '',
    item.title,
    item.authors?.join('; ') || '',
    item.journal || '',
    item.source,
    getSourceLabel(item.analysis?.analysisSource),
    getKoreaRecordLabel(item.analysis?.hasKoreaRecord),
    item.analysis?.confidence ? `${(item.analysis.confidence * 100).toFixed(0)}%` : '',
    item.analysis?.locality || '',
    item.analysis?.collectionDate || '',
    item.analysis?.needsManualReview ? '필요' : '',
    item.analysis?.reasoning || '',
    item.url,
    item.pdfUrl || '',
    item.analysisError || '',
  ]);

  const data = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(data);

  // 열 너비 설정
  sheet['!cols'] = [
    { wch: 5 },   // 순번
    { wch: 6 },   // 연도
    { wch: 50 },  // 제목
    { wch: 30 },  // 저자
    { wch: 30 },  // 저널
    { wch: 10 },  // 소스
    { wch: 12 },  // 분석방식
    { wch: 10 },  // 한국기록
    { wch: 8 },   // 신뢰도
    { wch: 20 },  // 채집지
    { wch: 15 },  // 채집일
    { wch: 12 },  // 수동확인필요
    { wch: 50 },  // 판단근거
    { wch: 40 },  // URL
    { wch: 40 },  // PDF URL
    { wch: 30 },  // 오류
  ];

  return sheet;
}

/**
 * 수동 확인 필요 시트 생성
 */
function createManualReviewSheet(items: AnalyzedLiterature[]): XLSX.WorkSheet {
  const headers = [
    '순번',
    '연도',
    '제목',
    '분석방식',
    '한국기록(추정)',
    '신뢰도',
    '확인이 필요한 이유',
    'URL',
    'PDF URL',
  ];

  const rows = items.map((item, idx) => [
    idx + 1,
    item.year || '',
    item.title,
    getSourceLabel(item.analysis?.analysisSource),
    getKoreaRecordLabel(item.analysis?.hasKoreaRecord),
    item.analysis?.confidence ? `${(item.analysis.confidence * 100).toFixed(0)}%` : '',
    getManualReviewReason(item),
    item.url,
    item.pdfUrl || '',
  ]);

  const data = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(data);

  sheet['!cols'] = [
    { wch: 5 },
    { wch: 6 },
    { wch: 50 },
    { wch: 12 },
    { wch: 15 },
    { wch: 8 },
    { wch: 40 },
    { wch: 40 },
    { wch: 40 },
  ];

  return sheet;
}

/**
 * 최초 기록 시트 생성
 */
function createFirstRecordSheet(item: AnalyzedLiterature): XLSX.WorkSheet {
  const data = [
    ['=== 최초 한국 기록 문헌 ==='],
    [''],
    ['기본 정보'],
    ['연도', item.year?.toString() || '불명'],
    ['제목', item.title],
    ['저자', item.authors?.join(', ') || '불명'],
    ['저널', item.journal || '불명'],
    ['DOI', item.doi || '없음'],
    ['URL', item.url],
    ['PDF URL', item.pdfUrl || '없음'],
    [''],
    ['분석 결과'],
    ['분석 방식', getSourceLabel(item.analysis?.analysisSource)],
    ['한국 기록 여부', getKoreaRecordLabel(item.analysis?.hasKoreaRecord)],
    ['신뢰도', `${((item.analysis?.confidence || 0) * 100).toFixed(0)}%`],
    ['채집지', item.analysis?.locality || '불명'],
    ['채집일', item.analysis?.collectionDate || '불명'],
    ['표본 정보', item.analysis?.specimenInfo || '없음'],
    [''],
    ['판단 근거'],
    [item.analysis?.reasoning || ''],
    [''],
    ['관련 인용문'],
  ];

  // 인용문 추가
  if (item.analysis?.relevantQuotes) {
    item.analysis.relevantQuotes.forEach((quote, idx) => {
      data.push([`${idx + 1}. "${quote}"`]);
    });
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * 분석 소스 라벨
 */
function getSourceLabel(source?: string): string {
  switch (source) {
    case 'pdf_fulltext': return 'PDF 전문';
    case 'abstract_only': return '초록만';
    case 'metadata_only': return '메타데이터만';
    default: return '알 수 없음';
  }
}

/**
 * 한국 기록 여부 라벨
 */
function getKoreaRecordLabel(hasRecord?: boolean | null): string {
  if (hasRecord === true) return '있음';
  if (hasRecord === false) return '없음';
  return '불확실';
}

/**
 * 수동 확인 필요 이유
 */
function getManualReviewReason(item: AnalyzedLiterature): string {
  const reasons: string[] = [];

  if (item.analysis?.analysisSource !== 'pdf_fulltext') {
    reasons.push('PDF 전문이 아닌 ' + getSourceLabel(item.analysis?.analysisSource) + '으로 분석');
  }

  if (item.analysis?.hasKoreaRecord === null) {
    reasons.push('한국 기록 여부 불확실');
  }

  if (item.analysis?.confidence && item.analysis.confidence < 0.7) {
    reasons.push(`신뢰도 낮음 (${(item.analysis.confidence * 100).toFixed(0)}%)`);
  }

  return reasons.join('; ') || '기타';
}

/**
 * LLM 분석 상세 시트 생성
 * 프롬프트, 입력 텍스트, LLM 응답 등 디버깅 정보 포함
 */
function createLLMDebugSheet(items: AnalyzedLiterature[]): XLSX.WorkSheet {
  const headers = [
    '순번',
    '연도',
    '제목',
    '분석방식',
    '한국기록',
    '신뢰도',
    '사용모델',
    '입력텍스트길이',
    '입력텍스트(앞부분)',
    'LLM응답(원본)',
    '프롬프트(앞부분)',
  ];

  const rows = items.map((item, idx) => [
    idx + 1,
    item.year || '',
    item.title.slice(0, 50),
    getSourceLabel(item.analysis?.analysisSource),
    getKoreaRecordLabel(item.analysis?.hasKoreaRecord),
    item.analysis?.confidence ? `${(item.analysis.confidence * 100).toFixed(0)}%` : '',
    item.analysis?.modelUsed || '',
    item.analysis?.llmDebug?.inputLength || '',
    item.analysis?.llmDebug?.inputText?.slice(0, 300) || '',
    item.analysis?.llmDebug?.rawResponse?.slice(0, 500) || '',
    item.analysis?.llmDebug?.promptUsed?.slice(0, 300) || '',
  ]);

  const data = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(data);

  // 열 너비 설정
  sheet['!cols'] = [
    { wch: 5 },   // 순번
    { wch: 6 },   // 연도
    { wch: 40 },  // 제목
    { wch: 12 },  // 분석방식
    { wch: 10 },  // 한국기록
    { wch: 8 },   // 신뢰도
    { wch: 25 },  // 사용모델
    { wch: 10 },  // 입력텍스트길이
    { wch: 60 },  // 입력텍스트
    { wch: 80 },  // LLM응답
    { wch: 60 },  // 프롬프트
  ];

  return sheet;
}

/**
 * 여러 종의 분석 결과를 하나의 엑셀로 통합
 */
export function saveCombinedReport(
  results: PipelineResult[],
  outputPath?: string
): string {
  // outputPath가 있으면 그 상위 디렉토리, 없으면 DEFAULT_OUTPUT_DIR 자체를 생성
  const outputDir = outputPath ? path.dirname(outputPath) : DEFAULT_OUTPUT_DIR;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const workbook = XLSX.utils.book_new();

  // 1. 전체 요약 시트
  const overallSummary = createOverallSummarySheet(results);
  XLSX.utils.book_append_sheet(workbook, overallSummary, '전체요약');

  // 2. 종별 시트 (최대 30개)
  results.slice(0, 30).forEach((result, idx) => {
    const sheetName = `${idx + 1}_${result.scientificName.slice(0, 20)}`;
    const sheet = createSpeciesSummarySheet(result);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });

  // 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = outputPath || path.join(DEFAULT_OUTPUT_DIR, `통합분석결과_${timestamp}.xlsx`);

  XLSX.writeFile(workbook, filePath);
  console.log(`[Report] 통합 리포트 저장: ${filePath}`);

  return filePath;
}

/**
 * 전체 요약 시트
 */
function createOverallSummarySheet(results: PipelineResult[]): XLSX.WorkSheet {
  const headers = [
    '순번',
    '학명',
    '검색결과',
    '분석완료',
    '한국기록',
    '최초기록연도',
    '최초기록채집지',
    '분석방식',
    '신뢰도',
    '수동확인필요',
  ];

  const rows = results.map((result, idx) => [
    idx + 1,
    result.scientificName,
    result.totalSearched,
    result.totalAnalyzed,
    result.firstKoreaRecord ? '발견' : '미발견',
    result.firstKoreaRecord?.year || '',
    result.firstKoreaRecord?.analysis?.locality || '',
    result.firstKoreaRecord ? getSourceLabel(result.firstKoreaRecord.analysis?.analysisSource) : '',
    result.firstKoreaRecord?.analysis?.confidence
      ? `${(result.firstKoreaRecord.analysis.confidence * 100).toFixed(0)}%`
      : '',
    result.itemsNeedingManualReview.length,
  ]);

  const data = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(data);

  sheet['!cols'] = [
    { wch: 5 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
  ];

  return sheet;
}

/**
 * 종별 요약 시트
 */
function createSpeciesSummarySheet(result: PipelineResult): XLSX.WorkSheet {
  const data: (string | number)[][] = [
    ['학명', result.scientificName],
    ['검색 결과', `${result.totalSearched}건`],
    ['분석 완료', `${result.totalAnalyzed}건`],
    ['한국 기록', result.firstKoreaRecord ? '발견' : '미발견'],
    [''],
  ];

  if (result.firstKoreaRecord) {
    data.push(
      ['=== 최초 기록 ==='],
      ['연도', result.firstKoreaRecord.year || ''],
      ['제목', result.firstKoreaRecord.title],
      ['채집지', result.firstKoreaRecord.analysis?.locality || ''],
      ['신뢰도', `${((result.firstKoreaRecord.analysis?.confidence || 0) * 100).toFixed(0)}%`],
      ['분석방식', getSourceLabel(result.firstKoreaRecord.analysis?.analysisSource)],
      [''],
    );
  }

  // 분석된 문헌 목록
  data.push(['=== 분석된 문헌 ===']);
  data.push(['순번', '연도', '제목', '한국기록', '분석방식', '수동확인']);

  result.analyzedItems.forEach((item, idx) => {
    data.push([
      idx + 1,
      item.year || '',
      item.title.slice(0, 50),
      getKoreaRecordLabel(item.analysis?.hasKoreaRecord),
      getSourceLabel(item.analysis?.analysisSource),
      item.analysis?.needsManualReview ? '필요' : '',
    ]);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * JSON 형식으로 저장
 */
export function saveAnalysisJSON(
  result: PipelineResult,
  outputDir?: string
): string {
  const dir = outputDir || DEFAULT_OUTPUT_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = result.scientificName.replace(/\s+/g, '_');
  const filename = `분석결과_${safeName}_${timestamp}.json`;
  const filePath = path.join(dir, filename);

  // extractedText는 제외 (파일 크기 줄이기)
  const cleanResult = {
    ...result,
    analyzedItems: result.analyzedItems.map(item => ({
      ...item,
      extractedText: item.extractedText ? `[${item.extractedText.length}자]` : undefined,
    })),
  };

  fs.writeFileSync(filePath, JSON.stringify(cleanResult, null, 2), 'utf-8');
  console.log(`[Report] JSON 저장: ${filePath}`);

  return filePath;
}
