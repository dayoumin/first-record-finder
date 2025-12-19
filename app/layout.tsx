import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '한국 수산생물 최초기록 검색',
  description: 'WoRMS 이명 기반 한국 최초 서식 기록 문헌 검색 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
