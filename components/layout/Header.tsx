'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Fish, Moon, Sun, Search } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileNav } from './MobileNav';

export function Header() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      <div className="px-4">
        <div className="flex h-14 items-center justify-between">
          {/* 모바일 메뉴 */}
          <MobileNav />

          {/* 로고 */}
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
            aria-label="Marine Science Platform 홈으로 이동"
          >
            <Fish className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">Marine Science Platform</span>
            <span className="sm:hidden">MSP</span>
          </Link>

          {/* 검색 버튼 (Cmd+K 트리거) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                // 커맨드 팔레트 열기 (향후 구현)
                const event = new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
              aria-label="검색 (Cmd+K)"
            >
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>검색...</span>
              <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>

          {/* 오른쪽 액션 영역 */}
          <div className="flex items-center gap-2">
            {/* 다크모드 토글 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
              className="transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {resolvedTheme === 'light' ? (
                <Moon className="h-4 w-4 transition-transform duration-200 hover:rotate-12" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4 transition-transform duration-200 hover:rotate-45" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
