'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface SearchHistoryItem {
  scientificName: string;
  acceptedName?: string;
  timestamp: number;
}

const MAX_HISTORY_SIZE = 20;
const STORAGE_KEY = 'first-record-finder:search-history';

interface UseSearchHistoryReturn {
  history: SearchHistoryItem[];
  addToHistory: (scientificName: string, acceptedName?: string) => void;
  removeFromHistory: (scientificName: string) => void;
  clearHistory: () => void;
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [history, setHistory, clearHistory] = useLocalStorage<SearchHistoryItem[]>(
    STORAGE_KEY,
    []
  );

  const addToHistory = useCallback(
    (scientificName: string, acceptedName?: string) => {
      setHistory(prev => {
        // 중복 제거
        const filtered = prev.filter(
          item => item.scientificName !== scientificName
        );

        // 새 항목 추가 (앞쪽에)
        const newItem: SearchHistoryItem = {
          scientificName,
          acceptedName,
          timestamp: Date.now(),
        };

        // 최대 개수 제한
        const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_SIZE);

        return updated;
      });
    },
    [setHistory]
  );

  const removeFromHistory = useCallback(
    (scientificName: string) => {
      setHistory(prev =>
        prev.filter(item => item.scientificName !== scientificName)
      );
    },
    [setHistory]
  );

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}
