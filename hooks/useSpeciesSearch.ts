'use client';

import { useState, useRef, useCallback } from 'react';
import type { BatchItem, SearchOptions } from '@/types/species';

interface UseSpeciesSearchOptions {
  onProgress?: (item: BatchItem) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseSpeciesSearchReturn {
  items: BatchItem[];
  status: 'idle' | 'running' | 'completed';
  addItems: (names: string[]) => void;
  setItems: React.Dispatch<React.SetStateAction<BatchItem[]>>;
  runSearch: (options: SearchOptions) => Promise<void>;
  stopSearch: () => void;
  reset: () => void;
  download: () => Promise<void>;
}

export function useSpeciesSearch(
  opts: UseSpeciesSearchOptions = {}
): UseSpeciesSearchReturn {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const abortRef = useRef<AbortController | null>(null);

  const addItems = useCallback((names: string[]) => {
    const newItems: BatchItem[] = names.map((name, i) => ({
      id: `${Date.now()}-${i}`,
      inputName: name,
      status: 'pending' as const,
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const runSearch = useCallback(async (options: SearchOptions) => {
    const pendingItems = items.filter(i => i.status === 'pending');
    if (!pendingItems.length) return;

    abortRef.current = new AbortController();
    setStatus('running');

    for (const item of pendingItems) {
      if (abortRef.current.signal.aborted) break;

      // 처리 중 상태로 업데이트
      setItems(prev =>
        prev.map(i =>
          i.id === item.id ? { ...i, status: 'processing' as const } : i
        )
      );

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scientificName: item.inputName,
            options: {
              customKeywords: options.customKeywords || undefined,
              yearFrom: options.yearFrom || undefined,
              yearTo: options.yearTo || undefined,
              includeKoreaKeywords: options.includeKoreaKeywords,
            },
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();

        const updatedItem: BatchItem = {
          ...item,
          status: data.success ? 'completed' : 'error',
          acceptedName: data.acceptedName,
          aphiaId: data.aphiaId,
          synonymCount: data.synonyms?.length,
          synonyms: data.synonyms,
          searchUrls: data.searchUrls,
          error: data.error,
        };

        setItems(prev =>
          prev.map(i => (i.id === item.id ? updatedItem : i))
        );

        opts.onProgress?.(updatedItem);
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;

        const errorMessage = err instanceof Error ? err.message : '네트워크 오류';
        setItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'error' as const, error: errorMessage }
              : i
          )
        );
        opts.onError?.(errorMessage);
      }

      // API 호출 간격
      await new Promise(r => setTimeout(r, 500));
    }

    setStatus('completed');
    opts.onComplete?.();
  }, [items, opts]);

  const stopSearch = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setStatus('idle');
  }, []);

  const download = useCallback(async () => {
    const completedItems = items.filter(i => i.status === 'completed');
    if (!completedItems.length) return;

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: completedItems }),
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `first_record_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      opts.onError?.('다운로드 실패');
    }
  }, [items, opts]);

  return {
    items,
    status,
    addItems,
    setItems,
    runSearch,
    stopSearch,
    reset,
    download,
  };
}
