'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, FlaskConical, ScrollText, BarChart3 } from 'lucide-react';
import { PapersTab } from './PapersTab';
import { PatentsTab } from './PatentsTab';
import { ReportsTab } from './ReportsTab';
import { LiteratureItem, PatentItem, ReportItem } from '@/src/literature/types';

interface SpeciesDetailTabsProps {
  papers: LiteratureItem[];
  patents: PatentItem[];
  reports: ReportItem[];
  papersLoading?: boolean;
  patentsLoading?: boolean;
  reportsLoading?: boolean;
  onLoadMorePapers?: () => void;
  onLoadMorePatents?: () => void;
  onLoadMoreReports?: () => void;
  hasMorePapers?: boolean;
  hasMorePatents?: boolean;
  hasMoreReports?: boolean;
}

export function SpeciesDetailTabs({
  papers,
  patents,
  reports,
  papersLoading = false,
  patentsLoading = false,
  reportsLoading = false,
  onLoadMorePapers,
  onLoadMorePatents,
  onLoadMoreReports,
  hasMorePapers = false,
  hasMorePatents = false,
  hasMoreReports = false,
}: SpeciesDetailTabsProps) {
  const [activeTab, setActiveTab] = useState('papers');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="papers" className="gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">논문</span>
          <span className="text-muted-foreground text-xs">({papers.length})</span>
        </TabsTrigger>
        <TabsTrigger value="patents" className="gap-2">
          <FlaskConical className="h-4 w-4" />
          <span className="hidden sm:inline">특허</span>
          <span className="text-muted-foreground text-xs">({patents.length})</span>
        </TabsTrigger>
        <TabsTrigger value="reports" className="gap-2">
          <ScrollText className="h-4 w-4" />
          <span className="hidden sm:inline">보고서</span>
          <span className="text-muted-foreground text-xs">({reports.length})</span>
        </TabsTrigger>
      </TabsList>

      <div className="mt-4">
        <TabsContent value="papers" className="m-0">
          <PapersTab
            papers={papers}
            loading={papersLoading}
            onLoadMore={onLoadMorePapers}
            hasMore={hasMorePapers}
          />
        </TabsContent>

        <TabsContent value="patents" className="m-0">
          <PatentsTab
            patents={patents}
            loading={patentsLoading}
            onLoadMore={onLoadMorePatents}
            hasMore={hasMorePatents}
          />
        </TabsContent>

        <TabsContent value="reports" className="m-0">
          <ReportsTab
            reports={reports}
            loading={reportsLoading}
            onLoadMore={onLoadMoreReports}
            hasMore={hasMoreReports}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
