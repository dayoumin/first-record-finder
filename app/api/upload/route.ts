import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let names: string[] = [];

    if (fileName.endsWith('.csv')) {
      // CSV 처리
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 첫 번째 열 추출 (콤마로 분리)
        const columns = line.split(',');
        const firstCol = columns[0]?.trim().replace(/^["']|["']$/g, '');

        // 헤더 행 건너뛰기 (숫자로 시작하지 않고, 영문 학명 패턴이 아닌 경우)
        if (i === 0 && !isScientificName(firstCol)) {
          continue;
        }

        if (firstCol && isScientificName(firstCol)) {
          names.push(firstCol);
        }
      }
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Excel 처리
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // JSON으로 변환 (헤더 포함, 배열 형식)
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: ''
      });

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        const firstCol = String(row[0] || '').trim();

        // 헤더 행 건너뛰기
        if (i === 0 && !isScientificName(firstCol)) {
          continue;
        }

        if (firstCol && isScientificName(firstCol)) {
          names.push(firstCol);
        }
      }
    } else {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv만 지원)' },
        { status: 400 }
      );
    }

    // 중복 제거
    names = [...new Set(names)];

    if (names.length === 0) {
      return NextResponse.json(
        { error: '유효한 학명을 찾을 수 없습니다. 첫 번째 열에 학명이 있는지 확인해주세요.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: names.length,
      names
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 학명 패턴 검사 (라틴어 이명법)
 * - 최소 2단어 (속명 + 종소명)
 * - 영문 알파벳으로 구성
 * - 첫 글자 대문자 (속명)
 */
function isScientificName(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();

  // 최소 2단어
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return false;

  // 속명: 첫 글자 대문자, 나머지 소문자
  const genus = words[0];
  if (!/^[A-Z][a-z]+$/.test(genus)) return false;

  // 종소명: 소문자
  const species = words[1];
  if (!/^[a-z]+$/.test(species)) return false;

  return true;
}
