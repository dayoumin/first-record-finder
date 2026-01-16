import { NextRequest, NextResponse } from 'next/server';
import { ScienceOnClient } from '@/src/literature/scienceon-client';
import { OpenAlexClient } from '@/src/literature/openalex-client';

export const dynamic = 'force-dynamic';

interface InsightData {
  totalRecords: number;
  oldestRecord?: {
    year: number;
    title: string;
    source: string;
  };
  sourceDistribution: Record<string, number>;
  hasKoreaRecord: boolean;
  recommendations: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const scientificName = decodeURIComponent(name);

    // 클라이언트 초기화
    const scienceOnClient = new ScienceOnClient();
    const openAlexClient = new OpenAlexClient();

    // 모든 소스에서 데이터 수집
    const [articles, patents, reports, openAlexPapers] = await Promise.all([
      scienceOnClient.searchArticles(scientificName, { maxResults: 50 }).catch(() => []),
      scienceOnClient.searchPatents(scientificName, { maxResults: 50 }).catch(() => []),
      scienceOnClient.searchReports(scientificName, { maxResults: 50 }).catch(() => []),
      openAlexClient.search(scientificName, { maxResults: 50 }).catch(() => []),
    ]);

    // 전체 기록 수
    const totalRecords = articles.length + patents.length + reports.length + openAlexPapers.length;

    // 소스별 분포
    const sourceDistribution: Record<string, number> = {};
    if (articles.length > 0) sourceDistribution['ScienceON 논문'] = articles.length;
    if (patents.length > 0) sourceDistribution['ScienceON 특허'] = patents.length;
    if (reports.length > 0) sourceDistribution['ScienceON 보고서'] = reports.length;
    if (openAlexPapers.length > 0) sourceDistribution['OpenAlex'] = openAlexPapers.length;

    // 가장 오래된 기록 찾기
    let oldestRecord: InsightData['oldestRecord'] | undefined;

    // 모든 논문의 연도 수집
    const allRecords = [
      ...articles.map((a) => ({ year: a.year, title: a.title, source: 'ScienceON' })),
      ...openAlexPapers.map((p) => ({ year: p.year, title: p.title, source: 'OpenAlex' })),
      ...reports.map((r) => ({ year: r.year, title: r.title, source: 'ScienceON 보고서' })),
    ].filter((r) => r.year !== null && r.year > 1800) as { year: number; title: string; source: string }[];

    if (allRecords.length > 0) {
      allRecords.sort((a, b) => a.year - b.year);
      oldestRecord = allRecords[0];
    }

    // 한국 기록 여부 판단 (간단한 휴리스틱)
    const koreaKeywords = ['korea', 'korean', '한국', '국내', 'south korea', 'rok'];
    const hasKoreaRecord = [
      ...articles.map((a) => `${a.title} ${a.snippet || ''}`),
      ...reports.map((r) => `${r.title} ${r.abstract || ''}`),
    ].some((text) =>
      koreaKeywords.some((keyword) => text.toLowerCase().includes(keyword))
    );

    // 추천 사항 생성
    const recommendations: string[] = [];

    if (totalRecords === 0) {
      recommendations.push('다른 학명이나 이명으로 검색해 보세요.');
      recommendations.push('직접 PDF를 업로드하여 분석할 수 있습니다.');
    } else {
      if (hasKoreaRecord) {
        recommendations.push('한국 기록 후보가 있습니다. 최초기록 분석을 진행하세요.');
      }

      if (articles.length > 0 || openAlexPapers.length > 0) {
        recommendations.push('논문 목록에서 관련 문헌을 확인하세요.');
      }

      if (patents.length > 0) {
        recommendations.push('관련 특허가 있습니다. 기술 동향을 확인하세요.');
      }

      if (reports.length > 0) {
        recommendations.push('연구보고서에서 추가 정보를 확인할 수 있습니다.');
      }

      if (oldestRecord && oldestRecord.year < 1950) {
        recommendations.push(`${oldestRecord.year}년의 역사적 기록이 있습니다. BHL에서 원문을 확인하세요.`);
      }
    }

    const data: InsightData = {
      totalRecords,
      oldestRecord,
      sourceDistribution,
      hasKoreaRecord,
      recommendations,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Insights API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
