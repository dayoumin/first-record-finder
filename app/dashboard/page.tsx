'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings, BookOpen, Route, Database, BarChart3, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// Rate Limit 상태 타입
interface RateLimitStatus {
  used: number;
  remaining: number;
  limit: number;
  isWarning: boolean;
  isExceeded: boolean;
  resetsAt: string;
}

// 문헌 소스 설정 타입
interface SourceConfig {
  source: string;
  enabled: boolean;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
}

// 프로젝트 진행 상태
const PROJECT_STATUS = [
  {
    phase: '1. 핵심 기능',
    items: [
      { name: 'WoRMS API 이명 추출', status: 'done', description: '학명으로 모든 이명 조회' },
      { name: '검색 URL 생성', status: 'done', description: 'Google Scholar, KCI 링크 자동 생성' },
      { name: 'PDF 텍스트 추출', status: 'done', description: 'Docling OCR 연동' },
      { name: 'LLM 문헌 분석', status: 'done', description: 'Ollama, OpenRouter 무료 모델 등 지원' },
      { name: 'Rate Limit 관리', status: 'done', description: 'OpenRouter 무료 모델 일일 1,000회 제한' },
      { name: '엑셀 내보내기', status: 'done', description: '3개 시트로 결과 출력' },
    ],
  },
  {
    phase: '2. 문헌 자동 수집',
    items: [
      { name: 'BHL API', status: 'done', description: '역사적 문헌 (1800년대~)' },
      { name: 'Semantic Scholar API', status: 'done', description: '최신 학술 논문 검색' },
      { name: 'J-STAGE API', status: 'done', description: '일본 논문 (일제강점기 포함)' },
      { name: 'CiNii API', status: 'done', description: '일본 학술정보' },
      { name: 'GBIF API', status: 'done', description: '표본 데이터 검증' },
      { name: 'OBIS API', status: 'done', description: '해양생물 분포 데이터' },
      { name: 'KCI API', status: 'done', description: '한국 학술지 (공공데이터포털)' },
      { name: 'RISS API', status: 'done', description: '한국 학위논문 (공공데이터포털)' },
      { name: 'ScienceON API', status: 'done', description: 'KISTI 논문/특허/보고서' },
      { name: 'OpenAlex API', status: 'done', description: '현대 논문 주력 (2억+ 논문)' },
    ],
  },
  {
    phase: '3. 검토 및 출력',
    items: [
      { name: '문헌 검토 UI', status: 'in-progress', description: '분석 결과 수정 기능' },
      { name: 'ZIP 다운로드', status: 'planned', description: '엑셀 + PDF 묶음' },
      { name: '최초 기록 판정', status: 'planned', description: '연도순 정렬 → 확정' },
    ],
  },
];

// 검색 전략 정보
const SEARCH_STRATEGIES = [
  {
    id: 'historical',
    name: '역사적 원기재 문헌',
    description: '학명만으로 검색 (Korea 키워드 없이)',
    yearRange: '1700-1970',
    purpose: '종의 최초 기재 논문 및 초기 기록 찾기',
    sources: ['BHL'],
    recommended: false,
  },
  {
    id: 'korea',
    name: '한국 기록 문헌',
    description: '학명 + 한국 키워드로 검색',
    yearRange: '전체',
    purpose: '한국에서의 채집/서식 기록 찾기',
    sources: ['Semantic Scholar', 'BHL', 'ScienceON'],
    recommended: false,
  },
  {
    id: 'both',
    name: '통합 검색',
    description: '두 전략 모두 실행',
    yearRange: '전체',
    purpose: '원기재 문헌과 한국 기록을 모두 찾기',
    sources: ['BHL', 'Semantic Scholar', 'ScienceON', 'OpenAlex'],
    recommended: true,
  },
];

