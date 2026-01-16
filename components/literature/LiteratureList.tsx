'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiteratureCard } from './LiteratureCard';
import { FileText, PlayCircle } from 'lucide-react';
import type { CollectedLiterature } from '@/types/species';

interface LiteratureListProps {
  items: CollectedLiterature[];
  onAnalyze: (item: CollectedLiterature) => void;
  onAnalyzeAll: () => void;
  analyzingId?: string;
}

export function LiteratureList({
  items,
  onAnalyze,
  onAnalyzeAll,
  analyzingId,
}: LiteratureListProps) {
  const pdfCount = items.filter(l => l.pdfDownloaded).length;
  const pendingCount = items.filter(
    l => l.pdfDownloaded && l.analysisStatus === 'pending'
  ).length;
  const completedCount = items.filter(l => l.analysisStatus === 'completed').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">
            수집된 문헌
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant="outline">{items.length}개</Badge>
            {pdfCount > 0 && (
              <Badge variant="secondary">
                <FileText className="mr-1 h-3 w-3" />
                PDF {pdfCount}개
              </Badge>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onAnalyzeAll}
          disabled={pendingCount === 0 || !!analyzingId}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          PDF 전체 분석 ({pendingCount})
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 분석 요약 */}
        {completedCount > 0 && (
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-2">
            <span>분석 완료: {completedCount}건</span>
            <span>
              한국 기록:{' '}
              {items.filter(l => l.analysis?.hasKoreaRecord === true).length}건
            </span>
          </div>
        )}

        {/* 문헌 카드 목록 */}
        <div className="space-y-2">
          {items.map(item => (
            <LiteratureCard
              key={item.id}
              item={item}
              onAnalyze={() => onAnalyze(item)}
              isAnalyzing={analyzingId === item.id}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
