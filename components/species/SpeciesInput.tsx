'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpeciesInputProps {
  manualInput: string;
  onManualInputChange: (value: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAdd: () => void;
  disabled?: boolean;
}

export function SpeciesInput({
  manualInput,
  onManualInputChange,
  onFileUpload,
  onAdd,
  disabled = false,
}: SpeciesInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* 파일 업로드 */}
        <div className="flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFileUpload}
            id="file-input"
            className="hidden"
            disabled={disabled}
          />
          <Button
            variant="outline"
            asChild
            className={cn(disabled && 'opacity-50 cursor-not-allowed')}
          >
            <label htmlFor="file-input" className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              파일 선택
            </label>
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            .xlsx, .csv 파일
          </p>
        </div>

        <span className="text-muted-foreground self-center hidden sm:block">
          or
        </span>

        {/* 수동 입력 */}
        <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
          <Textarea
            value={manualInput}
            onChange={(e) => onManualInputChange(e.target.value)}
            placeholder="학명 입력 (줄바꿈으로 구분)"
            rows={2}
            disabled={disabled}
            className="flex-1 min-w-0 resize-none"
          />
          <Button
            onClick={onAdd}
            disabled={!manualInput.trim() || disabled}
            className="self-end sm:self-stretch"
          >
            <Plus className="mr-2 h-4 w-4" />
            추가
          </Button>
        </div>
      </div>
    </div>
  );
}