// 한국 관련 키워드 (카테고리별)
const KOREA_KEYWORDS = {
  '영문 표기': ['Korea', 'Korean', 'Corea', 'Corean', 'Koria'],
  '한글 표기': ['한국', '조선', '대한민국', '남한'],
  '일본어 표기': ['朝鮮', 'ちょうせん', 'チョウセン', 'Chosen', 'Tyosen'],
  '해역/수역': ['Korean waters', 'Korea Strait', 'East Sea', 'Yellow Sea', 'Sea of Japan'],
  '역사적 지명': ['Quelpart', 'Dagelet', 'Chemulpo', 'Fuzan', 'Jinsen'],
  '현대 지명': ['Busan', 'Jeju', 'Dokdo', 'Ulleungdo', 'Incheon', 'Pohang'],
};

// 워크플로우 단계
const WORKFLOW_STEPS = [
  { step: 1, name: '학명 입력', description: '엑셀 업로드 또는 직접 입력' },
  { step: 2, name: '이명 조사', description: 'WoRMS API로 동의어 추출' },
  { step: 3, name: '문헌 수집', description: '여러 소스에서 PDF 자동 다운로드' },
  { step: 4, name: '문헌 분석', description: 'Docling OCR + LLM 분석' },
  { step: 5, name: '사람+AI 검토', description: '분석 결과 확인/수정' },
  { step: 6, name: '최초 기록 판정', description: '연도순 정렬 → 확정' },
  { step: 7, name: '결과 다운로드', description: '엑셀 + PDF 묶음 (ZIP)' },
];

// OpenRouter 무료 모델 목록
const OPENROUTER_FREE_MODELS = [
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1', description: '추론 특화' },
  { id: 'qwen/qwq-32b:free', name: 'Qwen QWQ 32B', description: '범용 32B' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', description: 'Google 최신' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', description: 'Meta 70B' },
];

