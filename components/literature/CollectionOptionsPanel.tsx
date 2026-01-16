'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollectionOptions } from '@/types/species';

interface CollectionOptionsPanelProps {
  options: CollectionOptions;
  onChange: (options: CollectionOptions) => void;
  defaultOpen?: boolean;
}

export function CollectionOptionsPanel({
  options,
  onChange,
  defaultOpen = false,
}: CollectionOptionsPanelProps) {
  const showBhlWarning =
    options.searchStrategy === 'historical' && !options.sources.includes('bhl');

  const toggleSource = (source: 'bhl' | 'semantic', checked: boolean) => {
    if (checked) {
      onChange({ ...options, sources: [...options.sources, source] });
    } else {
      onChange({ ...options, sources: options.sources.filter(s => s !== source) });
    }
  };

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors group">
        <span className="font-medium">수집 옵션</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 space-y-6 border border-t-0 rounded-b-lg">
          {/* 검색 소스 */}
          <div className="space-y-3">
            <Label>검색 소스</Label>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="source-bhl"
                  checked={options.sources.includes('bhl')}
                  onCheckedChange={(checked) => toggleSource('bhl', !!checked)}
                />
                <div className="grid gap-1">
                  <label
                    htmlFor="source-bhl"
                    className={cn(
                      'text-sm font-medium leading-none cursor-pointer',
                      showBhlWarning && 'text-yellow-600'
                    )}
                  >
                    BHL (역사적 문헌 1800~1970, API 키 필요)
                    {showBhlWarning && (
                      <span className="ml-2 inline-flex items-center text-yellow-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        역사적 전략에 필수!
                      </span>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="source-semantic"
                  checked={options.sources.includes('semantic')}
                  onCheckedChange={(checked) => toggleSource('semantic', !!checked)}
                />
                <div className="grid gap-1">
                  <label
                    htmlFor="source-semantic"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Semantic Scholar (주로 2000년대 이후 논문)
                  </label>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              최초 기록을 찾으려면 BHL 사용을 권장합니다 (1800년대 문헌 포함)
            </p>
          </div>

          {/* 검색 전략 */}
          <div className="space-y-3">
            <Label>검색 전략</Label>
            <Select
              value={options.searchStrategy}
              onValueChange={(value) =>
                onChange({
                  ...options,
                  searchStrategy: value as CollectionOptions['searchStrategy'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">
                  역사적 문헌 + 한국 기록 (권장)
                </SelectItem>
                <SelectItem value="historical">
                  역사적 문헌만 (1700-1970, 원기재 찾기용)
                </SelectItem>
                <SelectItem value="korea">
                  한국 기록만 (Korea 키워드 포함)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {options.searchStrategy === 'both' &&
                '① 역사적 원기재 (1700-1970, Korea 없이) + ② 한국 기록 (Korea 키워드 포함) 모두 검색'}
              {options.searchStrategy === 'historical' &&
                '1700-1970년 원기재 문헌만 검색. Korea 키워드 없이 학명만으로 검색 → BHL 필수!'}
              {options.searchStrategy === 'korea' &&
                '한국 관련 문헌만 검색 (Korea, 朝鮮, Chosen, 부산, 제주 등 80+ 키워드)'}
            </p>
          </div>

          {/* 연도 범위 */}
          <div className="space-y-3">
            <Label>연도 범위 (선택)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={
                  options.searchStrategy === 'historical' ||
                  options.searchStrategy === 'both'
                    ? '1700'
                    : '시작연도'
                }
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
                placeholder={
                  options.searchStrategy === 'historical' ? '1970' : '종료연도'
                }
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
            {(options.searchStrategy === 'historical' ||
              options.searchStrategy === 'both') && (
              <p className="text-xs text-muted-foreground">
                역사적 전략은 비워두면 1700-1970 기본 적용
              </p>
            )}
          </div>

          {/* 최대 결과 수 */}
          <div className="space-y-3">
            <Label>최대 결과 수</Label>
            <Input
              type="number"
              min={5}
              max={100}
              value={options.maxResults}
              onChange={(e) =>
                onChange({
                  ...options,
                  maxResults: Math.max(5, Math.min(100, +e.target.value || 30)),
                })
              }
              className="w-24"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
