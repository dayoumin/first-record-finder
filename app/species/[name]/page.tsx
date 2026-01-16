'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  StatisticsCard,
  YearlyTrendChart,
  SourceDistributionChart,
  InsightPanel,
  SpeciesDetailTabs,
} from '@/components/dashboard';
import { LiteratureItem, PatentItem, ReportItem } from '@/src/literature/types';
import { cn } from '@/lib/utils';

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

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function SpeciesDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const scientificName = decodeURIComponent(resolvedParams.name);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/species/${encodeURIComponent(scientificName)}/dashboard`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [scientificName]);

  const fetchInsightData = useCallback(async () => {
    setInsightLoading(true);

    try {
      const response = await fetch(
        `/api/species/${encodeURIComponent(scientificName)}/insights`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }

      const data = await response.json();
      setInsightData(data);
    } catch (err) {
      console.error('Insight fetch error:', err);
    } finally {
      setInsightLoading(false);
    }
  }, [scientificName]);

  useEffect(() => {
    fetchDashboardData();
    fetchInsightData();
  }, [fetchDashboardData, fetchInsightData]);

  const handleSearchMore = () => {
    // 홈 페이지로 이동하면서 학명 전달
    router.push(`/?species=${encodeURIComponent(scientificName)}`);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="max-w-6xl mx-auto w-full px-6 py-6 sm:py-8 flex-1" role="main">
        {/* 상단 네비게이션 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="shrink-0"
              aria-label="홈으로 돌아가기"
            >
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">홈으로</span>
                <span className="sm:hidden">뒤로</span>
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold italic truncate">
                {scientificName}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">학명 상세 정보</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchDashboardData();
              fetchInsightData();
            }}
            disabled={loading}
            aria-label="데이터 새로고침"
            className="self-end sm:self-auto"
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', loading && 'animate-spin')}
              aria-hidden="true"
            />
            새로고침
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-destructive" role="alert">
            <CardContent className="py-4">
              <p className="text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchDashboardData}
                aria-label="데이터 다시 불러오기"
              >
                다시 시도
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 통계 카드 */}
        <section aria-label="통계 요약" className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <StatisticsCard
              title="논문"
              value={dashboardData?.statistics.totalPapers || 0}
              icon="papers"
              loading={loading}
              description="ScienceON + OpenAlex"
            />
            <StatisticsCard
              title="특허"
              value={dashboardData?.statistics.totalPatents || 0}
              icon="patents"
              loading={loading}
              description="ScienceON"
            />
            <StatisticsCard
              title="연구보고서"
              value={dashboardData?.statistics.totalReports || 0}
              icon="reports"
              loading={loading}
              description="ScienceON"
            />
          </div>
        </section>

        {/* 차트 및 인사이트 */}
        <section aria-label="데이터 시각화" className="mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 order-2 lg:order-1">
              {loading ? (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-[250px] sm:h-[300px] w-full" />
                  </CardContent>
                </Card>
              ) : (
                <YearlyTrendChart
                  data={dashboardData?.statistics.yearlyData || []}
                  title="연도별 추이"
                />
              )}
            </div>
            <div className="order-1 lg:order-2">
              <InsightPanel
                scientificName={scientificName}
                data={insightData}
                loading={insightLoading}
                onSearchMore={handleSearchMore}
              />
            </div>
          </div>
        </section>

        {/* 소스 분포 차트 */}
        {dashboardData && dashboardData.statistics.sourceDistribution.length > 0 && (
          <section aria-label="소스별 분포" className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <SourceDistributionChart
                data={dashboardData.statistics.sourceDistribution}
                title="논문 소스별 분포"
              />
            </div>
          </section>
        )}

        {/* 탭 컨텐츠 */}
        <section aria-label="검색 결과 목록">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Search className="h-5 w-5" aria-hidden="true" />
                검색 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <SpeciesDetailTabs
                papers={dashboardData?.papers || []}
                patents={dashboardData?.patents || []}
                reports={dashboardData?.reports || []}
                papersLoading={loading}
                patentsLoading={loading}
                reportsLoading={loading}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
