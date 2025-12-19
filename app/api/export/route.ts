import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface Synonym {
  name: string;
  author: string;
  year: number | null;
  status: string;
  aphiaId: number;
}

interface BatchItem {
  id: string;
  inputName: string;
  status: string;
  acceptedName?: string;
  aphiaId?: number;
  synonymCount?: number;
  synonyms?: Synonym[];
  searchUrls?: Array<{ name: string; scholar: string; kci: string }>;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: BatchItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '내보낼 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const workbook = XLSX.utils.book_new();

    // Sheet 1: 검색 결과 요약
    const summaryData = items.map(item => ({
      '입력 학명': item.inputName,
      '유효 학명': item.acceptedName || '',
      'AphiaID': item.aphiaId || '',
      '이명 개수': item.synonymCount || 0,
      '상태': item.status === 'completed' ? '완료' : item.status === 'error' ? '오류' : '대기',
      '오류': item.error || ''
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [
      { wch: 30 },  // 입력 학명
      { wch: 30 },  // 유효 학명
      { wch: 12 },  // AphiaID
      { wch: 10 },  // 이명 개수
      { wch: 8 },   // 상태
      { wch: 30 }   // 오류
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, '검색 결과');

    // Sheet 2: 이명 목록
    const synonymData: Array<Record<string, string | number>> = [];
    for (const item of items) {
      if (!item.synonyms) continue;
      for (const syn of item.synonyms) {
        synonymData.push({
          '유효 학명': item.acceptedName || item.inputName,
          '이명': syn.name,
          '저자': syn.author || '',
          '연도': syn.year || '',
          '상태': syn.status === 'accepted' ? '유효명' : '이명',
          'AphiaID': syn.aphiaId
        });
      }
    }

    if (synonymData.length > 0) {
      const synonymSheet = XLSX.utils.json_to_sheet(synonymData);
      synonymSheet['!cols'] = [
        { wch: 30 },  // 유효 학명
        { wch: 30 },  // 이명
        { wch: 25 },  // 저자
        { wch: 8 },   // 연도
        { wch: 10 },  // 상태
        { wch: 12 }   // AphiaID
      ];
      XLSX.utils.book_append_sheet(workbook, synonymSheet, '이명 목록');
    }

    // Sheet 3: 검색 링크
    const linkData: Array<Record<string, string>> = [];
    for (const item of items) {
      if (!item.searchUrls) continue;
      for (const url of item.searchUrls) {
        linkData.push({
          '유효 학명': item.acceptedName || item.inputName,
          '검색명': url.name,
          'Google Scholar': url.scholar,
          'KCI': url.kci
        });
      }
    }

    if (linkData.length > 0) {
      const linkSheet = XLSX.utils.json_to_sheet(linkData);
      linkSheet['!cols'] = [
        { wch: 30 },  // 유효 학명
        { wch: 30 },  // 검색명
        { wch: 80 },  // Google Scholar
        { wch: 60 }   // KCI
      ];
      XLSX.utils.book_append_sheet(workbook, linkSheet, '검색 링크');
    }

    // Buffer로 변환
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="first_record_search_${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: '엑셀 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
