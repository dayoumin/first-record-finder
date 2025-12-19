/**
 * 엑셀 출력 모듈
 *
 * 검색 결과를 3개 시트로 구성된 엑셀 파일로 출력
 * - Sheet 1: 검색 결과 요약
 * - Sheet 2: 상세 기록
 * - Sheet 3: 이명 목록
 */

import * as XLSX from 'xlsx';
import {
  FirstRecordResult,
  ExcelSummaryRow,
  ExcelDetailRow,
  ExcelSynonymRow,
  ConfidenceLevel,
  VerificationStatus
} from '../types';

/**
 * 신뢰도 레벨 한글 변환
 */
function confidenceToKorean(level: ConfidenceLevel): string {
  switch (level) {
    case 1: return '확정';
    case 2: return '유력';
    case 3: return '검토 필요';
    case 4: return '제외';
    default: return '미확인';
  }
}

/**
 * 검증 상태 한글 변환
 */
function statusToKorean(status: VerificationStatus): string {
  switch (status) {
    case 'confirmed': return '확정';
    case 'probable': return '유력';
    case 'needs_review': return '검토 필요';
    case 'citation_only': return '단순 인용';
    case 'excluded': return '제외';
    case 'not_checked': return '미확인';
    default: return status;
  }
}

/**
 * 요약 시트 데이터 생성
 */
function createSummarySheet(results: FirstRecordResult[]): ExcelSummaryRow[] {
  return results.map(result => ({
    scientificName: result.acceptedName,
    koreanName: result.koreanName || '',
    firstRecordCitation: result.firstRecord?.citation || '미발견',
    year: result.firstRecord?.year || null,
    confidence: result.firstRecord
      ? confidenceToKorean(result.firstRecord.confidenceLevel)
      : '-',
    status: result.firstRecord?.needsManualReview ? '검토 필요' : '확정',
    notes: result.searchNotes || ''
  }));
}

/**
 * 상세 기록 시트 데이터 생성
 */
function createDetailSheet(results: FirstRecordResult[]): ExcelDetailRow[] {
  const rows: ExcelDetailRow[] = [];

  for (const result of results) {
    for (const record of result.candidateRecords) {
      rows.push({
        scientificName: result.acceptedName,
        citation: record.citation,
        year: record.year,
        page: record.evidence.page || '',
        matchedName: record.matchedName,
        quote: record.evidence.quote || '',
        localityInfo: record.evidence.localityInfo || '',
        specimenInfo: record.evidence.specimenInfo || '',
        verificationStatus: statusToKorean(record.verificationStatus),
        ambiguityReasons: record.ambiguityReasons.join(', ')
      });
    }
  }

  return rows;
}

/**
 * 이명 시트 데이터 생성
 */
function createSynonymSheet(results: FirstRecordResult[]): ExcelSynonymRow[] {
  const rows: ExcelSynonymRow[] = [];

  for (const result of results) {
    for (const syn of result.synonyms) {
      rows.push({
        acceptedName: result.acceptedName,
        synonym: syn.name,
        author: syn.author,
        year: syn.year,
        status: syn.status
      });
    }
  }

  return rows;
}

/**
 * 엑셀 워크북 생성
 */
export function createExcelWorkbook(results: FirstRecordResult[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: 요약
  const summaryData = createSummarySheet(results);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData, {
    header: [
      'scientificName',
      'koreanName',
      'firstRecordCitation',
      'year',
      'confidence',
      'status',
      'notes'
    ]
  });

  // 한글 헤더로 변경
  XLSX.utils.sheet_add_aoa(summarySheet, [[
    '학명',
    '국명',
    '최초기록 문헌',
    '연도',
    '신뢰도',
    '상태',
    '비고'
  ]], { origin: 'A1' });

  // 열 너비 설정
  summarySheet['!cols'] = [
    { wch: 30 },  // 학명
    { wch: 15 },  // 국명
    { wch: 50 },  // 최초기록 문헌
    { wch: 8 },   // 연도
    { wch: 12 },  // 신뢰도
    { wch: 12 },  // 상태
    { wch: 30 }   // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, '검색 결과 요약');

  // Sheet 2: 상세 기록
  const detailData = createDetailSheet(results);
  const detailSheet = XLSX.utils.json_to_sheet(detailData, {
    header: [
      'scientificName',
      'citation',
      'year',
      'page',
      'matchedName',
      'quote',
      'localityInfo',
      'specimenInfo',
      'verificationStatus',
      'ambiguityReasons'
    ]
  });

  XLSX.utils.sheet_add_aoa(detailSheet, [[
    '학명',
    '문헌',
    '연도',
    '페이지',
    '검색명',
    '원문 인용',
    '채집지 정보',
    '표본 정보',
    '검증 상태',
    '애매한 이유'
  ]], { origin: 'A1' });

  detailSheet['!cols'] = [
    { wch: 25 },  // 학명
    { wch: 50 },  // 문헌
    { wch: 8 },   // 연도
    { wch: 10 },  // 페이지
    { wch: 25 },  // 검색명
    { wch: 60 },  // 원문 인용
    { wch: 30 },  // 채집지 정보
    { wch: 25 },  // 표본 정보
    { wch: 12 },  // 검증 상태
    { wch: 30 }   // 애매한 이유
  ];

  XLSX.utils.book_append_sheet(workbook, detailSheet, '상세 기록');

  // Sheet 3: 이명 목록
  const synonymData = createSynonymSheet(results);
  const synonymSheet = XLSX.utils.json_to_sheet(synonymData, {
    header: [
      'acceptedName',
      'synonym',
      'author',
      'year',
      'status'
    ]
  });

  XLSX.utils.sheet_add_aoa(synonymSheet, [[
    '유효명',
    '이명',
    '저자',
    '연도',
    '상태'
  ]], { origin: 'A1' });

  synonymSheet['!cols'] = [
    { wch: 30 },  // 유효명
    { wch: 30 },  // 이명
    { wch: 25 },  // 저자
    { wch: 8 },   // 연도
    { wch: 12 }   // 상태
  ];

  XLSX.utils.book_append_sheet(workbook, synonymSheet, '이명 목록');

  return workbook;
}

/**
 * 엑셀 파일로 저장
 */
export function saveExcel(
  results: FirstRecordResult[],
  filename: string
): void {
  const workbook = createExcelWorkbook(results);
  XLSX.writeFile(workbook, filename);
  console.log(`Excel saved: ${filename}`);
}

/**
 * 엑셀 버퍼 생성 (웹 다운로드용)
 */
export function createExcelBuffer(results: FirstRecordResult[]): Buffer {
  const workbook = createExcelWorkbook(results);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * 단일 결과를 엑셀로 저장
 */
export function saveSingleResult(
  result: FirstRecordResult,
  outputDir: string = './data/exports'
): string {
  const safeName = result.acceptedName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${outputDir}/${safeName}_${timestamp}.xlsx`;

  saveExcel([result], filename);
  return filename;
}
