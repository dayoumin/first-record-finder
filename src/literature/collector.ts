/**
 * 문헌 수집기 (Literature Collector)
 *
 * 여러 소스에서 문헌을 검색하고, PDF를 다운로드하고, 분석하는 통합 모듈
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LiteratureSource,
  LiteratureItem,
  LiteratureSearchRequest,
  LiteratureSearchResult,
  CollectionProgress,
  SourceError,
  ILiteratureClient,
  LiteratureSourceConfig,
  DEFAULT_SOURCE_CONFIGS,
} from './types';
import { BhlClient } from './bhl-client';
import { SemanticScholarClient } from './semantic-client';
import { OpenAlexClient } from './openalex-client';
import { JStageClient } from './jstage-client';
import { CiNiiClient } from './cinii-client';
import { GBIFClient } from './gbif-client';
import { OBISClient } from './obis-client';
import { KciClient } from './kci-client';
import { RissClient } from './riss-client';

// PDF 저장 디렉토리
const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');
const RESULTS_DIR = path.join(process.cwd(), 'data', 'results');

/**
 * 소스별 클라이언트
 *
 * 문헌 검색 소스 역할:
 * - 역사적 최초 기록 (1800년대~): BHL, J-STAGE, CiNii
 * - 현대 영문 논문: OpenAlex (주력), Semantic Scholar (백업)
 * - 기후 변화로 인한 최근 신규 기록: KCI, RISS (한국 논문)
 * - 생물다양성 기록 데이터: GBIF, OBIS
 */
const clients: Record<LiteratureSource, ILiteratureClient | null> = {
  bhl: new BhlClient(),           // 역사적 문헌 (1800년대~)
  semantic: new SemanticScholarClient(),  // 현대 영문 논문 (백업)
  openalex: new OpenAlexClient(), // 현대 영문 논문 (주력, 2억+ 논문)
  jstage: new JStageClient(),     // 일본 논문 (일제강점기 자료)
  cinii: new CiNiiClient(),       // 일본 학술정보
  gbif: new GBIFClient(),         // 생물다양성 기록
  obis: new OBISClient(),         // 해양생물 분포
  kci: new KciClient(),           // 한국 학술지 (기후 변화 신규 기록)
  riss: new RissClient(),         // 한국 학위논문 (기후 변화 신규 기록)
  manual: null,                   // 수동 업로드용 (클라이언트 불필요)
};

// 소스 설정 (로컬 스토리지 또는 설정 파일에서 로드)
let sourceConfigs: LiteratureSourceConfig[] = [...DEFAULT_SOURCE_CONFIGS];

/**
 * 소스 설정 로드
 */
export function getSourceConfigs(): LiteratureSourceConfig[] {
  return sourceConfigs;
}

/**
 * 소스 설정 업데이트
 */
export function updateSourceConfig(source: LiteratureSource, enabled: boolean): void {
  const config = sourceConfigs.find(c => c.source === source);
  if (config) {
    config.enabled = enabled;
  }
}

/**
 * 활성화된 소스만 반환
 */
export function getEnabledSources(): LiteratureSource[] {
  return sourceConfigs
    .filter(c => c.enabled && clients[c.source] !== null)
    .map(c => c.source);
}

/**
 * 디렉토리 생성
 */
