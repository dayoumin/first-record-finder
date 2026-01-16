'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Search, BookOpen } from 'lucide-react';

// 컴포넌트
import { SpeciesInput, SpeciesList, SpeciesSelect } from '@/components/species';
import {
  CollectionOptionsPanel,
  CollectionProgress,
  LiteratureList,
  PdfUploader,
} from '@/components/literature';
import { LlmSettings, SearchOptionsPanel } from '@/components/settings';
import { EmptyState, WorkflowSteps, RateLimitBanner } from '@/components/common';
import { toast } from '@/components/global';

// 타입
import type {
  BatchItem,
  UploadedPDF,
  CollectedLiterature,
  LiteratureCollectionProgress,
  SearchOptions,
  CollectionOptions,
  LLMSettings,
  RateLimitStatus,
} from '@/types/species';
import type { WorkflowStep } from '@/types/ui';

// 상수
import {
  DEFAULT_SEARCH_OPTIONS,
  DEFAULT_COLLECTION_OPTIONS,
  DEFAULT_LLM_SETTINGS,
} from '@/lib/constants';

// 현재 단계 판정 함수
function getCurrentStep(
  items: BatchItem[],
  searchStatus: 'idle' | 'running' | 'completed',
  uploadedPDFs: UploadedPDF[] = [],
  collectedLiterature: CollectedLiterature[] = []
): WorkflowStep {
  if (items.length === 0) return 'input';

  const hasCompleted = items.some(i => i.status === 'completed');

  if (searchStatus === 'running') return 'synonym';
  if (items.some(i => i.status === 'pending')) return 'input';

  if (searchStatus === 'completed' && hasCompleted) {
    const allLiterature = [...collectedLiterature, ...uploadedPDFs.map(p => ({
      analysisStatus: p.analysisStatus,
    }))];

    if (allLiterature.length === 0) return 'url';

    const hasAnalyzed = allLiterature.some(l => l.analysisStatus === 'completed');
    const isAnalyzing = allLiterature.some(l => l.analysisStatus === 'analyzing');
    const hasPending = allLiterature.some(l => l.analysisStatus === 'pending');

    if (isAnalyzing) return 'analysis';
    if (hasPending && !hasAnalyzed) return 'collection';
    if (hasAnalyzed) return 'review';

    return 'collection';
  }

  return 'url';
}

