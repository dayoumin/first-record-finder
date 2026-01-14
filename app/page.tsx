'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Synonym {
  name: string;
  author: string;
  year: number | null;
  status: string;
  aphiaId: number;
}

interface BatchItem {
  id: string;
  inputName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  // 데이터
  acceptedName?: string;
  aphiaId?: number;
  synonymCount?: number;
  synonyms?: Synonym[];
  searchUrls?: Array<{ name: string; scholar: string; kci: string }>;
  error?: string;
}

// OCR 품질 등급
type OCRQuality = 'good' | 'fair' | 'poor' | 'manual_needed';

interface OCRQualityInfo {
  quality: OCRQuality;
  score: number;
  issues: string[];
  recommendation: string;
}

// PDF 업로드 및 분석 결과
interface UploadedPDF {
  pdfId: string;
  fileName: string;
  uploadedAt: string;
  textLength?: number;
  textPreview?: string;
  extractionError?: string;
  // OCR 품질 정보
  ocrQuality?: OCRQualityInfo;
  // 분석 결과
  analysis?: AnalysisResult;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisError?: string;
}

// 자동 수집된 문헌 아이템
interface CollectedLiterature {
  id: string;
  source: 'bhl' | 'semantic' | 'jstage' | 'cinii' | 'manual';
  title: string;
  authors: string[];
  year: number | null;
  journal?: string;
  url: string;
  pdfUrl?: string;
  searchedName: string;
  snippet?: string;
  relevanceScore?: number;
  pdfDownloaded: boolean;
  pdfPath?: string;
  // OCR 품질 정보
  ocrQuality?: OCRQualityInfo;
  // 분석 결과
  analysis?: AnalysisResult;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisError?: string;
}

// 문헌 수집 진행 상황
interface CollectionProgress {
  phase: 'idle' | 'searching' | 'downloading' | 'analyzing' | 'completed';
  currentSource?: string;
  currentItem?: string;
  searched: number;
  downloaded: number;
  analyzed: number;
  total: number;
  errors: string[];
}

interface AnalysisResult {
  hasKoreaRecord: boolean | null;
  confidence: number;
  locality?: string;
  collectionDate?: string;
  specimenInfo?: string;
  relevantQuotes?: string[];
  reasoning?: string;
}

interface SearchOptions {
  customKeywords: string;
  yearFrom: number | '';
  yearTo: number | '';
  includeKoreaKeywords: boolean;
}

// 문헌 수집 옵션
interface CollectionOptions {
  sources: ('bhl' | 'semantic')[];
  searchStrategy: 'historical' | 'korea' | 'both';
  yearFrom: number | '';
  yearTo: number | '';
  maxResults: number;
}

// LLM 제공자 타입
type LLMProvider = 'ollama' | 'openrouter' | 'grok' | 'openai' | 'anthropic';

interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

// Rate Limit 상태
interface RateLimitStatus {
  used: number;
  remaining: number;
  limit: number;
  isWarning: boolean;
  isExceeded: boolean;
  resetsAt: string;
  warningMessage: string | null;
}

const LLM_PROVIDERS: { value: LLMProvider; label: string; models: string[]; needsKey: boolean }[] = [
  { value: 'ollama', label: 'Ollama (로컬)', models: ['qwen3:4b', 'qwen3:8b', 'llama3.3', 'gemma3'], needsKey: false },
  { value: 'openrouter', label: 'OpenRouter', models: [
    'deepseek/deepseek-r1-0528:free',
    'xiaomi/mimo-v2-flash:free',
    'qwen/qwq-32b:free',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
  ], needsKey: true },
  { value: 'grok', label: 'Grok (xAI)', models: ['grok-4.1', 'grok-4.1-fast', 'grok-4', 'grok-3'], needsKey: true },
  { value: 'openai', label: 'OpenAI', models: ['gpt-5.2', 'gpt-5.2-pro', 'gpt-5.2-chat-latest', 'gpt-4o'], needsKey: true },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-opus-4.1'], needsKey: true },
];

// 워크플로우 단계 정의
type WorkflowStep = 'input' | 'synonyms' | 'urls' | 'collection' | 'analysis' | 'review' | 'decision' | 'export';

const STEPS: { key: WorkflowStep; label: string; shortLabel: string; description: string }[] = [
  { key: 'input', label: '1. 학명 입력', shortLabel: '입력', description: '엑셀 업로드 또는 직접 입력' },
  { key: 'synonyms', label: '2. 이명 조사', shortLabel: '이명', description: 'WoRMS에서 동의어 추출' },
  { key: 'urls', label: '3. 검색 URL', shortLabel: 'URL', description: 'Scholar/KCI 링크 생성' },
  { key: 'collection', label: '4. 문헌 수집', shortLabel: '수집', description: 'PDF 다운로드' },
  { key: 'analysis', label: '5. 문헌 분석', shortLabel: '분석', description: 'Docling + LLM 분석' },
  { key: 'review', label: '6. 문헌 검토', shortLabel: '검토', description: '사용자 확인 및 수정' },
  { key: 'decision', label: '7. 최초 기록', shortLabel: '판정', description: '연도순 정렬 → 확정' },
  { key: 'export', label: '8. 결과 정리', shortLabel: '정리', description: '최종 엑셀 다운로드' },
];

// OCR 품질 배지 렌더링
function getOCRQualityBadge(quality: OCRQuality): { label: string; color: string; bgColor: string } {
  switch (quality) {
    case 'good':
      return { label: 'OCR 양호', color: '#166534', bgColor: '#dcfce7' };
    case 'fair':
      return { label: 'OCR 보통', color: '#854d0e', bgColor: '#fef9c3' };
    case 'poor':
      return { label: 'OCR 낮음', color: '#c2410c', bgColor: '#ffedd5' };
    case 'manual_needed':
      return { label: '수동 분석 필요', color: '#991b1b', bgColor: '#fee2e2' };
    default:
      return { label: 'OCR', color: '#666', bgColor: '#f5f5f5' };
  }
}

