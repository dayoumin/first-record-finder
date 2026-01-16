import { NextRequest, NextResponse } from 'next/server';
import { ScienceOnClient } from '@/src/literature/scienceon-client';
import { OpenAlexClient } from '@/src/literature/openalex-client';
import { LiteratureItem, PatentItem, ReportItem } from '@/src/literature/types';

export const dynamic = 'force-dynamic';

interface DashboardData {
  papers: LiteratureItem[];
  patents: PatentItem[];
  reports: ReportItem[];
  statistics: {
    totalPapers: number;
    totalPatents: number;
    totalReports: number;
    yearlyData: { year: number; papers: number; patents: number; reports: number }[];
    sourceDistribution: { name: string; value: number; color: string }[];
  };
}

// 소스별 색상
const SOURCE_COLORS: Record<string, string> = {
  ScienceON: 'hsl(var(--primary))',
  OpenAlex: 'hsl(142.1 76.2% 36.3%)',
  기타: 'hsl(47.9 95.8% 53.1%)',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const scientificName = decodeURIComponent(name);

    // URL 파라미터에서 탭 정보 가져오기 (선택적)
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'all';
    const maxResults = parseInt(searchParams.get('maxResults') || '20', 10);

    // 클라이언트 초기화
    const scienceOnClient = new ScienceOnClient();
    const openAlexClient = new OpenAlexClient();

    let papers: LiteratureItem[] = [];
    let patents: PatentItem[] = [];
    let reports: ReportItem[] = [];

    // 탭에 따라 선택적 로딩
    if (tab === 'all' || tab === 'papers') {
      // ScienceON 논문 + OpenAlex 논문
      const [scienceOnPapers, openAlexPapers] = await Promise.all([
        scienceOnClient.searchArticles(scientificName, { maxResults }).catch(() => []),
        openAlexClient.search(scientificName, { maxResults }).catch(() => []),
      ]);
      papers = [...scienceOnPapers, ...openAlexPapers];
    }

    if (tab === 'all' || tab === 'patents') {
      patents = await scienceOnClient.searchPatents(scientificName, { maxResults }).catch(() => []);
    }

    if (tab === 'all' || tab === 'reports') {
      reports = await scienceOnClient.searchReports(scientificName, { maxResults }).catch(() => []);
    }

    // 통계 계산
    const yearlyDataMap = new Map<number, { papers: number; patents: number; reports: number }>();

    // 논문 연도별 집계
    papers.forEach((p) => {
      if (p.year) {
        const existing = yearlyDataMap.get(p.year) || { papers: 0, patents: 0, reports: 0 };
        existing.papers++;
        yearlyDataMap.set(p.year, existing);
      }
    });

    // 특허 연도별 집계 (출원일 기준)
    patents.forEach((p) => {
      const year = p.applicationDate ? parseInt(p.applicationDate.slice(0, 4), 10) : null;
      if (year && !isNaN(year)) {
        const existing = yearlyDataMap.get(year) || { papers: 0, patents: 0, reports: 0 };
        existing.patents++;
        yearlyDataMap.set(year, existing);
      }
    });

    // 보고서 연도별 집계
    reports.forEach((r) => {
      if (r.year) {
        const existing = yearlyDataMap.get(r.year) || { papers: 0, patents: 0, reports: 0 };
        existing.reports++;
        yearlyDataMap.set(r.year, existing);
      }
    });

    const yearlyData = Array.from(yearlyDataMap.entries())
      .map(([year, data]) => ({ year, ...data }))
      .sort((a, b) => a.year - b.year);

    // 소스별 분포
    const sourceCount: Record<string, number> = {};
    papers.forEach((p) => {
      const sourceName = p.source === 'scienceon' ? 'ScienceON' : p.source === 'openalex' ? 'OpenAlex' : '기타';
      sourceCount[sourceName] = (sourceCount[sourceName] || 0) + 1;
    });

    const sourceDistribution = Object.entries(sourceCount).map(([name, value]) => ({
      name,
      value,
      color: SOURCE_COLORS[name] || 'hsl(200 80% 50%)',
    }));

    const data: DashboardData = {
      papers,
      patents,
      reports,
      statistics: {
        totalPapers: papers.length,
        totalPatents: patents.length,
        totalReports: reports.length,
        yearlyData,
        sourceDistribution,
      },
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
