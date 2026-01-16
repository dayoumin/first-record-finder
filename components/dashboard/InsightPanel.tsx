'use client';

import { Lightbulb, TrendingUp, Calendar, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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

interface InsightPanelProps {
  scientificName: string;
  data: InsightData | null;
  loading?: boolean;
  onSearchMore?: () => void;
}

function InsightSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

export function InsightPanel({
  scientificName,
  data,
  loading = false,
  onSearchMore,
}: InsightPanelProps) {
  if (loading) {
    return <InsightSkeleton />;
  }

  if (!data) {
    return (
      <Card role="region" aria-label="AI 인사이트">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            AI 인사이트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground" role="alert">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" aria-hidden="true" />
            <p>데이터를 불러오는 중 오류가 발생했습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="transition-all duration-200 hover:shadow-md"
      role="region"
      aria-label={`${scientificName}에 대한 AI 인사이트`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
          AI 인사이트
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 요약 */}
        <div className="space-y-2">
          <p className="text-sm" aria-live="polite">
            <span className="italic font-medium">{scientificName}</span>에 대해{' '}
            <span className="font-bold text-primary">{data.totalRecords}건</span>의
            기록이 검색되었습니다.
          </p>

          {data.hasKoreaRecord && (
            <Badge
              className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100 transition-colors"
              aria-label="한국 기록 후보가 있습니다"
            >
              한국 기록 후보 있음
            </Badge>
          )}
        </div>

        {/* 가장 오래된 기록 */}
        {data.oldestRecord && (
          <div
            className="bg-muted/50 rounded-lg p-3 transition-colors hover:bg-muted/70"
            role="article"
            aria-label="가장 오래된 기록 정보"
          >
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              가장 오래된 기록
            </div>
            <p className="text-sm text-muted-foreground">
              {data.oldestRecord.year}년 - {data.oldestRecord.title}
            </p>
            <Badge variant="outline" className="mt-1 text-xs">
              {data.oldestRecord.source}
            </Badge>
          </div>
        )}

        {/* 소스별 분포 요약 */}
        <div className="space-y-2" role="region" aria-label="소스별 분포">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            소스별 분포
          </div>
          <div className="flex flex-wrap gap-2" role="list">
            {Object.entries(data.sourceDistribution).map(([source, count]) => (
              <Badge
                key={source}
                variant="secondary"
                className="text-xs transition-transform hover:scale-105"
                role="listitem"
                aria-label={`${source}: ${count}건`}
              >
                {source}: {count}건
              </Badge>
            ))}
          </div>
        </div>

        {/* 추천 다음 단계 */}
        {data.recommendations.length > 0 && (
          <div className="space-y-2 pt-2 border-t" role="region" aria-label="추천 다음 단계">
            <div className="text-sm font-medium">추천 다음 단계</div>
            <ul className="space-y-1" role="list">
              {data.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="text-sm text-muted-foreground flex items-start gap-2 transition-colors hover:text-foreground"
                >
                  <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 추가 검색 버튼 */}
        {onSearchMore && (
          <Button
            variant="outline"
            className="w-full mt-4 transition-all duration-200 hover:bg-primary/10 hover:border-primary"
            onClick={onSearchMore}
            aria-label={`${scientificName}의 최초기록 분석 시작`}
          >
            최초기록 분석 시작
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
