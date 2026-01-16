'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { BatchItem } from '@/types/species';

interface SpeciesSelectProps {
  items: BatchItem[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SpeciesSelect({
  items,
  value,
  onChange,
  label = '분석 대상 학명',
  placeholder = '선택하세요',
  disabled = false,
}: SpeciesSelectProps) {
  const completedItems = items.filter(i => i.status === 'completed');

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {completedItems.map(item => (
            <SelectItem
              key={item.id}
              value={item.acceptedName || item.inputName}
            >
              <span className="italic">
                {item.acceptedName || item.inputName}
              </span>
              {item.synonymCount ? (
                <span className="ml-2 text-muted-foreground">
                  (이명 {item.synonymCount}개)
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
