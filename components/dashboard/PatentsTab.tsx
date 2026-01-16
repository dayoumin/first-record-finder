'use client';

import { ExternalLink, FlaskConical, Calendar, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PatentItem } from '@/src/literature/types';

interface PatentsTabProps {
  patents: PatentItem[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function PatentCardSkeleton() {
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

export function PatentsTab({
  patents,
  loading = false,
  onLoadMore,
  hasMore = false,
}: PatentsTabProps) {
  if (loading && patents.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <PatentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (patents.length === 0) {
    return (
      <div className="text-center py-12">
        <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">특허가 없습니다</h3>
        <p className="text-sm text-muted-foreground mt-2">
          해당 학명으로 검색된 특허가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-4">
        {patents.map((patent) => (
          <Card key={patent.id} className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium leading-tight">
                  {patent.title}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 bg-green-50 text-green-700 border-green-200">
                  특허
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 출원인/발명자 */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{patent.applicant}</span>
                {patent.inventor && (
                  <span className="text-xs">({patent.inventor})</span>
                )}
              </div>

              {/* 출원일/등록일 */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {patent.applicationDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    출원: {patent.applicationDate}
                  </div>
                )}
                {patent.registrationDate && (
                  <span>등록: {patent.registrationDate}</span>
                )}
              </div>

              {/* 출원번호/등록번호 */}
              <div className="flex flex-wrap gap-2">
                {patent.applicationNumber && (
                  <Badge variant="secondary" className="text-xs">
                    출원번호: {patent.applicationNumber}
                  </Badge>
                )}
                {patent.registrationNumber && (
                  <Badge variant="secondary" className="text-xs">
                    등록번호: {patent.registrationNumber}
                  </Badge>
                )}
              </div>

              {/* IPC 분류 */}
              {patent.ipcCodes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {patent.ipcCodes.slice(0, 3).map((ipc, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {ipc}
                    </Badge>
                  ))}
                  {patent.ipcCodes.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{patent.ipcCodes.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* 초록 */}
              {patent.abstract && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {patent.abstract}
                </p>
              )}

              {/* 링크 */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-1"
                  asChild
                >
                  <a href={patent.url} target="_blank" rel="noopener noreferrer">
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
