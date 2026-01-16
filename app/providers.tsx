'use client';

import { ThemeProvider, Toaster, CommandPalette } from '@/components/global';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="system">
      {children}
      <CommandPalette />
      <Toaster />
    </ThemeProvider>
  );
}
