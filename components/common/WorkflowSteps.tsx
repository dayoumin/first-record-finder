'use client';

import { cn } from '@/lib/utils';
import { WORKFLOW_STEPS_CONFIG } from '@/lib/constants';
import type { WorkflowStep } from '@/types/ui';
import { Check } from 'lucide-react';

interface WorkflowStepsProps {
  currentStep: WorkflowStep;
  className?: string;
}

// 워크플로우 단계 매핑 (기존 코드와 호환)
const stepMapping: Record<string, WorkflowStep> = {
  input: 'input',
  synonyms: 'synonym',
  urls: 'url',
  collection: 'collection',
  analysis: 'analysis',
  review: 'review',
  decision: 'judgment',
  export: 'export',
};

export function WorkflowSteps({ currentStep, className }: WorkflowStepsProps) {
  // 기존 단계 이름을 새 이름으로 변환
  const normalizedStep = stepMapping[currentStep] || currentStep;
  const currentStepIndex = WORKFLOW_STEPS_CONFIG.findIndex(
    s => s.id === normalizedStep
  );
  const currentStepInfo = WORKFLOW_STEPS_CONFIG[currentStepIndex];

  return (
    <nav className={cn('space-y-4', className)}>
      {/* 단계 표시기 */}
      <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2">
        {WORKFLOW_STEPS_CONFIG.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.id} className="flex items-center">
              {/* 단계 아이콘 */}
              <div
                className={cn(
                  'flex flex-col items-center gap-1 px-2',
                  isCompleted && 'text-primary',
                  isCurrent && 'text-primary font-medium',
                  !isCompleted && !isCurrent && 'text-muted-foreground'
                )}
                title={step.description}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'border-primary text-primary bg-primary/10',
                    !isCompleted && !isCurrent && 'border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className="text-xs whitespace-nowrap hidden sm:block">
                  {step.label.split('. ')[1]}
                </span>
              </div>

              {/* 연결선 */}
              {index < WORKFLOW_STEPS_CONFIG.length - 1 && (
                <div
                  className={cn(
                    'w-6 h-0.5 mx-1',
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 현재 단계 정보 */}
      {currentStepInfo && (
        <div className="text-center">
          <p className="font-medium">{currentStepInfo.label}</p>
          <p className="text-sm text-muted-foreground">
            {currentStepInfo.description}
          </p>
        </div>
      )}
    </nav>
  );
}
