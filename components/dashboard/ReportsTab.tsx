'use client';

import { ExternalLink, ScrollText, Calendar, Building2, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReportItem } from '@/src/literature/types';

interface ReportsTabProps {
  reports: ReportItem[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function ReportCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

export function ReportsTab({
  reports,
  loading = false,
  onLoadMore,
  hasMore = false,
}: ReportsTabProps) {
  if (loading && reports.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <ReportCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <ScrollText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">연구보고서가 없습니다</h3>
        <p className="text-sm text-muted-foreground mt-2">
          해당 학명으로 검색된 연구보고서가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id} className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium leading-tight">
                  {report.title}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-700 border-amber-200">
                  보고서
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 연구기관 */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{report.organization}</span>
              </div>

              {/* 연도 및 부처 */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {report.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {report.year}
                  </div>
                )}
                {report.ministry && (
                  <span className="truncate">{report.ministry}</span>
                )}
              </div>

              {/* 과제명/과제번호 */}
              {report.projectName && (
                <div className="text-sm">
                  <span className="text-muted-foreground">과제명: </span>
                  <span className="font-medium">{report.projectName}</span>
                </div>
              )}

              {/* 분류 정보 */}
              <div className="flex flex-wrap gap-2">
                {report.projectNumber && (
                  <Badge variant="secondary" className="text-xs">
                    과제번호: {report.projectNumber}
                  </Badge>
                )}
                {report.researchType && (
                  <Badge variant="secondary" className="text-xs">
                    {report.researchType}
                  </Badge>
                )}
              </div>

              {/* 초록 */}
              {report.abstract && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {report.abstract}
                </p>
              )}

              {/* 링크 */}
              <div className="flex items-center gap-2 pt-2">
                {report.pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    asChild
                  >
                    <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <FileDown className="h-3 w-3" />
                      PDF
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-1"
                  asChild
                >
                  <a href={report.url} target="_blank" rel="noopener noreferrer">
                    상세 보기
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {hasMore && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={loading}
            >
              {loading ? '로딩 중...' : '더 보기'}
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