// 현재 단계 판정 함수
function getCurrentStep(
  items: BatchItem[],
  searchStatus: 'idle' | 'running' | 'completed',
  uploadedPDFs: UploadedPDF[] = []
): WorkflowStep {
  if (items.length === 0) return 'input';

  const hasCompleted = items.some(i => i.status === 'completed');

  if (searchStatus === 'running') return 'synonyms';
  if (items.some(i => i.status === 'pending')) return 'input';
  if (searchStatus === 'completed' && hasCompleted) {
    // PDF 관련 상태 체크
    if (uploadedPDFs.length === 0) return 'urls';

    const hasAnalyzedPdf = uploadedPDFs.some(p => p.analysisStatus === 'completed');
    const isAnalyzing = uploadedPDFs.some(p => p.analysisStatus === 'analyzing');
    const hasPendingPdf = uploadedPDFs.some(p => p.analysisStatus === 'pending');

    if (isAnalyzing) return 'analysis';
    if (hasPendingPdf && !hasAnalyzedPdf) return 'collection';
    if (hasAnalyzedPdf) return 'analysis';

    return 'collection';
  }

  return 'urls';
}

export default function Home() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [manualInput, setManualInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    customKeywords: '',
    yearFrom: '',
    yearTo: '',
    includeKoreaKeywords: true,
  });
  const [llmSettings, setLlmSettings] = useState<LLMSettings>({
    provider: 'ollama',
    model: 'llama3.3',
    apiKey: '',
  });

  // PDF 관련 상태
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([]);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<'idle' | 'uploading'>('idle');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');

  // 문헌 자동 수집 상태
  const [collectedLiterature, setCollectedLiterature] = useState<CollectedLiterature[]>([]);
  const [collectionProgress, setCollectionProgress] = useState<CollectionProgress>({
    phase: 'idle',
    searched: 0,
    downloaded: 0,
    analyzed: 0,
    total: 0,
    errors: [],
  });
  const [showManualUpload, setShowManualUpload] = useState(false);

  // OpenRouter Rate Limit 상태
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);

  const [collectionOptions, setCollectionOptions] = useState<CollectionOptions>({
    sources: ['bhl', 'semantic'],  // 최초 기록 찾기에는 BHL(역사적) + Semantic(최신) 모두 필요
    searchStrategy: 'both',  // 역사적 + 한국 기록
    yearFrom: '',
    yearTo: '',
    maxResults: 30,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const completed = items.filter(i => i.status === 'completed').length;
  const errors = items.filter(i => i.status === 'error').length;
  const processing = items.find(i => i.status === 'processing');
  const hasItems = items.length > 0;
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0;

  // 현재 워크플로우 단계
  const currentStep = getCurrentStep(items, status, uploadedPDFs);
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

  // Rate Limit 상태 가져오기
  const fetchRateLimitStatus = useCallback(async () => {
    // OpenRouter 무료 모델 사용 시에만 체크
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
        // 900회 이상이면 경고 표시
        if (data.isWarning) {
          setShowRateLimitWarning(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rate limit status:', error);
    }
  }, [llmSettings.provider, llmSettings.model]);

  // 컴포넌트 마운트 및 LLM 설정 변경 시 Rate Limit 체크
  useEffect(() => {
    fetchRateLimitStatus();
  }, [fetchRateLimitStatus]);

  // 파일 업로드
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

  // 수동 입력
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

  const reset = () => {
    abortRef.current?.abort();
    setItems([]);
    setStatus('idle');
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

  // 문헌 자동 수집 실행
  const collectLiterature = async () => {
    if (!selectedSpecies) {
      alert('수집할 학명을 선택하세요.');
      return;
    }

    if (collectionOptions.sources.length === 0) {
      alert('검색 소스를 하나 이상 선택하세요.');
      return;
    }

    // 선택된 종의 이명 목록 가져오기
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

      // 수집된 문헌을 상태로 변환
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

    // 분석 상태 업데이트
    setCollectedLiterature(prev => prev.map(l =>
      l.id === item.id ? { ...l, analysisStatus: 'analyzing' as const } : l
    ));

    try {
      // 선택된 종의 이명 목록 가져오기
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

    // 분석 후 Rate Limit 상태 갱신
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

    // 분석 상태 업데이트
    setUploadedPDFs(prev => prev.map(p =>
      p.pdfId === pdf.pdfId ? { ...p, analysisStatus: 'analyzing' as const } : p
    ));

    try {
      // 선택된 종의 이명 목록 가져오기
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

    // 분석 후 Rate Limit 상태 갱신
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

  // 분석 결과 한국 기록 여부 표시
  const getKoreaRecordLabel = (result: AnalysisResult | undefined): { text: string; color: string } => {
    if (!result) return { text: '미분석', color: '#999' };
    if (result.hasKoreaRecord === true) return { text: '한국 기록 있음', color: '#22c55e' };
    if (result.hasKoreaRecord === false) return { text: '한국 기록 없음', color: '#ef4444' };
    return { text: '불확실', color: '#f59e0b' };
  };

  return (
    <div className="app">
      <header>
        <h1>First Record Finder</h1>
        <p>한국 수산생물 최초기록 문헌 검색</p>
      </header>

      {/* Rate Limit 경고 배너 */}
      {showRateLimitWarning && rateLimitStatus && (
        <div className={`rate-limit-banner ${rateLimitStatus.isExceeded ? 'exceeded' : 'warning'}`}>
          <div className="rate-limit-content">
            <span className="rate-limit-icon">
              {rateLimitStatus.isExceeded ? '⛔' : '⚠️'}
            </span>
            <span className="rate-limit-message">
              {rateLimitStatus.isExceeded
                ? `오늘의 OpenRouter 무료 사용량(${rateLimitStatus.limit}회)을 모두 소진했습니다.`
                : `OpenRouter 무료 사용량 경고: ${rateLimitStatus.used}/${rateLimitStatus.limit}회 사용 (남은 횟수: ${rateLimitStatus.remaining}회)`
              }
            </span>
            <span className="rate-limit-reset">
              리셋: {new Date(rateLimitStatus.resetsAt).toLocaleString('ko-KR', { timeZone: 'UTC' })} UTC
            </span>
          </div>
          <button
            className="rate-limit-close"
            onClick={() => setShowRateLimitWarning(false)}
            title="닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* 워크플로우 단계 표시기 */}
      <nav className="workflow-steps">
        <div className="steps-container">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isFuture = index > currentStepIndex;

            return (
              <div
                key={step.key}
                className={`step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isFuture ? 'future' : ''}`}
                title={step.description}
              >
                <div className="step-number">{index + 1}</div>
                <div className="step-label">{step.shortLabel}</div>
                {index < STEPS.length - 1 && <div className="step-connector" />}
              </div>
            );
          })}
        </div>
        <div className="current-step-info">
          <span className="step-name">{STEPS[currentStepIndex]?.label}</span>
          <span className="step-desc">{STEPS[currentStepIndex]?.description}</span>
        </div>
      </nav>

      <main>
        {/* 입력 영역 */}
        <section className="input-area">
          <div className="input-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
              id="file-input"
              hidden
            />
            <label htmlFor="file-input" className="btn">
              파일 선택
            </label>
            <span className="or">or</span>
            <textarea
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="학명 입력 (줄바꿈으로 구분)"
              rows={2}
            />
            <button onClick={handleAdd} disabled={!manualInput.trim()}>
              추가
            </button>
          </div>

          {/* 검색 옵션 */}
          <details open={showOptions} onToggle={e => setShowOptions((e.target as HTMLDetailsElement).open)}>
            <summary>검색 옵션</summary>
            <div className="options">
              <label>
                <input
                  type="checkbox"
                  checked={options.includeKoreaKeywords}
                  onChange={e => setOptions(p => ({ ...p, includeKoreaKeywords: e.target.checked }))}
                />
                한국 키워드 포함
              </label>
              <input
                type="text"
                placeholder="추가 키워드 (콤마 구분)"
                value={options.customKeywords}
                onChange={e => setOptions(p => ({ ...p, customKeywords: e.target.value }))}
              />
              <div className="year-row">
                <input
                  type="number"
                  placeholder="시작연도"
                  value={options.yearFrom}
                  onChange={e => setOptions(p => ({ ...p, yearFrom: e.target.value ? +e.target.value : '' }))}
                />
                <span>~</span>
                <input
                  type="number"
                  placeholder="종료연도"
                  value={options.yearTo}
                  onChange={e => setOptions(p => ({ ...p, yearTo: e.target.value ? +e.target.value : '' }))}
                />
              </div>
            </div>
          </details>

          {/* LLM 설정 */}
          <details>
            <summary>LLM 설정 (문헌 분석용)</summary>
            <div className="options llm-options">
              <div className="llm-row">
                <label>제공자</label>
                <select
                  value={llmSettings.provider}
                  onChange={e => {
                    const provider = e.target.value as LLMProvider;
                    const providerConfig = LLM_PROVIDERS.find(p => p.value === provider);
                    setLlmSettings({
                      provider,
                      model: providerConfig?.models[0] || '',
                      apiKey: llmSettings.apiKey,
                    });
                  }}
                >
                  {LLM_PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="llm-row">
                <label>모델</label>
                <select
                  value={llmSettings.model}
                  onChange={e => setLlmSettings(p => ({ ...p, model: e.target.value }))}
                >
                  {LLM_PROVIDERS.find(p => p.value === llmSettings.provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              {LLM_PROVIDERS.find(p => p.value === llmSettings.provider)?.needsKey && (
                <div className="llm-row">
                  <label>API Key</label>
                  <input
                    type="password"
                    placeholder="API 키 입력"
                    value={llmSettings.apiKey}
                    onChange={e => setLlmSettings(p => ({ ...p, apiKey: e.target.value }))}
                  />
                </div>
              )}
              <p className="llm-hint">
                {llmSettings.provider === 'ollama' && '로컬에서 Ollama 서버가 실행 중이어야 합니다.'}
                {llmSettings.provider === 'openrouter' && 'OpenRouter에서 API 키를 발급받으세요. 다양한 모델 사용 가능.'}
                {llmSettings.provider === 'grok' && 'xAI 콘솔에서 API 키를 발급받으세요.'}
                {llmSettings.provider === 'openai' && 'OpenAI 플랫폼에서 API 키를 발급받으세요.'}
                {llmSettings.provider === 'anthropic' && 'Anthropic 콘솔에서 API 키를 발급받으세요.'}
              </p>
            </div>
          </details>
        </section>

        {/* 컨트롤 및 진행 상황 */}
        {hasItems && (
          <section className="controls">
            <div className="progress-area">
              <div className="progress-header">
                <span className="progress-text">{progress}%</span>
                <span className="count">
                  {completed} 완료{errors > 0 && <span className="error-count"> / {errors} 오류</span>} / {items.length} 전체
                </span>
              </div>
              <div className="progress">
                <div className="bar" style={{ width: `${progress}%` }} />
              </div>
              {processing && (
                <div className="current-item">
                  처리 중: <em>{processing.inputName}</em>
                </div>
              )}
            </div>

            <div className="btn-group">
              {status === 'idle' && (
                <button className="primary" onClick={runSearch}>검색 시작</button>
              )}
              {status === 'running' && (
                <button onClick={() => { abortRef.current?.abort(); setStatus('idle'); }}>중지</button>
              )}
              {status === 'completed' && (
                <button className="primary" onClick={download}>다운로드</button>
              )}
              <button onClick={reset}>초기화</button>
            </div>
          </section>
        )}

        {/* 결과 목록 */}
        {hasItems && (
          <section className="results">
            {items.map(item => (
              <div
                key={item.id}
                className={`item ${item.status}`}
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className="item-head">
                  <span className="status-dot" />
                  <span className="name">{item.inputName}</span>
                  {item.acceptedName && item.acceptedName !== item.inputName && (
                    <span className="arrow">→ {item.acceptedName}</span>
                  )}
                  {item.synonymCount !== undefined && (
                    <span className="badge">{item.synonymCount}</span>
                  )}
                  {item.error && <span className="error">{item.error}</span>}
                </div>

                {expandedId === item.id && item.status === 'completed' && item.searchUrls && (
                  <div className="item-body">
                    <table>
                      <tbody>
                        {item.searchUrls.map((url, i) => (
                          <tr key={i}>
                            <td>{url.name}</td>
                            <td>
                              <a href={url.scholar} target="_blank" rel="noopener noreferrer">Scholar</a>
                              <a href={url.kci} target="_blank" rel="noopener noreferrer">KCI</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* 빈 상태 */}
        {!hasItems && (
          <section className="empty">
            <p>엑셀 파일을 업로드하거나 학명을 직접 입력하세요.</p>
            <p className="hint">첫 번째 열에 학명이 포함된 .xlsx, .csv 파일</p>
          </section>
        )}

        {/* 문헌 수집 및 분석 (4-5단계) */}
        {status === 'completed' && completed > 0 && (
          <section className="pdf-section">
            <h2>문헌 수집 및 분석</h2>

            {/* 분석 대상 종 선택 */}
            <div className="species-select">
              <label>분석 대상 학명</label>
              <select
                value={selectedSpecies}
                onChange={e => setSelectedSpecies(e.target.value)}
              >
                <option value="">선택하세요</option>
                {items.filter(i => i.status === 'completed').map(item => (
                  <option key={item.id} value={item.acceptedName || item.inputName}>
                    {item.acceptedName || item.inputName}
                    {item.synonymCount ? ` (이명 ${item.synonymCount}개)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 수집 옵션 */}
            <details className="collection-options-section">
              <summary>수집 옵션</summary>
              <div className="collection-options-grid">
                <div className="option-group">
                  <label className="option-label">검색 소스</label>
                  <div className="checkbox-group">
                    <label className={collectionOptions.searchStrategy === 'historical' && !collectionOptions.sources.includes('bhl') ? 'warning' : ''}>
                      <input
                        type="checkbox"
                        checked={collectionOptions.sources.includes('bhl')}
                        onChange={e => {
                          if (e.target.checked) {
                            setCollectionOptions(p => ({ ...p, sources: [...p.sources, 'bhl'] }));
                          } else {
                            setCollectionOptions(p => ({ ...p, sources: p.sources.filter(s => s !== 'bhl') }));
                          }
                        }}
                      />
                      BHL (역사적 문헌 1800~1970, API 키 필요)
                      {collectionOptions.searchStrategy === 'historical' && !collectionOptions.sources.includes('bhl') &&
                        <span className="source-warning"> - 역사적 전략에 필수!</span>
                      }
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={collectionOptions.sources.includes('semantic')}
                        onChange={e => {
                          if (e.target.checked) {
                            setCollectionOptions(p => ({ ...p, sources: [...p.sources, 'semantic'] }));
                          } else {
                            setCollectionOptions(p => ({ ...p, sources: p.sources.filter(s => s !== 'semantic') }));
                          }
                        }}
                      />
                      Semantic Scholar (주로 2000년대 이후 논문)
                    </label>
                  </div>
                  <span className="option-hint source-hint">
                    최초 기록을 찾으려면 BHL 사용을 권장합니다 (1800년대 문헌 포함)
                  </span>
                </div>

                <div className="option-group">
                  <label className="option-label">검색 전략</label>
                  <select
                    value={collectionOptions.searchStrategy}
                    onChange={e => setCollectionOptions(p => ({ ...p, searchStrategy: e.target.value as CollectionOptions['searchStrategy'] }))}
                  >
                    <option value="both">역사적 문헌 + 한국 기록 (권장)</option>
                    <option value="historical">역사적 문헌만 (1700-1970, 원기재 찾기용)</option>
                    <option value="korea">한국 기록만 (Korea 키워드 포함)</option>
                  </select>
                  <span className="option-hint">
                    {collectionOptions.searchStrategy === 'both' && '① 역사적 원기재 (1700-1970, Korea 없이) + ② 한국 기록 (Korea 키워드 포함) 모두 검색'}
                    {collectionOptions.searchStrategy === 'historical' && '1700-1970년 원기재 문헌만 검색. Korea 키워드 없이 학명만으로 검색 → BHL 필수!'}
                    {collectionOptions.searchStrategy === 'korea' && '한국 관련 문헌만 검색 (Korea, 朝鮮, Chosen, 부산, 제주 등 80+ 키워드)'}
                  </span>
                </div>

                <div className="option-group">
                  <label className="option-label">연도 범위 (선택)</label>
                  <div className="year-inputs">
                    <input
                      type="number"
                      placeholder={collectionOptions.searchStrategy === 'historical' || collectionOptions.searchStrategy === 'both' ? '1700' : '시작연도'}
                      value={collectionOptions.yearFrom}
                      onChange={e => setCollectionOptions(p => ({ ...p, yearFrom: e.target.value ? +e.target.value : '' }))}
                    />
                    <span>~</span>
                    <input
                      type="number"
                      placeholder={collectionOptions.searchStrategy === 'historical' ? '1970' : '종료연도'}
                      value={collectionOptions.yearTo}
                      onChange={e => setCollectionOptions(p => ({ ...p, yearTo: e.target.value ? +e.target.value : '' }))}
                    />
                  </div>
                  <span className="option-hint">
                    {(collectionOptions.searchStrategy === 'historical' || collectionOptions.searchStrategy === 'both') &&
                      '역사적 전략은 비워두면 1700-1970 기본 적용'}
                  </span>
                </div>

                <div className="option-group">
                  <label className="option-label">최대 결과 수</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={collectionOptions.maxResults}
                    onChange={e => setCollectionOptions(p => ({ ...p, maxResults: Math.max(5, Math.min(100, +e.target.value || 30)) }))}
                  />
                </div>
              </div>
            </details>

            {/* 자동 수집 버튼 */}
            <div className="collection-controls">
              <button
                onClick={collectLiterature}
                disabled={!selectedSpecies || collectionOptions.sources.length === 0 || collectionProgress.phase === 'searching' || collectionProgress.phase === 'downloading'}
                className="primary collect-btn"
              >
                {collectionProgress.phase === 'searching' ? '검색 중...' :
                 collectionProgress.phase === 'downloading' ? '다운로드 중...' :
                 '문헌 자동 수집'}
              </button>
              <span className="collection-hint">
                {collectionOptions.sources.join(', ').toUpperCase() || '소스 선택 필요'}에서
                {selectedSpecies || '선택된 학명'}의 문헌을 검색합니다
                ({collectionOptions.searchStrategy === 'both' ? '역사적+한국기록' :
                  collectionOptions.searchStrategy === 'historical' ? '역사적 문헌' : '한국 기록'})
              </span>
            </div>

            {/* 수집 진행 상황 */}
            {collectionProgress.phase !== 'idle' && (
              <div className="collection-progress">
                <div className="progress-stats">
                  <span>검색: {collectionProgress.searched}건</span>
                  <span>PDF 다운로드: {collectionProgress.downloaded}건</span>
                  <span>분석 완료: {collectionProgress.analyzed}건</span>
                </div>
                {collectionProgress.errors.length > 0 && (
                  <div className="collection-errors">
                    {collectionProgress.errors.map((e, i) => (
                      <span key={i} className="error-item">{e}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 수집된 문헌 목록 */}
            {collectedLiterature.length > 0 && (
              <div className="literature-list">
                <div className="literature-list-header">
                  <span>수집된 문헌 ({collectedLiterature.length}개, PDF {collectedLiterature.filter(l => l.pdfDownloaded).length}개)</span>
                  <button
                    onClick={analyzeAllCollected}
                    disabled={!collectedLiterature.some(l => l.pdfDownloaded && l.analysisStatus === 'pending')}
                    className="small"
                  >
                    PDF 전체 분석
                  </button>
                </div>

                {collectedLiterature.map(lit => {
                  const recordLabel = getKoreaRecordLabel(lit.analysis);
                  return (
                    <div key={lit.id} className={`literature-item ${lit.analysisStatus} ${lit.pdfDownloaded ? 'has-pdf' : ''}`}>
                      <div className="literature-item-main">
                        <div className="literature-info">
                          <div className="literature-title">
                            <a href={lit.url} target="_blank" rel="noopener noreferrer">{lit.title}</a>
                          </div>
                          <div className="literature-meta">
                            <span className="source-badge">{lit.source}</span>
                            {lit.year && <span className="year">{lit.year}</span>}
                            {lit.authors.length > 0 && <span className="authors">{lit.authors.slice(0, 2).join(', ')}{lit.authors.length > 2 ? ' et al.' : ''}</span>}
                            {lit.journal && <span className="journal">{lit.journal}</span>}
                            {lit.ocrQuality && (
                              <span
                                className="ocr-quality-badge"
                                style={{
                                  color: getOCRQualityBadge(lit.ocrQuality.quality).color,
                                  background: getOCRQualityBadge(lit.ocrQuality.quality).bgColor,
                                }}
                                title={`OCR 점수: ${lit.ocrQuality.score}/100`}
                              >
                                {getOCRQualityBadge(lit.ocrQuality.quality).label}
                              </span>
                            )}
                          </div>
                          {lit.snippet && (
                            <div className="literature-snippet">{lit.snippet}</div>
                          )}
                        </div>
                        <div className="literature-actions">
                          {lit.pdfDownloaded ? (
                            <>
                              {lit.analysisStatus === 'pending' && (
                                <button
                                  onClick={() => analyzeCollectedLiterature(lit)}
                                  className="small primary"
                                >
                                  분석
                                </button>
                              )}
                              {lit.analysisStatus === 'analyzing' && (
                                <span className="analyzing">분석 중...</span>
                              )}
                              {lit.analysisStatus === 'completed' && (
                                <span className="record-label" style={{ color: recordLabel.color }}>
                                  {recordLabel.text}
                                  {lit.analysis?.confidence !== undefined && (
                                    <span className="confidence">({Math.round(lit.analysis.confidence * 100)}%)</span>
                                  )}
                                </span>
                              )}
                              {lit.analysisStatus === 'error' && (
                                <span className="analysis-error">{lit.analysisError}</span>
                              )}
                            </>
                          ) : (
                            <span className="no-pdf">PDF 없음</span>
                          )}
                        </div>
                      </div>

                      {/* 분석 결과 상세 */}
                      {lit.analysisStatus === 'completed' && lit.analysis && (
                        <div className="pdf-analysis-detail">
                          {lit.analysis.locality && (
                            <div className="detail-row">
                              <span className="label">채집지:</span>
                              <span>{lit.analysis.locality}</span>
                            </div>
                          )}
                          {lit.analysis.collectionDate && (
                            <div className="detail-row">
                              <span className="label">채집일:</span>
                              <span>{lit.analysis.collectionDate}</span>
                            </div>
                          )}
                          {lit.analysis.relevantQuotes && lit.analysis.relevantQuotes.length > 0 && (
                            <div className="detail-row quotes">
                              <span className="label">관련 인용:</span>
                              <ul>
                                {lit.analysis.relevantQuotes.slice(0, 3).map((q, i) => (
                                  <li key={i}>"{q}"</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lit.analysis.reasoning && (
                            <div className="detail-row reasoning">
                              <span className="label">판단 근거:</span>
                              <p>{lit.analysis.reasoning}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 수동 업로드 (보조) */}
            <details className="manual-upload-section" open={showManualUpload} onToggle={e => setShowManualUpload((e.target as HTMLDetailsElement).open)}>
              <summary>수동 PDF 업로드 (자동 수집 보완용)</summary>
              <div className="pdf-upload">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePdfUpload}
                  id="pdf-input"
                  hidden
                />
                <label htmlFor="pdf-input" className={`btn ${pdfUploadStatus === 'uploading' ? 'disabled' : ''}`}>
                  {pdfUploadStatus === 'uploading' ? '업로드 중...' : 'PDF 파일 선택'}
                </label>
                <span className="upload-hint">자동 수집에서 누락된 문헌을 직접 업로드할 수 있습니다</span>
              </div>

              {/* 업로드된 PDF 목록 */}
              {uploadedPDFs.length > 0 && (
                <div className="pdf-list">
                  <div className="pdf-list-header">
                    <span>수동 업로드 문헌 ({uploadedPDFs.length}개)</span>
                    <button
                      onClick={analyzeAllPdfs}
                      disabled={!selectedSpecies || uploadedPDFs.every(p => p.analysisStatus !== 'pending')}
                      className="small"
                    >
                      전체 분석
                    </button>
                  </div>

                  {uploadedPDFs.map(pdf => {
                    const recordLabel = getKoreaRecordLabel(pdf.analysis);
                    return (
                      <div key={pdf.pdfId} className={`pdf-item ${pdf.analysisStatus}`}>
                        <div className="pdf-item-main">
                          <div className="pdf-info">
                            <span className="pdf-name">{pdf.fileName}</span>
                            {pdf.textLength && (
                              <span className="pdf-meta">{(pdf.textLength / 1000).toFixed(1)}KB 추출됨</span>
                            )}
                            {pdf.ocrQuality && (
                              <span
                                className="ocr-quality-badge"
                                style={{
                                  color: getOCRQualityBadge(pdf.ocrQuality.quality).color,
                                  background: getOCRQualityBadge(pdf.ocrQuality.quality).bgColor,
                                }}
                                title={`OCR 점수: ${pdf.ocrQuality.score}/100\n${pdf.ocrQuality.issues.join('\n')}`}
                              >
                                {getOCRQualityBadge(pdf.ocrQuality.quality).label}
                              </span>
                            )}
                            {pdf.extractionError && (
                              <span className="pdf-warning">텍스트 추출 실패</span>
                            )}
                          </div>
                          <div className="pdf-actions">
                            {pdf.analysisStatus === 'pending' && (
                              <button
                                onClick={() => analyzePdf(pdf)}
                                disabled={!selectedSpecies}
                                className="small primary"
                              >
                                분석
                              </button>
                            )}
                            {pdf.analysisStatus === 'analyzing' && (
                              <span className="analyzing">분석 중...</span>
                            )}
                            {pdf.analysisStatus === 'completed' && (
                              <span className="record-label" style={{ color: recordLabel.color }}>
                                {recordLabel.text}
                                {pdf.analysis?.confidence !== undefined && (
                                  <span className="confidence">({Math.round(pdf.analysis.confidence * 100)}%)</span>
                                )}
                              </span>
                            )}
                            {pdf.analysisStatus === 'error' && (
                              <span className="analysis-error">{pdf.analysisError}</span>
                            )}
                          </div>
                        </div>

                        {/* 분석 결과 상세 */}
                        {pdf.analysisStatus === 'completed' && pdf.analysis && (
                          <div className="pdf-analysis-detail">
                            {pdf.analysis.locality && (
                              <div className="detail-row">
                                <span className="label">채집지:</span>
                                <span>{pdf.analysis.locality}</span>
                              </div>
                            )}
                            {pdf.analysis.collectionDate && (
                              <div className="detail-row">
                                <span className="label">채집일:</span>
                                <span>{pdf.analysis.collectionDate}</span>
                              </div>
                            )}
                            {pdf.analysis.specimenInfo && (
                              <div className="detail-row">
                                <span className="label">표본:</span>
                                <span>{pdf.analysis.specimenInfo}</span>
                              </div>
                            )}
                            {pdf.analysis.relevantQuotes && pdf.analysis.relevantQuotes.length > 0 && (
                              <div className="detail-row quotes">
                                <span className="label">관련 인용:</span>
                                <ul>
                                  {pdf.analysis.relevantQuotes.slice(0, 3).map((q, i) => (
                                    <li key={i}>"{q}"</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {pdf.analysis.reasoning && (
                              <div className="detail-row reasoning">
                                <span className="label">판단 근거:</span>
                                <p>{pdf.analysis.reasoning}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </details>

            {/* 빈 상태 */}
            {collectedLiterature.length === 0 && uploadedPDFs.length === 0 && collectionProgress.phase === 'idle' && (
              <div className="pdf-empty">
                <p>문헌을 자동으로 수집하여 한국 기록 여부를 분석하세요.</p>
                <p className="hint">
                  {selectedSpecies
                    ? `"${selectedSpecies}" 관련 문헌을 BHL, Semantic Scholar에서 검색합니다.`
                    : '먼저 분석할 학명을 선택하세요.'}
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: #fafafa;
          color: #1a1a1a;
        }

        header {
          padding: 32px 24px 24px;
          background: #fff;
          border-bottom: 1px solid #eee;
        }

        header h1 {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 4px;
        }

        header p {
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        /* 워크플로우 단계 표시기 */
        .workflow-steps {
          background: #fff;
          border-bottom: 1px solid #eee;
          padding: 16px 24px;
        }

        .steps-container {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          gap: 0;
          max-width: 800px;
          margin: 0 auto;
          overflow-x: auto;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          flex: 1;
          min-width: 60px;
          max-width: 100px;
        }

        .step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #e5e5e5;
          color: #999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
          z-index: 1;
        }

        .step.completed .step-number {
          background: #22c55e;
          color: #fff;
        }

        .step.current .step-number {
          background: #1a1a1a;
          color: #fff;
          box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.15);
        }

        .step-label {
          font-size: 10px;
          color: #999;
          margin-top: 4px;
          text-align: center;
          white-space: nowrap;
        }

        .step.completed .step-label {
          color: #22c55e;
        }

        .step.current .step-label {
          color: #1a1a1a;
          font-weight: 600;
        }

        .step-connector {
          position: absolute;
          top: 14px;
          left: 50%;
          width: 100%;
          height: 2px;
          background: #e5e5e5;
          z-index: 0;
        }

        .step.completed .step-connector {
          background: #22c55e;
        }

        .current-step-info {
          text-align: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }

        .step-name {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .step-desc {
          font-size: 12px;
          color: #666;
          margin-left: 8px;
        }

        main {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px;
        }

        section {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .input-area .input-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .btn, button {
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn:hover, button:hover:not(:disabled) {
          background: #eee;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        button.primary {
          background: #1a1a1a;
          color: #fff;
          border-color: #1a1a1a;
        }

        button.primary:hover {
          background: #333;
        }

        .or {
          color: #999;
          font-size: 12px;
        }

        textarea {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          resize: none;
          font-family: inherit;
        }

        textarea:focus {
          outline: none;
          border-color: #999;
        }

        details {
          margin-top: 12px;
        }

        summary {
          font-size: 12px;
          color: #666;
          cursor: pointer;
          user-select: none;
        }

        .options {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }

        .options label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .options input[type="text"],
        .options input[type="number"] {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
        }

        .options input[type="number"] {
          width: 100px;
        }

        .year-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .year-row span {
          color: #999;
        }

        .llm-options {
          flex-direction: column;
          gap: 10px;
        }

        .llm-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .llm-row label {
          min-width: 60px;
          font-size: 13px;
          color: #666;
        }

        .llm-row select,
        .llm-row input[type="password"] {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          background: #fff;
        }

        .llm-hint {
          font-size: 11px;
          color: #999;
          margin: 4px 0 0;
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .progress-area {
          width: 100%;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .progress-text {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .count {
          font-size: 13px;
          color: #666;
        }

        .error-count {
          color: #ef4444;
        }

        .progress {
          width: 100%;
          height: 6px;
          background: #eee;
          border-radius: 3px;
          overflow: hidden;
        }

        .bar {
          height: 100%;
          background: #1a1a1a;
          transition: width 0.3s;
        }

        .current-item {
          margin-top: 8px;
          font-size: 13px;
          color: #666;
        }

        .current-item em {
          color: #1a1a1a;
          font-style: italic;
        }

        .btn-group {
          display: flex;
          gap: 8px;
        }

        .results {
          padding: 0;
          background: transparent;
          border: none;
        }

        .item {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: border-color 0.15s;
        }

        .item:hover {
          border-color: #ccc;
        }

        .item.processing {
          border-color: #666;
        }

        .item.completed {
          border-left: 3px solid #22c55e;
        }

        .item.error {
          border-left: 3px solid #ef4444;
        }

        .item-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ddd;
        }

        .item.processing .status-dot {
          background: #666;
          animation: pulse 1s infinite;
        }

        .item.completed .status-dot {
          background: #22c55e;
        }

        .item.error .status-dot {
          background: #ef4444;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .name {
          font-style: italic;
          font-size: 14px;
        }

        .arrow {
          color: #666;
          font-style: italic;
          font-size: 13px;
        }

        .badge {
          background: #f0f0f0;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          color: #666;
        }

        .error {
          color: #ef4444;
          font-size: 12px;
          margin-left: auto;
        }

        .item-body {
          padding: 0 14px 14px;
          border-top: 1px solid #eee;
        }

        .item-body table {
          width: 100%;
          font-size: 13px;
        }

        .item-body td {
          padding: 6px 0;
          vertical-align: top;
        }

        .item-body td:first-child {
          font-style: italic;
          color: #666;
          width: 50%;
        }

        .item-body a {
          display: inline-block;
          padding: 2px 8px;
          margin-right: 6px;
          background: #f5f5f5;
          border-radius: 4px;
          color: #1a1a1a;
          text-decoration: none;
          font-size: 12px;
        }

        .item-body a:hover {
          background: #eee;
        }

        .empty {
          text-align: center;
          padding: 48px 24px;
          color: #666;
        }

        .empty p {
          margin: 0 0 8px;
        }

        .hint {
          font-size: 12px;
          color: #999;
        }

        /* PDF 섹션 스타일 */
        .pdf-section {
          margin-top: 24px;
        }

        .pdf-section h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px;
          color: #1a1a1a;
        }

        .species-select {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .species-select label {
          font-size: 13px;
          color: #666;
          white-space: nowrap;
        }

        .species-select select {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          background: #fff;
        }

        .pdf-upload {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px dashed #ddd;
        }

        .pdf-upload .btn.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .upload-hint {
          font-size: 12px;
          color: #999;
        }

        .pdf-list {
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          overflow: hidden;
        }

        .pdf-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: #f9f9f9;
          border-bottom: 1px solid #e5e5e5;
          font-size: 13px;
          font-weight: 500;
        }

        .pdf-item {
          border-bottom: 1px solid #eee;
        }

        .pdf-item:last-child {
          border-bottom: none;
        }

        .pdf-item.completed {
          border-left: 3px solid #22c55e;
        }

        .pdf-item.error {
          border-left: 3px solid #ef4444;
        }

        .pdf-item.analyzing {
          border-left: 3px solid #f59e0b;
        }

        .pdf-item-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
        }

        .pdf-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pdf-name {
          font-size: 13px;
          color: #1a1a1a;
        }

        .pdf-meta {
          font-size: 11px;
          color: #999;
        }

        .ocr-quality-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;
          margin-left: 6px;
        }

        .pdf-warning {
          font-size: 11px;
          color: #f59e0b;
        }

        .pdf-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        button.small {
          padding: 4px 10px;
          font-size: 12px;
        }

        .analyzing {
          font-size: 12px;
          color: #f59e0b;
          animation: pulse 1s infinite;
        }

        .record-label {
          font-size: 12px;
          font-weight: 500;
        }

        .confidence {
          font-weight: 400;
          margin-left: 4px;
          opacity: 0.7;
        }

        .analysis-error {
          font-size: 12px;
          color: #ef4444;
        }

        .pdf-analysis-detail {
          padding: 12px 14px;
          background: #f9f9f9;
          border-top: 1px solid #eee;
        }

        .detail-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .detail-row:last-child {
          margin-bottom: 0;
        }

        .detail-row .label {
          color: #666;
          min-width: 60px;
          flex-shrink: 0;
        }

        .detail-row.quotes {
          flex-direction: column;
        }

        .detail-row.quotes ul {
          margin: 4px 0 0;
          padding-left: 20px;
        }

        .detail-row.quotes li {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
          font-style: italic;
        }

        .detail-row.reasoning {
          flex-direction: column;
        }

        .detail-row.reasoning p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #666;
          line-height: 1.5;
        }

        .pdf-empty {
          text-align: center;
          padding: 32px 24px;
          color: #666;
        }

        .pdf-empty p {
          margin: 0 0 8px;
        }

        /* 문헌 자동 수집 스타일 */
        .collection-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 16px;
          background: #f0f7ff;
          border-radius: 8px;
          border: 1px solid #cce5ff;
        }

        .collect-btn {
          white-space: nowrap;
        }

        .collection-hint {
          font-size: 12px;
          color: #666;
        }

        .collection-progress {
          margin-bottom: 16px;
          padding: 12px 16px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #eee;
        }

        .progress-stats {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: #666;
        }

        .progress-stats span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .collection-errors {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
        }

        .error-item {
          display: block;
          font-size: 12px;
          color: #ef4444;
          margin-bottom: 4px;
        }

        .literature-list {
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .literature-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: #f9f9f9;
          border-bottom: 1px solid #e5e5e5;
          font-size: 13px;
          font-weight: 500;
        }

        .literature-item {
          border-bottom: 1px solid #eee;
        }

        .literature-item:last-child {
          border-bottom: none;
        }

        .literature-item.has-pdf {
          background: #fafffe;
        }

        .literature-item.completed {
          border-left: 3px solid #22c55e;
        }

        .literature-item.error {
          border-left: 3px solid #ef4444;
        }

        .literature-item.analyzing {
          border-left: 3px solid #f59e0b;
        }

        .literature-item-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 14px;
          gap: 12px;
        }

        .literature-info {
          flex: 1;
          min-width: 0;
        }

        .literature-title {
          margin-bottom: 6px;
        }

        .literature-title a {
          font-size: 13px;
          color: #1a1a1a;
          text-decoration: none;
          line-height: 1.4;
        }

        .literature-title a:hover {
          text-decoration: underline;
          color: #0066cc;
        }

        .literature-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 11px;
          color: #666;
        }

        .source-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #e5e5e5;
          border-radius: 4px;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 500;
          color: #666;
        }

        .literature-snippet {
          margin-top: 6px;
          font-size: 12px;
          color: #888;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .literature-actions {
          flex-shrink: 0;
        }

        .no-pdf {
          font-size: 11px;
          color: #999;
          padding: 4px 8px;
          background: #f5f5f5;
          border-radius: 4px;
        }

        .manual-upload-section {
          margin-top: 16px;
        }

        .manual-upload-section summary {
          font-size: 13px;
          color: #666;
          cursor: pointer;
          padding: 8px 0;
        }

        .manual-upload-section .pdf-upload {
          margin-top: 12px;
        }

        /* 수집 옵션 스타일 */
        .collection-options-section {
          margin-bottom: 16px;
        }

        .collection-options-section summary {
          font-size: 13px;
          color: #666;
          cursor: pointer;
          padding: 8px 0;
          font-weight: 500;
        }

        .collection-options-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 12px;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #eee;
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .option-label {
          font-size: 12px;
          font-weight: 500;
          color: #666;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #1a1a1a;
          cursor: pointer;
          flex-wrap: wrap;
        }

        .checkbox-group label.warning {
          color: #b45309;
        }

        .source-warning {
          color: #dc2626;
          font-weight: 600;
          font-size: 11px;
        }

        .source-hint {
          margin-top: 8px;
          padding: 6px 10px;
          background: #fef3c7;
          border-radius: 4px;
          color: #92400e;
        }

        .option-group select {
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          background: #fff;
        }

        .option-hint {
          font-size: 11px;
          color: #888;
          line-height: 1.4;
        }

        .year-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .year-inputs input {
          width: 100px;
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
        }

        .year-inputs span {
          color: #999;
        }

        .option-group > input[type="number"] {
          width: 80px;
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
        }

        @media (max-width: 600px) {
          .collection-options-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Rate Limit 경고 배너 */
        .rate-limit-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: #fef3c7;
          border-bottom: 1px solid #fcd34d;
          color: #92400e;
        }

        .rate-limit-banner.exceeded {
          background: #fee2e2;
          border-bottom-color: #fca5a5;
          color: #991b1b;
        }

        .rate-limit-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .rate-limit-icon {
          font-size: 18px;
        }

        .rate-limit-message {
          font-size: 13px;
          font-weight: 500;
        }

        .rate-limit-reset {
          font-size: 11px;
          opacity: 0.8;
        }

        .rate-limit-close {
          background: transparent;
          border: none;
          font-size: 20px;
          cursor: pointer;
          opacity: 0.6;
          padding: 4px 8px;
          line-height: 1;
        }

        .rate-limit-close:hover {
          opacity: 1;
        }

        .rate-limit-banner.exceeded .rate-limit-close {
          color: #991b1b;
        }

        @media (max-width: 600px) {
          main {
            padding: 16px;
          }

          .input-row {
            flex-direction: column;
            align-items: stretch;
          }

          textarea {
            min-width: auto;
          }

          .or {
            text-align: center;
          }

          .workflow-steps {
            padding: 12px 16px;
          }

          .steps-container {
            gap: 0;
            padding-bottom: 4px;
          }

          .step {
            min-width: 40px;
          }

          .step-number {
            width: 24px;
            height: 24px;
            font-size: 11px;
          }

          .step-label {
            font-size: 9px;
          }

          .step-connector {
            top: 12px;
          }

          .current-step-info {
            margin-top: 8px;
            padding-top: 8px;
          }

          .step-name {
            font-size: 13px;
          }

          .step-desc {
            display: block;
            margin-left: 0;
            margin-top: 2px;
          }

          .rate-limit-banner {
            flex-direction: column;
            gap: 8px;
            padding: 12px 16px;
          }

          .rate-limit-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .rate-limit-close {
            position: absolute;
            top: 8px;
            right: 8px;
          }
        }
      `}</style>
    </div>
  );
}
