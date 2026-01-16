'use client';

import { ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            한국 수산생물 최초기록 문헌 검색 시스템
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.marinespecies.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              WoRMS
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://www.biodiversitylibrary.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              BHL
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://scienceon.kisti.re.kr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              ScienceON
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