function ensureDirectories() {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * 파일명 안전하게 변환
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

/**
 * 여러 소스에서 문헌 검색
 *
 * 검색 전략:
 * 1. 원기재 문헌 검색: 학명만으로 검색 (1700-1950년, Korea 키워드 없이)
 * 2. 한국 기록 문헌 검색: 학명 + Korea로 검색 (모든 연도)
 */
export async function searchLiterature(
  request: LiteratureSearchRequest,
  onProgress?: (progress: CollectionProgress) => void
): Promise<LiteratureSearchResult> {
  ensureDirectories();

  const { scientificName, synonyms, sources, yearFrom, yearTo, maxResults = 20, searchStrategy = 'both' } = request;

  // 검색할 소스 결정 (기본: 활성화된 소스 사용)
  const targetSources: LiteratureSource[] = sources || getEnabledSources();

  const allItems: LiteratureItem[] = [];
  const errors: SourceError[] = [];

  // 검색어 목록 (유효명 + 이명)
  const searchTerms = [scientificName, ...synonyms];

  // 검색 전략 구성
  type StrategyConfig = {
    name: string;
    includeKoreaKeyword: boolean;
    yearFrom?: number;
    yearTo?: number;
    description: string;
  };

  const searchStrategies: StrategyConfig[] = [];

  if (searchStrategy === 'historical' || searchStrategy === 'both') {
    searchStrategies.push({
      name: 'historical',
      includeKoreaKeyword: false,
      yearFrom: yearFrom || 1700,
      yearTo: yearTo || 1970,
      description: '역사적 원기재 문헌 (1700-1970)'
    });
  }

  if (searchStrategy === 'korea' || searchStrategy === 'both') {
    searchStrategies.push({
      name: 'korea_records',
      includeKoreaKeyword: true,
      yearFrom: yearFrom,
      yearTo: yearTo,
      description: '한국 기록 문헌'
    });
  }

  console.log(`[Collector] Search strategy: ${searchStrategy}`);
  console.log(`[Collector] Active strategies: ${searchStrategies.map(s => s.name).join(', ')}`);

  let searched = 0;
  const totalSearches = targetSources.length * searchTerms.length * searchStrategies.length;

  for (const source of targetSources) {
    const client = clients[source];

    if (!client) {
      console.warn(`[Collector] No client for source: ${source}`);
      continue;
    }

    for (const strategy of searchStrategies) {
      console.log(`[Collector] Strategy: ${strategy.description}`);

      for (const term of searchTerms) {
        try {
          onProgress?.({
            phase: 'searching',
            currentSource: source,
            currentItem: `${term} (${strategy.name})`,
            searched,
            downloaded: 0,
            analyzed: 0,
            total: totalSearches,
            errors: [],
          });

          const items = await client.search(term, {
            yearFrom: strategy.yearFrom,
            yearTo: strategy.yearTo,
            maxResults: Math.ceil(maxResults / (searchTerms.length * searchStrategies.length)),
            includeKoreaKeyword: strategy.includeKoreaKeyword,
          });

          // 중복 제거 (같은 제목 + 연도)
          for (const item of items) {
            const isDuplicate = allItems.some(
              existing =>
                existing.title.toLowerCase() === item.title.toLowerCase() &&
                existing.year === item.year
            );

            if (!isDuplicate) {
              allItems.push(item);
            }
          }

          searched++;
        } catch (error) {
          console.error(`[Collector] Error searching ${source} for "${term}" (${strategy.name}):`, error);
          errors.push({
            source,
            error: error instanceof Error ? error.message : 'Search failed',
          });
          searched++;
        }
      }
    }
  }

  // 연도순 정렬 (오래된 것 먼저 - 최초 기록 찾기)
  allItems.sort((a, b) => (a.year || 9999) - (b.year || 9999));

  // 결과 수 제한
  const limitedItems = allItems.slice(0, maxResults);

  // 결과 저장
  const resultPath = path.join(
    RESULTS_DIR,
    `search_${sanitizeFilename(scientificName)}_${Date.now()}.json`
  );

  fs.writeFileSync(resultPath, JSON.stringify({
    request,
    result: {
      scientificName,
      totalFound: limitedItems.length,
      items: limitedItems,
      errors,
    },
    searchedAt: new Date().toISOString(),
  }, null, 2));

  return {
    scientificName,
    totalFound: limitedItems.length,
    items: limitedItems,
    errors,
  };
}

/**
 * 검색된 문헌의 PDF 다운로드
 */
export async function downloadPdfs(
  items: LiteratureItem[],
  onProgress?: (progress: CollectionProgress) => void
): Promise<LiteratureItem[]> {
  ensureDirectories();

  const updatedItems = [...items];
  let downloaded = 0;

  for (let i = 0; i < updatedItems.length; i++) {
    const item = updatedItems[i];

    // 이미 다운로드됨
    if (item.pdfDownloaded && item.pdfPath && fs.existsSync(item.pdfPath)) {
      downloaded++;
      continue;
    }

    // PDF URL 없음
    if (!item.pdfUrl) {
      continue;
    }

    const client = clients[item.source];
    if (!client) {
      continue;
    }

    onProgress?.({
      phase: 'downloading',
      currentSource: item.source,
      currentItem: item.title,
      searched: items.length,
      downloaded,
      analyzed: 0,
      total: items.length,
      errors: [],
    });

    // 파일명 생성
    const filename = `${item.source}_${item.year || 'unknown'}_${sanitizeFilename(item.title)}.pdf`;
    const destPath = path.join(PDF_DIR, filename);

    const result = await client.downloadPdf(item, destPath);

    if (result.success && result.pdfPath) {
      updatedItems[i] = {
        ...item,
        pdfDownloaded: true,
        pdfPath: result.pdfPath,
      };
      downloaded++;
    }
  }

  return updatedItems;
}

/**
 * 전체 수집 프로세스 실행
 * (검색 → 다운로드 → 분석 준비)
 */
export async function collectLiterature(
  request: LiteratureSearchRequest,
  onProgress?: (progress: CollectionProgress) => void
): Promise<LiteratureSearchResult> {
  // 1. 검색
  const searchResult = await searchLiterature(request, onProgress);

  // 2. PDF 다운로드
  const itemsWithPdf = await downloadPdfs(searchResult.items, onProgress);

  // 결과 업데이트
  searchResult.items = itemsWithPdf;

  // 완료 콜백
  onProgress?.({
    phase: 'completed',
    searched: searchResult.items.length,
    downloaded: searchResult.items.filter(i => i.pdfDownloaded).length,
    analyzed: 0,
    total: searchResult.items.length,
    errors: searchResult.errors.map(e => `${e.source}: ${e.error}`),
  });

  return searchResult;
}

/**
 * 저장된 검색 결과 로드
 */
export function loadSearchResult(scientificName: string): LiteratureSearchResult | null {
  ensureDirectories();

  const prefix = `search_${sanitizeFilename(scientificName)}_`;
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  const latestFile = path.join(RESULTS_DIR, files[0]);
  const data = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));

  return data.result as LiteratureSearchResult;
}

/**
 * 사용 가능한 소스 목록
 */
export function getAvailableSources(): LiteratureSource[] {
  return (Object.keys(clients) as LiteratureSource[])
    .filter(source => clients[source] !== null);
}
