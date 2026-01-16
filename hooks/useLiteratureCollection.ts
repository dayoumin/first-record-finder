'use client';

import { useState, useCallback } from 'react';
import type {
  CollectedLiterature,
  LiteratureCollectionProgress,
  CollectionOptions,
  LLMSettings,
  Synonym,
} from '@/types/species';
import { DEFAULT_COLLECTION_OPTIONS } from '@/lib/constants';

interface UseLiteratureCollectionOptions {
  onCollectionComplete?: (items: CollectedLiterature[]) => void;
  onAnalysisComplete?: (item: CollectedLiterature) => void;
  onError?: (error: string) => void;
}

interface UseLiteratureCollectionReturn {
  // 상태
  items: CollectedLiterature[];
  progress: LiteratureCollectionProgress;
  options: CollectionOptions;
  analyzingId: string | undefined;

  // 설정
  setOptions: (options: CollectionOptions) => void;

  // 수집
  collect: (
    scientificName: string,
    synonyms: Synonym[]
  ) => Promise<void>;

  // 분석
  analyzeItem: (
    item: CollectedLiterature,
    scientificName: string,
    synonyms: Synonym[],
    llmSettings: LLMSettings
  ) => Promise<void>;
  analyzeAll: (
    scientificName: string,
    synonyms: Synonym[],
    llmSettings: LLMSettings
  ) => Promise<void>;

  // 초기화
  reset: () => void;
}

const initialProgress: LiteratureCollectionProgress = {
  phase: 'idle',
  searched: 0,
  downloaded: 0,
  analyzed: 0,
  total: 0,
  errors: [],
};

export function useLiteratureCollection(
  opts: UseLiteratureCollectionOptions = {}
): UseLiteratureCollectionReturn {
  const [items, setItems] = useState<CollectedLiterature[]>([]);
  const [progress, setProgress] = useState<LiteratureCollectionProgress>(initialProgress);
  const [options, setOptions] = useState<CollectionOptions>(DEFAULT_COLLECTION_OPTIONS);
  const [analyzingId, setAnalyzingId] = useState<string | undefined>();

  // 문헌 수집
  const collect = useCallback(
    async (scientificName: string, synonyms: Synonym[]) => {
      if (options.sources.length === 0) {
        opts.onError?.('검색 소스를 하나 이상 선택하세요.');
        return;
      }

      setProgress({
        phase: 'searching',
        searched: 0,
        downloaded: 0,
        analyzed: 0,
        total: 0,
        errors: [],
      });

      try {
        const res = await fetch('/api/literature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scientificName,
            synonyms: synonyms.map(s => s.name),
            sources: options.sources,
            maxResults: options.maxResults,
            yearFrom: options.yearFrom || undefined,
            yearTo: options.yearTo || undefined,
            searchStrategy: options.searchStrategy,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '수집 실패');
        }

        const collected: CollectedLiterature[] = data.items.map(
          (item: CollectedLiterature) => ({
            ...item,
            analysisStatus: 'pending' as const,
          })
        );

        setItems(collected);
        setProgress({
          phase: 'completed',
          searched: data.totalFound,
          downloaded: data.downloadedCount,
          analyzed: 0,
          total: data.totalFound,
          errors:
            data.errors?.map(
              (e: { source: string; error: string }) => `${e.source}: ${e.error}`
            ) || [],
        });

        opts.onCollectionComplete?.(collected);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '수집 실패';
        setProgress(prev => ({
          ...prev,
          phase: 'completed',
          errors: [...prev.errors, errorMessage],
        }));
        opts.onError?.(errorMessage);
      }
    },
    [options, opts]
  );

  // 개별 문헌 분석
  const analyzeItem = useCallback(
    async (
      item: CollectedLiterature,
      scientificName: string,
      synonyms: Synonym[],
      llmSettings: LLMSettings
    ) => {
      if (!item.pdfDownloaded || !item.pdfPath) {
        opts.onError?.('PDF가 다운로드되지 않은 문헌입니다.');
        return;
      }

      setAnalyzingId(item.id);
      setItems(prev =>
        prev.map(l =>
          l.id === item.id ? { ...l, analysisStatus: 'analyzing' as const } : l
        )
      );

      try {
        const res = await fetch('/api/pdf/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfPath: item.pdfPath,
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

        const updatedItem: CollectedLiterature = {
          ...item,
          analysisStatus: 'completed' as const,
          analysis: data.result,
        };

        setItems(prev =>
          prev.map(l => (l.id === item.id ? updatedItem : l))
        );

        setProgress(prev => ({
          ...prev,
          analyzed: prev.analyzed + 1,
        }));

        opts.onAnalysisComplete?.(updatedItem);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '분석 실패';
        setItems(prev =>
          prev.map(l =>
            l.id === item.id
              ? { ...l, analysisStatus: 'error' as const, analysisError: errorMessage }
              : l
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
      const pendingItems = items.filter(
        l => l.pdfDownloaded && l.analysisStatus === 'pending'
      );

      for (const item of pendingItems) {
        await analyzeItem(item, scientificName, synonyms, llmSettings);
      }
    },
    [items, analyzeItem]
  );

  // 초기화
  const reset = useCallback(() => {
    setItems([]);
    setProgress(initialProgress);
    setAnalyzingId(undefined);
  }, []);

  return {
    items,
    progress,
    options,
    analyzingId,
    setOptions,
    collect,
    analyzeItem,
    analyzeAll,
    reset,
  };
}