export default function Dashboard() {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [sourceConfigs, setSourceConfigs] = useState<SourceConfig[]>([]);
  const [savingSource, setSavingSource] = useState<string | null>(null);

  // Rate Limit 상태 조회
  useEffect(() => {
    const fetchRateLimitStatus = async () => {
      try {
        const response = await fetch('/api/llm/usage');
        if (response.ok) {
          const data = await response.json();
          setRateLimitStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch rate limit status:', error);
      }
    };
    fetchRateLimitStatus();
  }, []);

  // 소스 설정 조회
  useEffect(() => {
    const fetchSourceConfigs = async () => {
      try {
        const response = await fetch('/api/literature/sources');
        if (response.ok) {
          const data = await response.json();
          setSourceConfigs(data.configs);
        }
      } catch (error) {
        console.error('Failed to fetch source configs:', error);
      }
    };
    fetchSourceConfigs();
  }, []);

  // 소스 활성화/비활성화 토글
  const toggleSource = async (source: string, enabled: boolean) => {
    setSavingSource(source);
    try {
      const response = await fetch('/api/literature/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, enabled }),
      });
      if (response.ok) {
        const data = await response.json();
        setSourceConfigs(data.configs);
      }
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
    setSavingSource(null);
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'done': return 'default';
      case 'in-progress': return 'secondary';
      case 'planned': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done': return '완료';
      case 'in-progress': return '진행 중';
      case 'planned': return '계획됨';
      default: return status;
    }
  };

  const totalItems = PROJECT_STATUS.flatMap(p => p.items).length;
  const doneItems = PROJECT_STATUS.flatMap(p => p.items).filter(i => i.status === 'done').length;
  const progressPercent = Math.round((doneItems / totalItems) * 100);

  return (
    <div className="flex flex-col min-h-full">
      <div className="max-w-6xl mx-auto w-full px-6 py-8 flex-1">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                홈으로
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">프로젝트 대시보드</h1>
              <p className="text-sm text-muted-foreground">개발 현황 및 설정</p>
            </div>
          </div>
        </div>

        {/* 진행 상황 요약 */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              전체 진행률
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={progressPercent} className="flex-1" />
              <span className="text-sm font-medium">{progressPercent}%</span>
            </div>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="text-green-600">✓ {doneItems} 완료</span>
              <span className="text-amber-600">
                ○ {PROJECT_STATUS.flatMap(p => p.items).filter(i => i.status === 'in-progress').length} 진행 중
              </span>
              <span className="text-muted-foreground">
                ○ {PROJECT_STATUS.flatMap(p => p.items).filter(i => i.status === 'planned').length} 예정
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 탭 */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">개발 현황</span>
            </TabsTrigger>
            <TabsTrigger value="strategy" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">검색 전략</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">문헌 소스</span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="gap-2">
              <Route className="h-4 w-4" />
              <span className="hidden sm:inline">워크플로우</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">설정</span>
            </TabsTrigger>
          </TabsList>

          {/* 개발 현황 탭 */}
          <TabsContent value="overview" className="space-y-4">
            {/* Rate Limit 상태 */}
            {rateLimitStatus && (
              <Card className={rateLimitStatus.isExceeded ? 'border-destructive' : rateLimitStatus.isWarning ? 'border-amber-500' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">OpenRouter 사용량</CardTitle>
                  <CardDescription>무료 모델 일일 1,000회 제한</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Progress
                      value={(rateLimitStatus.used / rateLimitStatus.limit) * 100}
                      className={rateLimitStatus.isExceeded ? 'bg-red-100' : rateLimitStatus.isWarning ? 'bg-amber-100' : ''}
                    />
                    <div className="flex justify-between text-sm">
                      <span>{rateLimitStatus.used} / {rateLimitStatus.limit}회</span>
                      <span className="text-muted-foreground">
                        리셋: {new Date(rateLimitStatus.resetsAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </span>
                    </div>
                    {rateLimitStatus.isWarning && !rateLimitStatus.isExceeded && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        ⚠️ 90% 도달
                      </Badge>
                    )}
                    {rateLimitStatus.isExceeded && (
                      <Badge variant="destructive">⛔ 소진됨</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 프로젝트 단계별 상태 */}
            {PROJECT_STATUS.map((phase, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{phase.phase}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {phase.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Badge variant={getStatusVariant(item.status)} className="w-16 justify-center">
                          {getStatusLabel(item.status)}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 무료 모델 목록 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">OpenRouter 무료 모델</CardTitle>
                <CardDescription>$10 충전 시 하루 1,000회 무료 사용</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {OPENROUTER_FREE_MODELS.map((model) => (
                    <div key={model.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{model.id}</code>
                      <span className="font-medium text-sm">{model.name}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 검색 전략 탭 */}
          <TabsContent value="strategy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">검색 전략</CardTitle>
                <CardDescription>
                  오래된 문헌에는 "Korea"가 아닌 다른 표기(朝鮮, Chosen, Corea 등)가 사용되었습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {SEARCH_STRATEGIES.map((strategy) => (
                    <Card key={strategy.id} className={strategy.recommended ? 'border-green-500 bg-green-50/50' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{strategy.name}</CardTitle>
                          {strategy.recommended && (
                            <Badge className="bg-green-600">권장</Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">{strategy.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">연도 범위</span>
                          <span>{strategy.yearRange}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">목적</span>
                          <span className="text-right">{strategy.purpose}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {strategy.sources.map((src) => (
                            <Badge key={src} variant="outline" className="text-xs">
                              {src}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 한국 키워드 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">한국 관련 키워드 (80+ 키워드)</CardTitle>
                <CardDescription>
                  한국을 지칭하는 다양한 역사적, 언어적 표기를 모두 검색합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(KOREA_KEYWORDS).map(([category, keywords]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-sm">{category}</h4>
                      <div className="flex flex-wrap gap-1">
                        {keywords.map((kw) => (
                          <Badge key={kw} variant="secondary" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 문헌 소스 탭 */}
          <TabsContent value="sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">문헌 소스 현황</CardTitle>
                <CardDescription>
                  역사적 최초 기록에는 BHL, J-STAGE가 필수이고,
                  기후 변화로 인한 신규 기록에는 KCI, ScienceON을 활용합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        역사적 최초 기록 (1800년대~)
                      </h4>
                      <div className="grid gap-2">
                        {[
                          { name: 'BHL', desc: 'Biodiversity Heritage Library', coverage: '1800~1970' },
                          { name: 'J-STAGE', desc: '일본 과학기술진흥기구', coverage: '1880~현재' },
                          { name: 'CiNii', desc: '일본 학술정보', coverage: '메이지~현재' },
                        ].map((src) => (
                          <div key={src.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div>
                              <span className="font-medium text-sm">{src.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{src.desc}</span>
                            </div>
                            <Badge variant="outline">{src.coverage}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">한국 논문 / 신규 기록</h4>
                      <div className="grid gap-2">
                        {[
                          { name: 'ScienceON', desc: 'KISTI 통합 (논문/특허/보고서)', coverage: '2억+ 논문' },
                          { name: 'OpenAlex', desc: '현대 논문 주력', coverage: '2억+ 논문' },
                          { name: 'KCI', desc: '한국학술지인용색인', coverage: '1998~현재' },
                          { name: 'RISS', desc: '학술연구정보서비스', coverage: '학위논문' },
                        ].map((src) => (
                          <div key={src.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div>
                              <span className="font-medium text-sm">{src.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{src.desc}</span>
                            </div>
                            <Badge variant="outline">{src.coverage}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">보조 데이터 (참고용)</h4>
                      <div className="grid gap-2">
                        {[
                          { name: 'GBIF', desc: '표본 데이터', coverage: '전 세계' },
                          { name: 'OBIS', desc: '해양생물 분포', coverage: '해양 전문' },
                          { name: 'Semantic Scholar', desc: '영문 논문 백업', coverage: '2000년대~' },
                        ].map((src) => (
                          <div key={src.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div>
                              <span className="font-medium text-sm">{src.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{src.desc}</span>
                            </div>
                            <Badge variant="secondary">{src.coverage}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 워크플로우 탭 */}
          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">워크플로우</CardTitle>
                <CardDescription>학명 입력부터 최초 기록 판정까지의 과정</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {WORKFLOW_STEPS.map((step, idx) => (
                    <div key={step.step} className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="font-medium">{step.name}</div>
                        <div className="text-sm text-muted-foreground">{step.description}</div>
                      </div>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <div className="w-8 flex justify-center">
                          <div className="w-0.5 h-12 bg-border -mt-2" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="space-y-2">
                  <h4 className="font-medium">핵심 포인트</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong className="text-foreground">자동 수집</strong>: 가능한 모든 소스에서 PDF 자동 다운로드</li>
                    <li><strong className="text-foreground">AI 분석</strong>: Docling OCR + LLM으로 한국 기록 여부 자동 판정</li>
                    <li><strong className="text-foreground">사람 검토</strong>: AI 분석 결과를 사람이 확인/수정</li>
                    <li><strong className="text-foreground">결과 출력</strong>: 엑셀 + 관련 PDF를 ZIP으로 묶어 다운로드</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 설정 탭 */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">문헌 소스 설정</CardTitle>
                <CardDescription>검색에 사용할 문헌 소스를 선택합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sourceConfigs.map((config) => (
                    <div
                      key={config.source}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        config.enabled ? 'bg-green-50/50 border-green-200' : 'bg-muted/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={config.source} className="font-medium">
                            {config.name}
                          </Label>
                          {config.requiresApiKey && (
                            <Badge variant="outline" className="text-xs">
                              API 키 필요
                            </Badge>
                          )}
                          {savingSource === config.source && (
                            <Badge variant="secondary" className="text-xs">
                              저장 중...
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                        {config.requiresApiKey && config.apiKeyEnvVar && (
                          <code className="text-xs text-muted-foreground">
                            환경변수: {config.apiKeyEnvVar}
                          </code>
                        )}
                      </div>
                      <Switch
                        id={config.source}
                        checked={config.enabled}
                        onCheckedChange={(checked) => toggleSource(config.source, checked)}
                        disabled={savingSource === config.source}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">참고</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong>OpenAlex</strong>: 현대 논문 검색의 주력 소스 (2억+ 논문, 무료)</li>
                    <li><strong>ScienceON</strong>: 논문/특허/보고서 통합 검색</li>
                    <li>설정은 서버 재시작 시 초기화됩니다.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
