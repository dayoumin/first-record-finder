'use client';

import { useRef } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  Upload,
  FileText,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OCR_QUALITY_BADGES, KOREA_RECORD_LABELS } from '@/lib/constants';
import type { UploadedPDF, AnalysisResult, OCRQuality } from '@/types/species';

interface PdfUploaderProps {
  pdfs: UploadedPDF[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: (pdf: UploadedPDF) => void;
  onAnalyzeAll: () => void;
  isUploading: boolean;
  selectedSpecies: string;
  analyzingId?: string;
  defaultOpen?: boolean;
}

function getKoreaRecordLabel(result: AnalysisResult | undefined) {
  if (!result) return KOREA_RECORD_LABELS.undefined;
  if (result.hasKoreaRecord === true) return KOREA_RECORD_LABELS.true;
  if (result.hasKoreaRecord === false) return KOREA_RECORD_LABELS.false;
  return KOREA_RECORD_LABELS.null;
}

export function PdfUploader({
  pdfs,
  onUpload,
  onAnalyze,
  onAnalyzeAll,
  isUploading,
  selectedSpecies,
  analyzingId,
  defaultOpen = false,
}: PdfUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCount = pdfs.filter(p => p.analysisStatus === 'pending').length;

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors group">
        <div className="flex items-center gap-2">
          <span className="font-medium">수동 PDF 업로드</span>
          <span className="text-sm text-muted-foreground">
            (자동 수집 보완용)
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 border border-t-0 rounded-b-lg space-y-4">
          {/* 업로드 버튼 */}
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={onUpload}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isUploading ? '업로드 중...' : 'PDF 파일 선택'}
            </Button>
            <span className="text-sm text-muted-foreground">
              자동 수집에서 누락된 문헌을 직접 업로드할 수 있습니다
            </span>
          </div>

          {/* 업로드된 PDF 목록 */}
          {pdfs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  수동 업로드 문헌 ({pdfs.length}개)
                </span>
                <Button
                  size="sm"
                  onClick={onAnalyzeAll}
                  disabled={
                    !selectedSpecies ||
                    pendingCount === 0 ||
                    !!analyzingId
                  }
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  전체 분석 ({pendingCount})
                </Button>
              </div>

              <div className="space-y-2">
                {pdfs.map(pdf => {
                  const recordLabel = getKoreaRecordLabel(pdf.analysis);
                  const ocrBadge = pdf.ocrQuality
                    ? OCR_QUALITY_BADGES[pdf.ocrQuality.quality as OCRQuality]
                    : null;

                  return (
                    <Card
                      key={pdf.pdfId}
                      className={cn(
                        'transition-colors',
                        pdf.analysisStatus === 'completed' && 'bg-muted/30'
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {pdf.fileName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {pdf.textLength && (
                                  <span>
                                    {(pdf.textLength / 1000).toFixed(1)}KB 추출
                                  </span>
                                )}
                                {ocrBadge && (
                                  <Badge
                                    variant="secondary"
                                    className={cn('text-xs', ocrBadge.className)}
                                  >
                                    {ocrBadge.label}
                                  </Badge>
                                )}
                                {pdf.extractionError && (
                                  <span className="text-destructive">
                                    텍스트 추출 실패
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {pdf.analysisStatus === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => onAnalyze(pdf)}
                                disabled={!selectedSpecies || !!analyzingId}
                              >
                                분석
                              </Button>
                            )}
                            {pdf.analysisStatus === 'analyzing' && (
                              <Badge variant="secondary" className="animate-pulse">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                분석 중...
                              </Badge>
                            )}
                            {pdf.analysisStatus === 'completed' && (
                              <div className="text-right">
                                <span
                                  className={cn(
                                    'text-sm font-medium',
                                    recordLabel.className
                                  )}
                                >
                                  {recordLabel.text}
                                </span>
                                {pdf.analysis?.confidence !== undefined && (
                                  <p className="text-xs text-muted-foreground">
                                    ({Math.round(pdf.analysis.confidence * 100)}%)
                                  </p>
                                )}
                              </div>
                            )}
                            {pdf.analysisStatus === 'error' && (
                              <span className="text-sm text-destructive">
                                {pdf.analysisError || '분석 실패'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 분석 결과 상세 */}
                        {pdf.analysisStatus === 'completed' && pdf.analysis && (
                          <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                            {pdf.analysis.locality && (
                              <div>
                                <span className="font-medium">채집지:</span>{' '}
                                {pdf.analysis.locality}
                              </div>
                            )}
                            {pdf.analysis.collectionDate && (
                              <div>
                                <span className="font-medium">채집일:</span>{' '}
                                {pdf.analysis.collectionDate}
                              </div>
                            )}
                            {pdf.analysis.specimenInfo && (
                              <div>
                                <span className="font-medium">표본:</span>{' '}
                                {pdf.analysis.specimenInfo}
                              </div>
                            )}
                            {pdf.analysis.reasoning && (
                              <div className="text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  판단 근거:
                                </span>{' '}
                                {pdf.analysis.reasoning}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
