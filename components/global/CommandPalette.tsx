'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Fish,
  Search,
  LayoutDashboard,
  Settings,
  Moon,
  Sun,
  History,
  FileText,
  Trash2,
} from 'lucide-react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useThemeContext } from './ThemeProvider';

interface CommandPaletteProps {
  onSearchSelect?: (scientificName: string) => void;
}

export function CommandPalette({ onSearchSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { history, removeFromHistory, clearHistory } = useSearchHistory();
  const { resolvedTheme, setTheme } = useThemeContext();

  // 키보드 단축키 (⌘K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);

      switch (value) {
        case 'home':
          router.push('/');
          break;
        case 'dashboard':
          router.push('/dashboard');
          break;
        case 'toggle-theme':
          setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
          break;
        case 'clear-history':
          clearHistory();
          break;
        default:
          // 검색 히스토리에서 선택
          if (value.startsWith('history:')) {
            const scientificName = value.replace('history:', '');
            onSearchSelect?.(scientificName);
          }
      }
    },
    [router, resolvedTheme, setTheme, clearHistory, onSearchSelect]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="검색하거나 명령 입력..." />
      <CommandList>
        <CommandEmpty>결과가 없습니다.</CommandEmpty>

        {/* 검색 히스토리 */}
        {history.length > 0 && (
          <>
            <CommandGroup heading="최근 검색">
              {history.slice(0, 5).map(item => (
                <CommandItem
                  key={item.scientificName}
                  value={`history:${item.scientificName}`}
                  onSelect={handleSelect}
                >
                  <History className="mr-2 h-4 w-4" />
                  <span className="flex-1 italic">{item.scientificName}</span>
                  {item.acceptedName && item.acceptedName !== item.scientificName && (
                    <span className="text-xs text-muted-foreground">
                      → {item.acceptedName}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.scientificName);
                    }}
                    className="ml-2 p-1 hover:bg-muted rounded"
                    aria-label="삭제"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </CommandItem>
              ))}
              <CommandItem value="clear-history" onSelect={handleSelect}>
                <Trash2 className="mr-2 h-4 w-4" />
                히스토리 삭제
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* 페이지 */}
        <CommandGroup heading="페이지">
          <CommandItem value="home" onSelect={handleSelect}>
            <Fish className="mr-2 h-4 w-4" />
            홈
          </CommandItem>
          <CommandItem value="dashboard" onSelect={handleSelect}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            대시보드
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 설정 */}
        <CommandGroup heading="설정">
          <CommandItem value="toggle-theme" onSelect={handleSelect}>
            {resolvedTheme === 'light' ? (
              <Moon className="mr-2 h-4 w-4" />
            ) : (
              <Sun className="mr-2 h-4 w-4" />
            )}
            {resolvedTheme === 'light' ? '다크 모드' : '라이트 모드'}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 도움말 */}
        <CommandGroup heading="도움말">
          <CommandItem disabled>
            <Search className="mr-2 h-4 w-4" />
            <span className="flex-1">빠른 검색</span>
            <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
