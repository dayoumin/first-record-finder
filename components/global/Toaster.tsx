'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useThemeContext } from './ThemeProvider';

export function Toaster() {
  const { resolvedTheme } = useThemeContext();

  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group toast',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
    />
  );
}

// 토스트 유틸리티 함수들 (sonner에서 직접 import해서 사용)
export { toast } from 'sonner';
