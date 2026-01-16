'use client';

import { SpeciesCard } from './SpeciesCard';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Play, Square, Download, RotateCcw, Loader2 } from 'lucide-react';
import type { BatchItem } from '@/types/species';

interface SpeciesListProps {
  items: BatchItem[];
  status: 'idle' | 'running' | 'completed';
  onStart: () => void;
  onStop: () => void;
  onDownload: () => void;
  onReset: () => void;
}

export function SpeciesList({
  items,
  status,
  onStart,
  onStop,
  onDownload,
  onReset,
}: SpeciesListProps) {
  const completed = items.filter(i => i.status === 'completed').length;
  const errors = items.filter(i => i.status === 'error').length;
  const processing = items.find(i => i.status === 'processing');
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 진행 상황 및 컨트롤 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{progress}%</span>
            <span className="text-muted-foreground">
              {completed} 완료
              {errors > 0 && <span className="text-destructive"> / {errors} 오류</span>}
              {' / '}{items.length} 전체
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {processing && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              처리 중: <em className="italic">{processing.inputName}</em>
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {status === 'idle' && (
            <Button onClick={onStart}>
              <Play className="mr-2 h-4 w-4" />
              검색 시작
            </Button>
          )}
          {status === 'running' && (
            <Button variant="destructive" onClick={onStop}>
              <Square className="mr-2 h-4 w-4" />
              중지
            </Button>
          )}
          {status === 'completed' && (
            <Button onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              다운로드
            </Button>
          )}
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            초기화
          </Button>
        </div>
      </div>

      {/* 학명 카드 목록 */}
      <div className="space-y-2">
        {items.map(item => (
          <SpeciesCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