export default function Home() {
  // 학명 관련 상태
  const [items, setItems] = useState<BatchItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [manualInput, setManualInput] = useState('');
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);

  // LLM 설정
  const [llmSettings, setLlmSettings] = useState<LLMSettings>(DEFAULT_LLM_SETTINGS);

  // PDF 관련 상태
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([]);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<'idle' | 'uploading'>('idle');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');

  // 문헌 자동 수집 상태
  const [collectedLiterature, setCollectedLiterature] = useState<CollectedLiterature[]>([]);
  const [collectionProgress, setCollectionProgress] = useState<LiteratureCollectionProgress>({
    phase: 'idle',
    searched: 0,
    downloaded: 0,
    analyzed: 0,
    total: 0,
    errors: [],
  });
  const [collectionOptions, setCollectionOptions] = useState<CollectionOptions>(
    DEFAULT_COLLECTION_OPTIONS
  );

  // Rate Limit 상태
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);

  // 분석 중인 아이템 ID
  const [analyzingId, setAnalyzingId] = useState<string | undefined>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const completed = items.filter(i => i.status === 'completed').length;
  const hasItems = items.length > 0;

  // 현재 워크플로우 단계
  const currentStep = getCurrentStep(items, status, uploadedPDFs, collectedLiterature);

  // Rate Limit 상태 가져오기
  const fetchRateLimitStatus = useCallback(async () => {
    if (llmSettings.provider !== 'openrouter' || !llmSettings.model.endsWith(':free')) {
      setRateLimitStatus(null);
      setShowRateLimitWarning(false);
      return;
    }

    try {
      const res = await fetch('/api/llm/usage');
      const data = await res.json();
      if (data.success) {
        setRateLimitStatus(data);
        if (data.isWarning) {
          setShowRateLimitWarning(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rate limit status:', error);
    }
  }, [llmSettings.provider, llmSettings.model]);

  useEffect(() => {
    fetchRateLimitStatus();
  }, [fetchRateLimitStatus]);

  // 파일 업로드 핸들러
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setItems(data.names.map((name: string, i: number) => ({
        id: `${i}-${Date.now()}`,
        inputName: name,
        status: 'pending' as const,
      })));
      setStatus('idle');
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 실패');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 수동 입력 추가
  const handleAdd = () => {
    const names = manualInput.split('\n').map(n => n.trim()).filter(Boolean);
    if (!names.length) return;

    setItems(prev => [
      ...prev,
      ...names.map((name, i) => ({
        id: `m-${i}-${Date.now()}`,
        inputName: name,
        status: 'pending' as const,
      }))
    ]);
    setManualInput('');
  };

  // 검색 실행
  const runSearch = useCallback(async () => {
    if (!items.length) return;
    abortRef.current = new AbortController();
    setStatus('running');

    for (const item of items.filter(i => i.status === 'pending')) {
      if (abortRef.current.signal.aborted) break;

      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'processing' as const } : i
      ));

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
            }
          }),
        });
        const data = await res.json();

        setItems(prev => prev.map(i =>
          i.id === item.id ? {
            ...i,
            status: data.success ? 'completed' : 'error',
            acceptedName: data.acceptedName,
            aphiaId: data.aphiaId,
            synonymCount: data.synonyms?.length,
            synonyms: data.synonyms,
            searchUrls: data.searchUrls,
            error: data.error,
          } : i
        ));
      } catch {
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', error: '네트워크 오류' } : i
        ));
      }

      await new Promise(r => setTimeout(r, 500));
    }
    setStatus('completed');
  }, [items, options]);

  // 엑셀 다운로드
  const download = async () => {
    const data = items.filter(i => i.status === 'completed');
    if (!data.length) return;

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `first_record_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('다운로드 실패');
    }
  };

  // 초기화
  const reset = () => {
    abortRef.current?.abort();
    setItems([]);
    setStatus('idle');
    setCollectedLiterature([]);
    setUploadedPDFs([]);
    setSelectedSpecies('');
    setCollectionProgress({
      phase: 'idle',
      searched: 0,
      downloaded: 0,
      analyzed: 0,
      total: 0,
      errors: [],
    });
  };

  // PDF 업로드
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPdfUploadStatus('uploading');

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert(`${file.name}: PDF 파일만 업로드 가능합니다.`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (selectedSpecies) {
        formData.append('speciesName', selectedSpecies);
      }

      try {
        const res = await fetch('/api/pdf/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '업로드 실패');
        }

        const newPdf: UploadedPDF = {
          pdfId: data.pdfId,
          fileName: data.fileName,
          uploadedAt: new Date().toISOString(),
          textLength: data.extraction?.textLength,
          textPreview: data.extraction?.textPreview,
          extractionError: data.extractionError,
          analysisStatus: 'pending',
        };

        setUploadedPDFs(prev => [newPdf, ...prev]);
      } catch (err) {
        alert(err instanceof Error ? err.message : '업로드 실패');
      }
    }

    setPdfUploadStatus('idle');
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  // 문헌 자동 수집
  const collectLiterature = async () => {
    if (!selectedSpecies) {
      alert('수집할 학명을 선택하세요.');
      return;
    }

    if (collectionOptions.sources.length === 0) {
      alert('검색 소스를 하나 이상 선택하세요.');
      return;
    }

    const selectedItem = items.find(i =>
      i.acceptedName === selectedSpecies || i.inputName === selectedSpecies
    );
    const synonyms = selectedItem?.synonyms?.map(s => s.name) || [];

    setCollectionProgress({
      phase: 'searching',
      searched: 0,
      downloaded: 0,
      analyzed: 0,
      total: 0,
      errors: [],
    });

    try {
      const res = await fetch('/api/literature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scientificName: selectedSpecies,
          synonyms,
          sources: collectionOptions.sources,
          maxResults: collectionOptions.maxResults,
          yearFrom: collectionOptions.yearFrom || undefined,
          yearTo: collectionOptions.yearTo || undefined,
          searchStrategy: collectionOptions.searchStrategy,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '수집 실패');
      }

      const collected: CollectedLiterature[] = data.items.map((item: CollectedLiterature) => ({
        ...item,
        analysisStatus: 'pending' as const,
      }));

      setCollectedLiterature(collected);
      setCollectionProgress({
        phase: 'completed',
        searched: data.totalFound,
        downloaded: data.downloadedCount,
        analyzed: 0,
        total: data.totalFound,
        errors: data.errors?.map((e: { source: string; error: string }) => `${e.source}: ${e.error}`) || [],
      });
    } catch (err) {
      setCollectionProgress(prev => ({
        ...prev,
        phase: 'completed',
        errors: [...prev.errors, err instanceof Error ? err.message : '수집 실패'],
      }));
    }
  };

  // 수집된 문헌 분석
  const analyzeCollectedLiterature = async (item: CollectedLiterature) => {
    if (!item.pdfDownloaded || !item.pdfPath) {
      alert('PDF가 다운로드되지 않은 문헌입니다.');
      return;
    }

    setAnalyzingId(item.id);
    setCollectedLiterature(prev => prev.map(l =>
      l.id === item.id ? { ...l, analysisStatus: 'analyzing' as const } : l
    ));

    try {
      const selectedItem = items.find(i =>
        i.acceptedName === selectedSpecies || i.inputName === selectedSpecies
      );
      const synonyms = selectedItem?.synonyms?.map(s => s.name) || [];

      const res = await fetch('/api/pdf/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfPath: item.pdfPath,
          scientificName: selectedSpecies,
          synonyms,
          llmConfig: {
            provider: llmSettings.provider,
            model: llmSettings.model,
            apiKey: llmSettings.apiKey || undefined,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '분석 실패');
      }

      setCollectedLiterature(prev => prev.map(l =>
        l.id === item.id ? {
          ...l,
          analysisStatus: 'completed' as const,
          analysis: data.result,
        } : l
      ));
    } catch (err) {
      setCollectedLiterature(prev => prev.map(l =>
        l.id === item.id ? {
          ...l,
          analysisStatus: 'error' as const,
          analysisError: err instanceof Error ? err.message : '분석 실패',
        } : l
      ));
    }

    setAnalyzingId(undefined);
    fetchRateLimitStatus();
  };

  // 수집된 문헌 전체 분석
  const analyzeAllCollected = async () => {
    const downloadedItems = collectedLiterature.filter(
      l => l.pdfDownloaded && l.analysisStatus === 'pending'
    );

    for (const item of downloadedItems) {
      await analyzeCollectedLiterature(item);
    }
  };

  // PDF 분석 실행
  const analyzePdf = async (pdf: UploadedPDF) => {
    if (!selectedSpecies) {
      alert('분석할 학명을 선택하세요.');
      return;
    }

    setAnalyzingId(pdf.pdfId);
    setUploadedPDFs(prev => prev.map(p =>
      p.pdfId === pdf.pdfId ? { ...p, analysisStatus: 'analyzing' as const } : p
    ));

    try {
      const selectedItem = items.find(i =>
        i.acceptedName === selectedSpecies || i.inputName === selectedSpecies
      );
      const synonyms = selectedItem?.synonyms?.map(s => s.name) || [];

      const res = await fetch('/api/pdf/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfId: pdf.pdfId,
          scientificName: selectedSpecies,
          synonyms,
          llmConfig: {
            provider: llmSettings.provider,
            model: llmSettings.model,
            apiKey: llmSettings.apiKey || undefined,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '분석 실패');
      }

      setUploadedPDFs(prev => prev.map(p =>
        p.pdfId === pdf.pdfId ? {
          ...p,
          analysisStatus: 'completed' as const,
          analysis: data.result,
        } : p
      ));
    } catch (err) {
      setUploadedPDFs(prev => prev.map(p =>
        p.pdfId === pdf.pdfId ? {
          ...p,
          analysisStatus: 'error' as const,
          analysisError: err instanceof Error ? err.message : '분석 실패',
        } : p
      ));
    }

    setAnalyzingId(undefined);
    fetchRateLimitStatus();
  };

  // 전체 PDF 일괄 분석
  const analyzeAllPdfs = async () => {
    if (!selectedSpecies) {
      alert('분석할 학명을 선택하세요.');
      return;
    }

    const pendingPdfs = uploadedPDFs.filter(p => p.analysisStatus === 'pending');
    for (const pdf of pendingPdfs) {
      await analyzePdf(pdf);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Rate Limit 경고 배너 */}
      {showRateLimitWarning && rateLimitStatus && (
        <RateLimitBanner
          status={rateLimitStatus}
          onDismiss={() => setShowRateLimitWarning(false)}
        />
      )}

      {/* 워크플로우 단계 표시기 */}
      <div className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <WorkflowSteps currentStep={currentStep} />
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-6xl mx-auto w-full px-6 py-6 space-y-6 flex-1">
        {/* 1. 입력 영역 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5" />
              학명 입력
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpeciesInput
              manualInput={manualInput}
              onManualInputChange={setManualInput}
              onFileUpload={handleUpload}
              onAdd={handleAdd}
              disabled={status === 'running'}
            />

            {/* 검색 옵션 */}
            <SearchOptionsPanel
              options={options}
              onChange={setOptions}
            />

            {/* LLM 설정 */}
            <LlmSettings
              settings={llmSettings}
              onChange={setLlmSettings}
            />
          </CardContent>
        </Card>

        {/* 2. 학명 목록 및 진행 상황 */}
        {hasItems && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-5 w-5" />
                학명 검색
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SpeciesList
                items={items}
                status={status}
                onStart={runSearch}
                onStop={() => {
                  abortRef.current?.abort();
                  setStatus('idle');
                }}
                onDownload={download}
                onReset={reset}
              />
            </CardContent>
          </Card>
        )}

        {/* 3. 빈 상태 */}
        {!hasItems && (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={FileSpreadsheet}
                title="학명을 입력하세요"
                description="엑셀 파일을 업로드하거나 학명을 직접 입력하세요. 첫 번째 열에 학명이 포함된 .xlsx, .csv 파일을 지원합니다."
              />
            </CardContent>
          </Card>
        )}

        {/* 4. 문헌 수집 및 분석 (검색 완료 후) */}
        {status === 'completed' && completed > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                문헌 수집 및 분석
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 분석 대상 학명 선택 */}
              <SpeciesSelect
                items={items}
                value={selectedSpecies}
                onChange={setSelectedSpecies}
              />

              {/* 수집 옵션 */}
              <CollectionOptionsPanel
                options={collectionOptions}
                onChange={setCollectionOptions}
              />

              {/* 자동 수집 버튼 */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <Button
                  onClick={collectLiterature}
                  disabled={
                    !selectedSpecies ||
                    collectionOptions.sources.length === 0 ||
                    collectionProgress.phase === 'searching' ||
                    collectionProgress.phase === 'downloading'
                  }
                >
                  {collectionProgress.phase === 'searching' && '검색 중...'}
                  {collectionProgress.phase === 'downloading' && '다운로드 중...'}
                  {(collectionProgress.phase === 'idle' ||
                    collectionProgress.phase === 'completed' ||
                    collectionProgress.phase === 'analyzing') &&
                    '문헌 자동 수집'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {collectionOptions.sources.join(', ').toUpperCase() || '소스 선택 필요'}에서{' '}
                  {selectedSpecies || '선택된 학명'}의 문헌을 검색합니다
                </p>
              </div>

              {/* 수집 진행 상황 */}
              <CollectionProgress progress={collectionProgress} />

              {/* 수집된 문헌 목록 */}
              {collectedLiterature.length > 0 && (
                <LiteratureList
                  items={collectedLiterature}
                  onAnalyze={analyzeCollectedLiterature}
                  onAnalyzeAll={analyzeAllCollected}
                  analyzingId={analyzingId}
                />
              )}

              {/* 수동 PDF 업로드 */}
              <PdfUploader
                pdfs={uploadedPDFs}
                onUpload={handlePdfUpload}
                onAnalyze={analyzePdf}
                onAnalyzeAll={analyzeAllPdfs}
                isUploading={pdfUploadStatus === 'uploading'}
                selectedSpecies={selectedSpecies}
                analyzingId={analyzingId}
              />

              {/* 빈 상태 (수집 전) */}
              {collectedLiterature.length === 0 &&
                uploadedPDFs.length === 0 &&
                collectionProgress.phase === 'idle' && (
                  <EmptyState
                    icon={BookOpen}
                    title="문헌을 수집하세요"
                    description={
                      selectedSpecies
                        ? `"${selectedSpecies}" 관련 문헌을 BHL, Semantic Scholar에서 검색합니다.`
                        : '먼저 분석할 학명을 선택하세요.'
                    }
                  />
                )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
