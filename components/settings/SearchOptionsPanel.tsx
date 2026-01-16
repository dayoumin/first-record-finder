'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, Settings } from 'lucide-react';
import type { SearchOptions } from '@/types/species';

interface SearchOptionsPanelProps {
  options: SearchOptions;
  onChange: (options: SearchOptions) => void;
  defaultOpen?: boolean;
}

export function SearchOptionsPanel({
  options,
  onChange,
  defaultOpen = false,
}: SearchOptionsPanelProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors group">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">검색 옵션</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 border border-t-0 rounded-b-lg space-y-4">
          {/* 한국 키워드 포함 */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="include-korea"
              checked={options.includeKoreaKeywords}
              onCheckedChange={(checked) =>
                onChange({ ...options, includeKoreaKeywords: !!checked })
              }
            />
            <div className="grid gap-1">
              <label
                htmlFor="include-korea"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                한국 키워드 포함
              </label>
              <p className="text-xs text-muted-foreground">
                검색 시 Korea, 한국, 朝鮮 등의 키워드를 포함합니다
              </p>
            </div>
          </div>

          {/* 추가 키워드 */}
          <div className="space-y-2">
            <Label>추가 키워드</Label>
            <Input
              type="text"
              placeholder="콤마로 구분 (예: 부산, 제주, Busan)"
              value={options.customKeywords}
              onChange={(e) =>
                onChange({ ...options, customKeywords: e.target.value })
              }
            />
          </div>

          {/* 연도 범위 */}
          <div className="space-y-2">
            <Label>연도 범위</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="시작연도"
                value={options.yearFrom}
                onChange={(e) =>
                  onChange({
                    ...options,
                    yearFrom: e.target.value ? +e.target.value : '',
                  })
                }
                className="w-24"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="number"
                placeholder="종료연도"
                value={options.yearTo}
                onChange={(e) =>
                  onChange({
                    ...options,
                    yearTo: e.target.value ? +e.target.value : '',
                  })
                }
                className="w-24"
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
