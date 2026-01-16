'use client';

import { ExternalLink, FileText, Calendar, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LiteratureItem } from '@/src/literature/types';

interface PapersTabProps {
  papers: LiteratureItem[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function PaperCardSkeleton() {
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

export function PapersTab({
  papers,
  loading = false,
  onLoadMore,
  hasMore = false,
}: PapersTabProps) {
  if (loading && papers.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <PaperCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">논문이 없습니다</h3>
        <p className="text-sm text-muted-foreground mt-2">
          해당 학명으로 검색된 논문이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-4">
        {papers.map((paper) => (
          <Card key={paper.id} className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium leading-tight">
                  {paper.title}
                </CardTitle>
                <Badge variant="outline" className="shrink-0">
                  {paper.source.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 저자 */}
              {paper.authors.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {paper.authors.slice(0, 3).join(', ')}
                    {paper.authors.length > 3 && ` 외 ${paper.authors.length - 3}명`}
                  </span>
                </div>
              )}

              {/* 연도 및 저널 */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {paper.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {paper.year}
                  </div>
                )}
                {paper.journal && (
                  <span className="truncate">{paper.journal}</span>
                )}
                {paper.volume && <span>Vol. {paper.volume}</span>}
              </div>

              {/* 초록 미리보기 */}
              {paper.snippet && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {paper.snippet}
                </p>
              )}

              {/* DOI 및 링크 */}
              <div className="flex items-center gap-2 pt-2">
                {paper.doi && (
                  <Badge variant="secondary" className="text-xs">
                    DOI: {paper.doi}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-1"
                  asChild
                >
                  <a href={paper.url} target="_blank" rel="noopener noreferrer">
                    원문 보기
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
