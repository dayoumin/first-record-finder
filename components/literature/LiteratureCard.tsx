'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ExternalLink,
  FileText,
  Loader2,
  ChevronDown,
  MapPin,
  Calendar,
  Quote,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OCR_QUALITY_BADGES, KOREA_RECORD_LABELS } from '@/lib/constants';
import type { CollectedLiterature, AnalysisResult, OCRQuality } from '@/types/species';

interface LiteratureCardProps {
  item: CollectedLiterature;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

function getKoreaRecordLabel(result: AnalysisResult | undefined) {
  if (!result) return KOREA_RECORD_LABELS.undefined;
  if (result.hasKoreaRecord === true) return KOREA_RECORD_LABELS.true;
  if (result.hasKoreaRecord === false) return KOREA_RECORD_LABELS.false;
  return KOREA_RECORD_LABELS.null;
}

export function LiteratureCard({
  item,
  onAnalyze,
  isAnalyzing = false,
}: LiteratureCardProps) {
  const recordLabel = getKoreaRecordLabel(item.analysis);
  const ocrBadge = item.ocrQuality
    ? OCR_QUALITY_BADGES[item.ocrQuality.quality as OCRQuality]
    : null;

  const hasAnalysisDetail =
    item.analysisStatus === 'completed' &&
    item.analysis &&
    (item.analysis.locality ||
     item.analysis.collectionDate ||
     item.analysis.relevantQuotes?.length ||
     item.analysis.reasoning);

  return (
    <Card className={cn(
      'transition-colors',
      item.pdfDownloaded && 'border-l-4 border-l-primary',
      item.analysisStatus === 'completed' && 'bg-muted/30',
    )}>
      <Collapsible>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 메인 정보 */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* 제목 */}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-primary hover:underline line-clamp-2 flex items-start gap-1"
              >
                {item.title}
                <ExternalLink className="h-3 w-3 flex-shrink-0 mt-1" />
              </a>

              {/* 메타 정보 */}
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {item.source.toUpperCase()}
                </Badge>
                {item.year && <span>{item.year}</span>}
                {item.authors.length > 0 && (
                  <span>
                    {item.authors.slice(0, 2).join(', ')}
                    {item.authors.length > 2 && ' et al.'}
                  </span>
                )}
                {item.journal && (
                  <span className="italic truncate max-w-[200px]">
                    {item.journal}
                  </span>
                )}
                {ocrBadge && (
                  <Badge variant="secondary" className={cn('text-xs', ocrBadge.className)}>
                    {ocrBadge.label}
                  </Badge>
                )}
              </div>

              {/* 스니펫 */}
              {item.snippet && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.snippet}
                </p>
              )}
            </div>

            {/* 액션 영역 */}
            <div className="flex sm:flex-col items-center gap-2 sm:w-32">
              {item.pdfDownloaded ? (
                <>
                  {item.analysisStatus === 'pending' && onAnalyze && (
                    <Button
                      size="sm"
                      onClick={onAnalyze}
                      disabled={isAnalyzing}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      분석
                    </Button>
                  )}
                  {item.analysisStatus === 'analyzing' && (
                    <Badge variant="secondary" className="animate-pulse">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      분석 중...
                    </Badge>
                  )}
                  {item.analysisStatus === 'completed' && (
                    <div className="text-center">
                      <span className={cn('text-sm font-medium', recordLabel.className)}>
                        {recordLabel.text}
                      </span>
                      {item.analysis?.confidence !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          ({Math.round(item.analysis.confidence * 100)}%)
                        </p>
                      )}
                    </div>
                  )}
                  {item.analysisStatus === 'error' && (
                    <span className="text-sm text-destructive">
                      {item.analysisError || '분석 실패'}
                    </span>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  PDF 없음
                </Badge>
              )}
            </div>
          </div>

          {/* 분석 결과 상세 (확장 가능) */}
          {hasAnalysisDetail && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-between text-muted-foreground"
              >
                분석 결과 상세
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          )}
        </CardContent>

        <CollapsibleContent>
          {item.analysis && (
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              {item.analysis.locality && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">채집지:</span>
                    <span className="ml-1">{item.analysis.locality}</span>
                  </div>
                </div>
              )}

              {item.analysis.collectionDate && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">채집일:</span>
                    <span className="ml-1">{item.analysis.collectionDate}</span>
                  </div>
                </div>
              )}

              {item.analysis.relevantQuotes && item.analysis.relevantQuotes.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">관련 인용:</span>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {item.analysis.relevantQuotes.slice(0, 3).map((quote, i) => (
                        <li key={i} className="italic">&quot;{quote}&quot;</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {item.analysis.reasoning && (
                <div className="flex items-start gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">판단 근거:</span>
                    <p className="mt-1 text-muted-foreground">
                      {item.analysis.reasoning}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
