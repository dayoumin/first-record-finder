'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ExternalLink, Loader2, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BatchItem } from '@/types/species';

interface SpeciesCardProps {
  item: BatchItem;
  defaultExpanded?: boolean;
}

const statusIcons = {
  pending: null,
  processing: <Loader2 className="h-4 w-4 animate-spin text-blue-500" aria-hidden="true" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />,
};

const statusLabels = {
  pending: '대기 중',
  processing: '처리 중',
  completed: '완료',
  error: '오류',
};

const statusColors = {
  pending: 'bg-muted',
  processing: 'bg-blue-100 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
  completed: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
};

export function SpeciesCard({ item, defaultExpanded = false }: SpeciesCardProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const canExpand = item.status === 'completed' && item.searchUrls;

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        statusColors[item.status]
      )}
      role="article"
      aria-label={`${item.inputName} - ${statusLabels[item.status]}`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          asChild
          disabled={!canExpand}
        >
          <CardContent
            className={cn(
              'p-4 transition-colors',
              canExpand && 'cursor-pointer hover:bg-accent/50'
            )}
            tabIndex={canExpand ? 0 : -1}
            onKeyDown={(e) => {
              if (canExpand && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setIsOpen(!isOpen);
              }
            }}
            aria-expanded={canExpand ? isOpen : undefined}
            aria-controls={canExpand ? `species-content-${item.inputName}` : undefined}
          >
            <div className="flex items-center gap-3">
              {/* 상태 아이콘 */}
              <div
                className="w-5 h-5 flex items-center justify-center"
                aria-label={statusLabels[item.status]}
              >
                {statusIcons[item.status]}
                {item.status === 'pending' && (
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" aria-hidden="true" />
                )}
              </div>

              {/* 학명 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium italic truncate">
                    {item.inputName}
                  </span>
                  {item.acceptedName && item.acceptedName !== item.inputName && (
                    <>
                      <span className="text-muted-foreground" aria-hidden="true">→</span>
                      <span className="sr-only">유효명:</span>
                      <span className="font-medium italic text-primary truncate">
                        {item.acceptedName}
                      </span>
                    </>
                  )}
                </div>
                {item.error && (
                  <p className="text-sm text-destructive mt-1" role="alert">
                    {item.error}
                  </p>
                )}
              </div>

              {/* 이명 개수 배지 */}
              {item.synonymCount !== undefined && (
                <Badge
                  variant="secondary"
                  className="shrink-0"
                  aria-label={`이명 ${item.synonymCount}개`}
                >
                  {item.synonymCount} 이명
                </Badge>
              )}

              {/* 확장 화살표 */}
              {canExpand && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        {/* 확장 내용: 검색 URL 테이블 */}
        <CollapsibleContent
          id={`species-content-${item.inputName}`}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          {item.status === 'completed' && item.searchUrls && (
            <div className="px-4 pb-4 space-y-3">
              {/* 상세 페이지 링크 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 transition-all duration-200 hover:bg-primary/10"
                asChild
              >
                <Link
                  href={`/species/${encodeURIComponent(item.acceptedName || item.inputName)}`}
                  aria-label={`${item.acceptedName || item.inputName}의 논문, 특허, 보고서 상세 보기`}
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  논문/특허/보고서 상세 보기
                </Link>
              </Button>

              {/* 검색 URL 테이블 */}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableBody>
                    {item.searchUrls.map((url, i) => (
                      <TableRow
                        key={i}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium italic w-1/3">
                          {url.name}
                        </TableCell>
                        <TableCell className="space-x-2">
                          <a
                            href={url.scholar}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                            aria-label={`${url.name} Google Scholar에서 검색 (새 탭에서 열림)`}
                          >
                            Scholar
                            <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                          </a>
                          <a
                            href={url.kci}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                            aria-label={`${url.name} KCI에서 검색 (새 탭에서 열림)`}
                          >
                            KCI
                            <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
