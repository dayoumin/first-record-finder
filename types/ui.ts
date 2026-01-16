/**
 * UI 컴포넌트 타입 정의
 * 프론트엔드 전반에서 사용하는 공통 타입
 */

import type { ComponentType, ReactNode } from 'react';

// ============================================
// Confidence Level (신뢰도)
// ============================================

export type ConfidenceLevel = 1 | 2 | 3 | 4;

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  1: '확정',
  2: '유력',
  3: '검토 필요',
  4: '제외',
};

export const CONFIDENCE_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  1: '한국 채집지 + 날짜/표본 정보 있음',
  2: '한국 언급 있으나 일부 정보 부족',
  3: '학명 있으나 한국 여부 불명확',
  4: '한국 기록 아님',
};

// ============================================
// Loading & Status States
// ============================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: LoadingState;
  error: string | null;
}

// ============================================
// Toast / Notification
// ============================================

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

// ============================================
// Form & Input
// ============================================

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface FormFieldError {
  field: string;
  message: string;
}

// ============================================
// Pagination
// ============================================

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationState;
}

// ============================================
// Tab
// ============================================

export interface TabItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: number | string;
  disabled?: boolean;
}

// ============================================
// Table
// ============================================

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string | number;
}

// ============================================
// Modal / Dialog
// ============================================

export interface ModalState {
  isOpen: boolean;
  data?: unknown;
}

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

// ============================================
// Command Palette
// ============================================

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  group?: string;
}

// ============================================
// Progress / Workflow
// ============================================

export type WorkflowStep =
  | 'input'
  | 'synonym'
  | 'url'
  | 'collection'
  | 'analysis'
  | 'review'
  | 'judgment'
  | 'export';

export interface WorkflowStepInfo {
  id: WorkflowStep;
  label: string;
  description: string;
  number: number;
}

export const WORKFLOW_STEPS: WorkflowStepInfo[] = [
  { id: 'input', label: '입력', description: '엑셀 업로드 또는 직접 입력', number: 1 },
  { id: 'synonym', label: '이명', description: 'WoRMS에서 동의어 추출', number: 2 },
  { id: 'url', label: 'URL', description: 'Scholar/KCI 링크 생성', number: 3 },
  { id: 'collection', label: '수집', description: 'PDF 다운로드', number: 4 },
  { id: 'analysis', label: '분석', description: 'Docling + LLM 분석', number: 5 },
  { id: 'review', label: '검토', description: '사용자 확인 및 수정', number: 6 },
  { id: 'judgment', label: '판정', description: '연도순 정렬 → 확정', number: 7 },
  { id: 'export', label: '정리', description: '최종 엑셀 다운로드', number: 8 },
];

// ============================================
// Empty State
// ============================================

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================
// File Upload
// ============================================

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// ============================================
// Rate Limit
// ============================================

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date | null;
  isLimited: boolean;
}
