/**
 * 애플리케이션 상수 정의
 */

import type { LLMProviderConfig } from '@/types/species';
import type { WorkflowStepInfo } from '@/types/ui';

// LLM 제공자 설정
export const LLM_PROVIDERS: LLMProviderConfig[] = [
  {
    value: 'ollama',
    label: 'Ollama (로컬)',
    models: ['qwen3:4b', 'qwen3:8b', 'llama3.3', 'gemma3'],
    needsKey: false
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    models: [
      'deepseek/deepseek-r1-0528:free',
      'xiaomi/mimo-v2-flash:free',
      'qwen/qwq-32b:free',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
    ],
    needsKey: true
  },
  {
    value: 'grok',
    label: 'Grok (xAI)',
    models: ['grok-4.1', 'grok-4.1-fast', 'grok-4', 'grok-3'],
    needsKey: true
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-5.2', 'gpt-5.2-pro', 'gpt-5.2-chat-latest', 'gpt-4o'],
    needsKey: true
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: ['claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-opus-4.1'],
    needsKey: true
  },
];

// 워크플로우 단계 정의
export const WORKFLOW_STEPS_CONFIG: WorkflowStepInfo[] = [
  { id: 'input', label: '1. 학명 입력', number: 1, description: '엑셀 업로드 또는 직접 입력' },
  { id: 'synonym', label: '2. 이명 조사', number: 2, description: 'WoRMS에서 동의어 추출' },
  { id: 'url', label: '3. 검색 URL', number: 3, description: 'Scholar/KCI 링크 생성' },
  { id: 'collection', label: '4. 문헌 수집', number: 4, description: 'PDF 다운로드' },
  { id: 'analysis', label: '5. 문헌 분석', number: 5, description: 'Docling + LLM 분석' },
  { id: 'review', label: '6. 문헌 검토', number: 6, description: '사용자 확인 및 수정' },
  { id: 'judgment', label: '7. 최초 기록', number: 7, description: '연도순 정렬 → 확정' },
  { id: 'export', label: '8. 결과 정리', number: 8, description: '최종 엑셀 다운로드' },
];

// OCR 품질 배지 설정
export const OCR_QUALITY_BADGES = {
  good: { label: 'OCR 양호', className: 'bg-green-100 text-green-800' },
  fair: { label: 'OCR 보통', className: 'bg-yellow-100 text-yellow-800' },
  poor: { label: 'OCR 낮음', className: 'bg-orange-100 text-orange-800' },
  manual_needed: { label: '수동 분석 필요', className: 'bg-red-100 text-red-800' },
} as const;

// 한국 기록 판정 결과 레이블
export const KOREA_RECORD_LABELS = {
  true: { text: '한국 기록 있음', className: 'text-green-600' },
  false: { text: '한국 기록 없음', className: 'text-red-600' },
  null: { text: '불확실', className: 'text-yellow-600' },
  undefined: { text: '미분석', className: 'text-muted-foreground' },
} as const;

// 기본 수집 옵션
export const DEFAULT_COLLECTION_OPTIONS = {
  sources: ['bhl', 'semantic'] as ('bhl' | 'semantic')[],
  searchStrategy: 'both' as const,
  yearFrom: '' as const,
  yearTo: '' as const,
  maxResults: 30,
};

// 기본 검색 옵션
export const DEFAULT_SEARCH_OPTIONS = {
  customKeywords: '',
  yearFrom: '' as const,
  yearTo: '' as const,
  includeKoreaKeywords: true,
};

// 기본 LLM 설정
export const DEFAULT_LLM_SETTINGS = {
  provider: 'ollama' as const,
  model: 'llama3.3',
  apiKey: '',
};
