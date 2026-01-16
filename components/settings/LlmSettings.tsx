'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, Bot } from 'lucide-react';
import { LLM_PROVIDERS } from '@/lib/constants';
import type { LLMSettings as LLMSettingsType, LLMProvider } from '@/types/species';

interface LlmSettingsProps {
  settings: LLMSettingsType;
  onChange: (settings: LLMSettingsType) => void;
  defaultOpen?: boolean;
}

const providerHints: Record<LLMProvider, string> = {
  ollama: '로컬에서 Ollama 서버가 실행 중이어야 합니다.',
  openrouter: 'OpenRouter에서 API 키를 발급받으세요. 다양한 모델 사용 가능.',
  grok: 'xAI 콘솔에서 API 키를 발급받으세요.',
  openai: 'OpenAI 플랫폼에서 API 키를 발급받으세요.',
  anthropic: 'Anthropic 콘솔에서 API 키를 발급받으세요.',
};

export function LlmSettings({
  settings,
  onChange,
  defaultOpen = false,
}: LlmSettingsProps) {
  const currentProvider = LLM_PROVIDERS.find(p => p.value === settings.provider);

  const handleProviderChange = (provider: string) => {
    const newProvider = provider as LLMProvider;
    const providerConfig = LLM_PROVIDERS.find(p => p.value === newProvider);
    onChange({
      provider: newProvider,
      model: providerConfig?.models[0] || '',
      apiKey: settings.apiKey,
    });
  };

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors group">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">LLM 설정</span>
          <span className="text-sm text-muted-foreground">
            (문헌 분석용)
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 border border-t-0 rounded-b-lg space-y-4">
          {/* 제공자 선택 */}
          <div className="space-y-2">
            <Label>제공자</Label>
            <Select
              value={settings.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 모델 선택 */}
          <div className="space-y-2">
            <Label>모델</Label>
            <Select
              value={settings.model}
              onValueChange={(model) => onChange({ ...settings, model })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentProvider?.models.map(m => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API 키 입력 */}
          {currentProvider?.needsKey && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="API 키 입력"
                value={settings.apiKey}
                onChange={(e) =>
                  onChange({ ...settings, apiKey: e.target.value })
                }
              />
            </div>
          )}

          {/* 도움말 */}
          <p className="text-sm text-muted-foreground">
            {providerHints[settings.provider]}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
