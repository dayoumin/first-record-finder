'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Download, FileText, AlertCircle } from 'lucide-react';
import type { LiteratureCollectionProgress } from '@/types/species';

interface CollectionProgressProps {
  progress: LiteratureCollectionProgress;
}

export function CollectionProgress({ progress }: CollectionProgressProps) {
  if (progress.phase === 'idle') {
    return null;
  }

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">검색: {progress.searched}건</span>
          </div>
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">PDF 다운로드: {progress.downloaded}건</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">분석 완료: {progress.analyzed}건</span>
          </div>
        </div>

        {/* 에러 메시지 */}
        {progress.errors.length > 0 && (
          <div className="mt-3 space-y-1">
            {progress.errors.map((error, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                <span>{error}</span>
              </div>
            ))}
          </div>
        )}

        {/* 현재 진행 상태 */}
        {progress.phase !== 'completed' && (
          <div className="mt-3">
            <Badge variant="secondary" className="animate-pulse">
              {progress.phase === 'searching' && '검색 중...'}
              {progress.phase === 'downloading' && '다운로드 중...'}
              {progress.phase === 'analyzing' && '분석 중...'}
              {progress.currentSource && ` (${progress.currentSource})`}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
