import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header, Sidebar } from '@/components/layout';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Marine Science Platform - 수산과학 통합 플랫폼',
  description: '수산과학 연구자를 위한 통합 플랫폼: 최초기록 검색, 학명 검증, 문헌정보, 통계분석',
  keywords: ['해양생물', '최초기록', '학명', 'WoRMS', '문헌검색', '통계분석', '수산과학'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            {/* 상단 헤더 - 전체 너비 */}
            <Header />

            <div className="flex flex-1">
              {/* 좌측 사이드바 - 데스크톱에서만 표시 */}
              <Sidebar />

              {/* 메인 콘텐츠 */}
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
