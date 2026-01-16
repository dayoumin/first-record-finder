'use client';

import { useState, useCallback } from 'react';
import type { UploadedPDF, LLMSettings, Synonym } from '@/types/species';

interface UsePdfAnalysisOptions {
  onUploadComplete?: (pdf: UploadedPDF) => void;
  onAnalysisComplete?: (pdf: UploadedPDF) => void;
  onError?: (error: string) => void;
}

interface UsePdfAnalysisReturn {
  pdfs: UploadedPDF[];
  isUploading: boolean;
  analyzingId: string | undefined;
  upload: (files: FileList, speciesName?: string) => Promise<void>;
  analyze: (
    pdf: UploadedPDF,
    scientificName: string,
    synonyms: Synonym[],
    llmSettings: LLMSettings
  ) => Promise<void>;
  analyzeAll: (
    scientificName: string,
    synonyms: Synonym[],
    llmSettings: LLMSettings
  ) => Promise<void>;
  reset: () => void;
}

export function usePdfAnalysis(
  opts: UsePdfAnalysisOptions = {}
): UsePdfAnalysisReturn {
  const [pdfs, setPdfs] = useState<UploadedPDF[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | undefined>();

  // PDF 업로드
  const upload = useCallback(
    async (files: FileList, speciesName?: string) => {
      setIsUploading(true);

      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          opts.onError?.(`${file.name}: PDF 파일만 업로드 가능합니다.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        if (speciesName) {
          formData.append('speciesName', speciesName);
        }

        try {
          const res = await fetch('/api/pdf/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || '업로드 실패');
          }

          const newPdf: UploadedPDF = {
            pdfId: data.pdfId,
            fileName: data.fileName,
            uploadedAt: new Date().toISOString(),
            textLength: data.extraction?.textLength,
            textPreview: data.extraction?.textPreview,
            extractionError: data.extractionError,
            analysisStatus: 'pending',
          };

          setPdfs(prev => [newPdf, ...prev]);
          opts.onUploadComplete?.(newPdf);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '업로드 실패';
          opts.onError?.(errorMessage);
        }
      }

      setIsUploading(false);
    },
    [opts]
  );

  // PDF 분석
  const analyze = useCallback(
    async (
      pdf: UploadedPDF,
      scientificName: string,
      synonyms: Synonym[],
      llmSettings: LLMSettings
    ) => {
      setAnalyzingId(pdf.pdfId);
      setPdfs(prev =>
        prev.map(p =>
          p.pdfId === pdf.pdfId
            ? { ...p, analysisStatus: 'analyzing' as const }
            : p
        )
      );

      try {
        const res = await fetch('/api/pdf/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfId: pdf.pdfId,
            scientificName,
            synonyms: synonyms.map(s => s.name),
            llmConfig: {
              provider: llmSettings.provider,
              model: llmSettings.model,
              apiKey: llmSettings.apiKey || undefined,
            },
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '분석 실패');
        }

        const updatedPdf: UploadedPDF = {
          ...pdf,
          analysisStatus: 'completed' as const,
          analysis: data.result,
        };

        setPdfs(prev =>
          prev.map(p => (p.pdfId === pdf.pdfId ? updatedPdf : p))
        );

        opts.onAnalysisComplete?.(updatedPdf);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '분석 실패';
        setPdfs(prev =>
          prev.map(p =>
            p.pdfId === pdf.pdfId
              ? { ...p, analysisStatus: 'error' as const, analysisError: errorMessage }
              : p
          )
        );
        opts.onError?.(errorMessage);
      }

      setAnalyzingId(undefined);
    },
    [opts]
  );

  // 전체 분석
  const analyzeAll = useCallback(
    async (
      scientificName: string,
      synonyms: Synonym[],
      llmSettings: LLMSettings
    ) => {
      const pendingPdfs = pdfs.filter(p => p.analysisStatus === 'pending');

      for (const pdf of pendingPdfs) {
        await analyze(pdf, scientificName, synonyms, llmSettings);
      }
    },
    [pdfs, analyze]
  );

  // 초기화
  const reset = useCallback(() => {
    setPdfs([]);
    setAnalyzingId(undefined);
  }, []);

  return {
    pdfs,
    isUploading,
    analyzingId,
    upload,
    analyze,
    analyzeAll,
    reset,
  };
}
