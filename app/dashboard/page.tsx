'use client';

import { useState, useEffect } from 'react';

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

// 프로젝트 진행 상태 타입
interface ProjectStatus {
  phase: string;
  items: StatusItem[];
}

interface StatusItem {
  name: string;
  status: 'done' | 'in-progress' | 'planned' | 'not-started';
  description: string;
  link?: string;
}

// 문헌 소스 정보
interface LiteratureSource {
  name: string;
  type: 'api' | 'mcp' | 'scraper' | 'manual';
  coverage: string;
  status: 'available' | 'planned' | 'limited';
  notes: string;
  url?: string;
}

const PROJECT_STATUS: ProjectStatus[] = [
  {
    phase: '1. 핵심 기능',
    items: [
      { name: 'WoRMS API 이명 추출', status: 'done', description: '학명으로 모든 이명 조회' },
      { name: '검색 URL 생성', status: 'done', description: 'Google Scholar, KCI 링크 자동 생성' },
      { name: 'PDF 텍스트 추출', status: 'done', description: 'Docling OCR 연동' },
      { name: 'LLM 문헌 분석', status: 'done', description: 'Ollama, OpenRouter 무료 모델 등 지원' },
      { name: 'Rate Limit 관리', status: 'done', description: 'OpenRouter 무료 모델 일일 1,000회 제한, 900회 경고' },
      { name: '엑셀 내보내기', status: 'done', description: '3개 시트로 결과 출력' },
    ],
  },
  {
    phase: '2. 문헌 자동 수집',
    items: [
      { name: 'BHL API', status: 'done', description: '역사적 문헌 (1800년대~), API 키 필요' },
      { name: 'Semantic Scholar API', status: 'done', description: '최신 학술 논문 검색' },
      { name: '검색 전략 시스템', status: 'done', description: 'historical / korea / both 전략' },
      { name: '한국 키워드 확장', status: 'done', description: '80+ 키워드 (식민지 시대 포함)' },
      { name: 'J-STAGE API', status: 'done', description: '일본 논문 (일제강점기 포함)' },
      { name: 'CiNii API', status: 'done', description: '일본 학술정보' },
      { name: 'GBIF API', status: 'done', description: '표본 데이터 검증' },
      { name: 'OBIS API', status: 'done', description: '해양생물 분포 데이터' },
      { name: 'KCI API', status: 'done', description: '한국 학술지 (공공데이터포털 API)' },
      { name: 'RISS API', status: 'done', description: '한국 학위논문 (공공데이터포털 API)' },
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

// 문헌 소스 정보 - 구현 상태 포함
interface LiteratureSourceExtended extends LiteratureSource {
  implemented: boolean;
  useCase: string;
  cost: string;
  limitations?: string;
}

const LITERATURE_SOURCES_EXTENDED: LiteratureSourceExtended[] = [
  // === 구현 완료 ===
  {
    name: 'BHL (Biodiversity Heritage Library)',
    type: 'api',
    coverage: '역사적 문헌 (1800~1970)',
    status: 'available',
    notes: '✅ 구현됨 | API 키 필수 | 스캔 PDF 제공',
    url: 'https://www.biodiversitylibrary.org/api3',
    implemented: true,
    useCase: '최초 기록 찾기의 핵심 소스. 1800년대 원기재 논문 검색에 필수',
    cost: '무료 (API 키 발급 필요)',
    limitations: 'API 키 필수, 일부 PDF 품질 낮음',
  },
  {
    name: 'Semantic Scholar',
    type: 'api',
    coverage: '영문 학술 논문 (주로 2000년대~)',
    status: 'available',
    notes: '✅ 구현됨 | API 키 선택 | Rate limit 있음',
    url: 'https://api.semanticscholar.org/',
    implemented: true,
    useCase: '최신 논문 검색. 한국 기록 확인용 보조 소스',
    cost: '무료 (API 키 있으면 rate limit 완화)',
    limitations: '역사적 문헌 거의 없음, Rate limit으로 느림',
  },
  // === 구현 완료 (일본 문헌) ===
  {
    name: 'J-STAGE',
    type: 'api',
    coverage: '일본 논문 (1880~현재)',
    status: 'available',
    notes: '✅ 구현됨 | 일본과학기술진흥기구 운영',
    url: 'https://www.jstage.jst.go.jp/',
    implemented: true,
    useCase: '일제강점기(1910-1945) 일본어 논문 검색에 필수',
    cost: '무료 API',
  },
  {
    name: 'CiNii',
    type: 'api',
    coverage: '일본 학술정보 (메이지~현재)',
    status: 'available',
    notes: '✅ 구현됨 | NII(일본국립정보학연구소) 운영',
    url: 'https://cir.nii.ac.jp/',
    implemented: true,
    useCase: '일본 학술지, 학위논문 검색. J-STAGE 보완',
    cost: '무료 API',
  },
  // === 구현 완료 (표본/분포 데이터) ===
  {
    name: 'GBIF (Global Biodiversity Information Facility)',
    type: 'api',
    coverage: '전 세계 표본 데이터',
    status: 'available',
    notes: '✅ 구현됨 | 표본 채집 기록 | 무료',
    url: 'https://www.gbif.org/',
    implemented: true,
    useCase: '표본 데이터로 문헌 기록 검증. 때로는 문헌보다 오래된 표본 발견',
    cost: '무료',
  },
  {
    name: 'OBIS (Ocean Biodiversity Information System)',
    type: 'api',
    coverage: '해양생물 분포 데이터',
    status: 'available',
    notes: '✅ 구현됨 | 해양생물 전문 | 무료',
    url: 'https://obis.org/',
    implemented: true,
    useCase: '해양생물 분포 기록 확인. GBIF 보완',
    cost: '무료',
  },
  // === 낮은 우선순위 ===
  {
    name: 'Paper Search MCP',
    type: 'mcp',
    coverage: '13개 플랫폼 통합 (Google Scholar 포함)',
    status: 'limited',
    notes: '⚠️ 낮은 우선순위 | MCP 서버 | 오픈소스',
    url: 'https://github.com/openags/paper-search-mcp',
    implemented: false,
    useCase: 'Google Scholar 직접 스크래핑 불가 → MCP로 우회',
    cost: '무료 (오픈소스)',
    limitations: 'MCP 서버 설치 필요, 다른 소스로 대부분 커버',
  },
  // === 한국 논문 (기후 변화 신규 기록용) ===
  {
    name: 'KCI (한국학술지인용색인)',
    type: 'api',
    coverage: '한국 학술지 (1998~현재)',
    status: 'available',
    notes: '✅ 구현됨 | 공공데이터포털 API | 기후 변화 신규 기록 검색',
    url: 'https://www.kci.go.kr/',
    implemented: true,
    useCase: '기후 변화로 인한 최근 한국 신규 기록 검색. 역사적 최초 기록에는 부적합',
    cost: '무료 (API 키 발급 필요)',
    limitations: 'PDF 직접 다운로드 미지원, 1998년 이후 자료만',
  },
  {
    name: 'RISS (학술연구정보서비스)',
    type: 'api',
    coverage: '한국 학위논문, 학술지',
    status: 'available',
    notes: '✅ 구현됨 | 공공데이터포털 API | 기후 변화 신규 기록 검색',
    url: 'https://www.riss.kr/',
    implemented: true,
    useCase: '기후 변화로 인한 최근 한국 신규 기록 검색. 학위논문 포함',
    cost: '무료 (API 키 발급 필요)',
    limitations: '일부 PDF 로그인 필요',
  },
  // === 수동 업로드 ===
  {
    name: 'DBpia / KISS / 교보문고',
    type: 'manual',
    coverage: '한국 유료 학술지',
    status: 'limited',
    notes: '수동 업로드 | 유료 구독 필요',
    url: 'https://www.dbpia.co.kr/',
    implemented: false,
    useCase: '유료 DB는 직접 다운로드 후 수동 업로드',
    cost: '유료 구독',
    limitations: '자동화 불가, 수동 업로드만 가능',
  },
];

// 기존 형식 유지 (호환성)
const LITERATURE_SOURCES: LiteratureSource[] = LITERATURE_SOURCES_EXTENDED;

const WORKFLOW_STEPS = [
  { step: 1, name: '학명 입력', description: '엑셀 업로드 또는 직접 입력', icon: '1' },
  { step: 2, name: '이명 조사', description: 'WoRMS API로 동의어 추출', icon: '2' },
  { step: 3, name: '문헌 수집', description: '여러 소스에서 PDF 자동 다운로드', icon: '3' },
  { step: 4, name: '문헌 분석', description: 'Docling OCR + LLM 분석', icon: '4' },
  { step: 5, name: '사람+AI 검토', description: '분석 결과 확인/수정', icon: '5' },
  { step: 6, name: '최초 기록 판정', description: '연도순 정렬 → 확정', icon: '6' },
  { step: 7, name: '결과 다운로드', description: '엑셀 + PDF 묶음 (ZIP)', icon: '7' },
];

// 검색 전략 정보
const SEARCH_STRATEGIES = [
  {
    id: 'historical',
    name: '역사적 원기재 문헌',
    description: '학명만으로 검색 (Korea 키워드 없이)',
    yearRange: '1700-1970',
    purpose: '종의 최초 기재 논문 및 초기 기록 찾기',
    sources: ['BHL (Biodiversity Heritage Library)'],
    note: '오래된 문헌에는 "Korea"가 아닌 다른 표기 사용',
  },
  {
    id: 'korea',
    name: '한국 기록 문헌',
    description: '학명 + 한국 키워드로 검색',
    yearRange: '전체',
    purpose: '한국에서의 채집/서식 기록 찾기',
    sources: ['Semantic Scholar', 'BHL'],
    note: '80+ 키워드로 다양한 표기 커버',
  },
  {
    id: 'both',
    name: '통합 검색 (권장)',
    description: '두 전략 모두 실행',
    yearRange: '전체',
    purpose: '원기재 문헌과 한국 기록을 모두 찾기',
    sources: ['BHL', 'Semantic Scholar'],
    note: '가장 포괄적인 결과',
  },
];

// 한국 관련 키워드 (카테고리별)
const KOREA_KEYWORDS_CATEGORIZED = {
  english: {
    title: '영문 표기',
    keywords: ['Korea', 'Korean', 'Corea', 'Corean', 'Koria'],
    note: 'Corea는 1900년대 초반까지 사용',
  },
  korean: {
    title: '한글 표기',
    keywords: ['한국', '조선', '대한민국', '남한'],
    note: '조선은 일제강점기 및 그 이전 사용',
  },
  japanese: {
    title: '일본어 표기 (식민지 시대)',
    keywords: ['朝鮮', 'ちょうせん', 'チョウセン', 'Chosen', 'Tyosen'],
    note: '1910-1945 일제강점기 문헌에서 사용',
  },
  japaneseLocations: {
    title: '일본식 지명 (한자)',
    keywords: ['鬱陵島', '済州', '釜山', '仁川', '元山', '鎮海', '馬山'],
    note: '일본 문헌에서 한국 지명 표기',
  },
  seas: {
    title: '해역/수역',
    keywords: ['Korean waters', 'Korean seas', 'Korea Strait', 'East Sea', 'Yellow Sea', 'South Sea', '日本海', '黄海', '朝鮮海峡', 'Sea of Japan', 'Tsushima Strait'],
    note: '동해는 "Sea of Japan"으로도 표기됨',
  },
  historicalPlaces: {
    title: '서양 고명 (Historical)',
    keywords: ['Quelpart', 'Dagelet', 'Chemulpo'],
    note: 'Quelpart=제주, Dagelet=울릉도, Chemulpo=인천',
  },
  colonialPlaces: {
    title: '일본식 로마자 지명',
    keywords: ['Fuzan', 'Jinsen', 'Genzan', 'Kunsan', 'Saishu'],
    note: 'Fuzan=부산, Jinsen=인천, Genzan=원산',
  },
  modernPlaces: {
    title: '현대 지명 (영문)',
    keywords: ['Busan', 'Pusan', 'Jeju', 'Cheju', 'Dokdo', 'Ulleungdo', 'Incheon', 'Pohang', 'Tongyeong', 'Yeosu', 'Mokpo', 'Gunsan', 'Sokcho', 'Wonsan'],
    note: '현대 영문 표기',
  },
  koreanPlaces: {
    title: '현대 지명 (한글)',
    keywords: ['부산', '제주', '독도', '울릉도', '인천', '포항', '통영', '여수', '목포', '군산', '속초', '원산', '진해', '마산'],
    note: '주요 연안 도시',
  },
};

// OpenRouter 무료 모델 목록
const OPENROUTER_FREE_MODELS = [
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1', description: '추론 특화, 긴 컨텍스트' },
  { id: 'qwen/qwq-32b:free', name: 'Qwen QWQ 32B', description: '범용 32B, 빠름' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', description: 'Google 최신, 빠름' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', description: 'Meta 70B, 정확도 높음' },
  { id: 'xiaomi/mimo-v2-flash:free', name: 'MiMo V2 Flash', description: '경량, 빠른 응답' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'workflow' | 'strategy' | 'settings'>('overview');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return '#22c55e';
      case 'in-progress': return '#f59e0b';
      case 'planned': return '#3b82f6';
      case 'available': return '#22c55e';
      case 'limited': return '#f59e0b';
      default: return '#9ca3af';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done': return '완료';
      case 'in-progress': return '진행 중';
      case 'planned': return '계획됨';
      case 'not-started': return '미시작';
      case 'available': return '사용 가능';
      case 'limited': return '제한적';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'api': return 'REST API';
      case 'mcp': return 'MCP';
      case 'scraper': return '스크래핑';
      case 'manual': return '수동';
      default: return type;
    }
  };

  return (
    <div className="dashboard">
      <header>
        <div className="header-content">
          <h1>First Record Finder</h1>
          <p>한국 수산생물 최초기록 문헌 검색 시스템</p>
        </div>
        <nav className="tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            개발 현황
          </button>
          <button
            className={activeTab === 'strategy' ? 'active' : ''}
            onClick={() => setActiveTab('strategy')}
          >
            검색 전략
          </button>
          <button
            className={activeTab === 'sources' ? 'active' : ''}
            onClick={() => setActiveTab('sources')}
          >
            문헌 소스
          </button>
          <button
            className={activeTab === 'workflow' ? 'active' : ''}
            onClick={() => setActiveTab('workflow')}
          >
            워크플로우
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ 설정
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'overview' && (
          <div className="overview">
            <div className="summary-cards">
              <div className="card">
                <div className="card-value">
                  {PROJECT_STATUS.flatMap(p => p.items).filter(i => i.status === 'done').length}
                </div>
                <div className="card-label">완료</div>
              </div>
              <div className="card">
                <div className="card-value">
                  {PROJECT_STATUS.flatMap(p => p.items).filter(i => i.status === 'in-progress').length}
                </div>
                <div className="card-label">진행 중</div>
              </div>
              <div className="card">
                <div className="card-value">
                  {PROJECT_STATUS.flatMap(p => p.items).filter(i => i.status === 'planned' || i.status === 'not-started').length}
                </div>
                <div className="card-label">예정</div>
              </div>
            </div>

            {PROJECT_STATUS.map((phase, idx) => (
              <section key={idx} className="phase-section">
                <h2>{phase.phase}</h2>
                <div className="items-list">
                  {phase.items.map((item, i) => (
                    <div key={i} className="status-item">
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(item.status) }}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                      <div className="item-content">
                        <span className="item-name">{item.name}</span>
                        <span className="item-desc">{item.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Rate Limit 상태 */}
            {rateLimitStatus && (
              <section className="phase-section rate-limit-section">
                <h2>OpenRouter 무료 모델 사용량</h2>
                <div className="rate-limit-info">
                  <div className="usage-bar-container">
                    <div
                      className={`usage-bar ${rateLimitStatus.isExceeded ? 'exceeded' : rateLimitStatus.isWarning ? 'warning' : ''}`}
                      style={{ width: `${(rateLimitStatus.used / rateLimitStatus.limit) * 100}%` }}
                    />
                  </div>
                  <div className="usage-stats">
                    <span className="usage-count">
                      {rateLimitStatus.used} / {rateLimitStatus.limit}회 사용
                    </span>
                    <span className="usage-remaining">
                      남은 횟수: {rateLimitStatus.remaining}회
                    </span>
                    <span className="usage-reset">
                      리셋: {new Date(rateLimitStatus.resetsAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </span>
                  </div>
                  {rateLimitStatus.isWarning && !rateLimitStatus.isExceeded && (
                    <div className="rate-warning">⚠️ 일일 사용량 90% 도달</div>
                  )}
                  {rateLimitStatus.isExceeded && (
                    <div className="rate-exceeded">⛔ 일일 사용량 소진</div>
                  )}
                </div>
              </section>
            )}

            {/* OpenRouter 무료 모델 목록 */}
            <section className="phase-section">
              <h2>OpenRouter 무료 모델 (권장)</h2>
              <p className="section-note">$10 충전 시 하루 1,000회 무료 사용 가능 (모든 무료 모델 합산)</p>
              <div className="free-models-list">
                {OPENROUTER_FREE_MODELS.map((model) => (
                  <div key={model.id} className="free-model-item">
                    <code className="model-id">{model.id}</code>
                    <span className="model-name">{model.name}</span>
                    <span className="model-desc">{model.description}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* OCR 처리 전략 */}
            <section className="phase-section">
              <h2>스캔 문서 (OCR) 처리</h2>
              <div className="ocr-strategy">
                <p className="section-note">
                  Docling은 OCR 기능이 내장되어 스캔된 PDF도 텍스트 추출이 가능합니다.
                  추출된 텍스트의 품질을 자동으로 평가하여 분류합니다.
                </p>

                <div className="ocr-languages">
                  <p><strong>지원 언어:</strong> 영어 (eng), 한국어 (kor), 일본어 (jpn)</p>
                </div>

                <div className="ocr-quality-grid">
                  <div className="ocr-quality-item good">
                    <span className="quality-badge">양호</span>
                    <span className="quality-score">70-100점</span>
                    <span className="quality-desc">자동 분석 가능</span>
                  </div>
                  <div className="ocr-quality-item fair">
                    <span className="quality-badge">보통</span>
                    <span className="quality-score">50-69점</span>
                    <span className="quality-desc">결과 검토 권장</span>
                  </div>
                  <div className="ocr-quality-item poor">
                    <span className="quality-badge">낮음</span>
                    <span className="quality-score">30-49점</span>
                    <span className="quality-desc">수동 확인 필요</span>
                  </div>
                  <div className="ocr-quality-item manual">
                    <span className="quality-badge">수동 필요</span>
                    <span className="quality-score">0-29점</span>
                    <span className="quality-desc">LM Notebook 분석</span>
                  </div>
                </div>

                <div className="ocr-folder-info">
                  <p><strong>저장 위치:</strong></p>
                  <ul>
                    <li><code>data/pdfs/</code> - 일반 PDF (good, fair)</li>
                    <li><code>data/pdfs/ocr-needed/</code> - 수동 분석 필요 (poor, manual_needed)</li>
                  </ul>
                </div>

                <div className="ocr-test-results">
                  <p><strong>시뮬레이션 테스트 결과:</strong></p>
                  <table className="ocr-test-table">
                    <thead>
                      <tr>
                        <th>시나리오</th>
                        <th>점수</th>
                        <th>품질</th>
                        <th>감지된 이슈</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="test-good">
                        <td>현대 영문/한글 논문</td>
                        <td>100</td>
                        <td>good</td>
                        <td>없음</td>
                      </tr>
                      <tr className="test-good">
                        <td>일본어 논문 (1950년대)</td>
                        <td>80</td>
                        <td>good</td>
                        <td>텍스트 짧음</td>
                      </tr>
                      <tr className="test-good">
                        <td>BHL 역사적 문헌 (1890년대)</td>
                        <td>100</td>
                        <td>good</td>
                        <td>없음</td>
                      </tr>
                      <tr className="test-good">
                        <td>다국어 혼용 (영/한/일)</td>
                        <td>80</td>
                        <td>good</td>
                        <td>텍스트 짧음</td>
                      </tr>
                      <tr className="test-fair">
                        <td>손상된 스캔 (깨진 문자)</td>
                        <td>55</td>
                        <td>fair</td>
                        <td>깨진 문자 52개</td>
                      </tr>
                      <tr className="test-fair">
                        <td>레이아웃 깨진 2단 컬럼</td>
                        <td>60</td>
                        <td>fair</td>
                        <td>반복 패턴 감지</td>
                      </tr>
                      <tr className="test-manual">
                        <td>거의 인식 불가</td>
                        <td>5</td>
                        <td>manual</td>
                        <td>텍스트 비율 0%</td>
                      </tr>
                      <tr className="test-manual">
                        <td>빈 페이지</td>
                        <td>0</td>
                        <td>manual</td>
                        <td>단어 비율 0%</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="test-summary">41개 테스트 통과 (품질 평가 27개 + 시뮬레이션 14개)</p>
                </div>
              </div>
            </section>

            <div className="action-links">
              <a href="/" className="btn primary">검색 시작</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn">GitHub</a>
            </div>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="sources">
            <p className="intro">
              한국 수산생물 최초 기록을 찾기 위해 여러 문헌 소스를 활용합니다.
              <strong>역사적 최초 기록</strong>에는 BHL, J-STAGE가 필수이고,
              <strong>기후 변화로 인한 신규 기록</strong>에는 KCI, RISS를 활용합니다.
            </p>

            {/* 구현 상태 요약 */}
            <div className="implementation-summary">
              <div className="impl-card implemented">
                <span className="impl-count">{LITERATURE_SOURCES_EXTENDED.filter(s => s.implemented).length}</span>
                <span className="impl-label">구현 완료</span>
              </div>
              <div className="impl-card planned">
                <span className="impl-count">{LITERATURE_SOURCES_EXTENDED.filter(s => !s.implemented && s.status === 'planned').length}</span>
                <span className="impl-label">계획됨</span>
              </div>
              <div className="impl-card limited">
                <span className="impl-count">{LITERATURE_SOURCES_EXTENDED.filter(s => !s.implemented && s.status !== 'planned').length}</span>
                <span className="impl-label">수동/제한</span>
              </div>
            </div>

            {/* 상세 테이블 */}
            <table className="sources-table">
              <thead>
                <tr>
                  <th>소스</th>
                  <th>구현</th>
                  <th>커버리지</th>
                  <th>비용</th>
                  <th>활용</th>
                </tr>
              </thead>
              <tbody>
                {LITERATURE_SOURCES_EXTENDED.map((source, idx) => (
                  <tr key={idx} className={source.implemented ? 'row-implemented' : ''}>
                    <td>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.name}
                        </a>
                      ) : (
                        source.name
                      )}
                      <span className="type-badge">{getTypeLabel(source.type)}</span>
                    </td>
                    <td>
                      <span className={`impl-badge ${source.implemented ? 'done' : source.status === 'planned' ? 'planned' : 'limited'}`}>
                        {source.implemented ? '✅ 완료' : source.status === 'planned' ? '📋 계획' : '⚠️ 제한'}
                      </span>
                    </td>
                    <td className="coverage-cell">{source.coverage}</td>
                    <td className="cost-cell">{source.cost}</td>
                    <td className="usecase-cell">{source.useCase}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 현재 구현 상태 설명 */}
            <div className="source-notes">
              <h3>문헌 소스 활용 가이드</h3>
              <div className="impl-details">
                <div className="impl-section">
                  <h4>🏛️ 역사적 최초 기록 (1800년대~)</h4>
                  <ul>
                    <li><strong>BHL</strong>: 1800년대 원기재 논문 검색에 필수</li>
                    <li><strong>J-STAGE</strong>: 일제강점기 일본어 논문</li>
                    <li><strong>CiNii</strong>: 일본 학술 DB, J-STAGE 보완</li>
                  </ul>
                </div>
                <div className="impl-section">
                  <h4>🌡️ 기후 변화 신규 기록</h4>
                  <ul>
                    <li><strong>KCI</strong>: 한국 학술지 (1998~현재), 공공데이터포털 API</li>
                    <li><strong>RISS</strong>: 한국 학위논문, 공공데이터포털 API</li>
                    <li><strong>Semantic Scholar</strong>: 최신 영문 논문</li>
                  </ul>
                </div>
                <div className="impl-section">
                  <h4>📊 보조 데이터 소스</h4>
                  <ul>
                    <li><strong>GBIF</strong>: 표본 데이터로 문헌 기록 검증</li>
                    <li><strong>OBIS</strong>: 해양생물 분포 데이터</li>
                  </ul>
                </div>
                <div className="impl-section">
                  <h4>⚠️ 수동 처리 필요</h4>
                  <ul>
                    <li><strong>DBpia 등 유료 DB</strong>: 구독 필요, 수동 다운로드</li>
                    <li><strong>Paper Search MCP</strong>: 다른 소스로 대부분 커버</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="workflow">
            <div className="workflow-diagram">
              {WORKFLOW_STEPS.map((step, idx) => (
                <div key={idx} className="workflow-step">
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <div className="step-name">{step.name}</div>
                    <div className="step-desc">{step.description}</div>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && <div className="step-arrow">↓</div>}
                </div>
              ))}
            </div>

            <div className="workflow-notes">
              <h3>핵심 포인트</h3>
              <ul>
                <li><strong>자동 수집</strong>: 가능한 모든 소스에서 PDF 자동 다운로드</li>
                <li><strong>AI 분석</strong>: Docling OCR + LLM으로 한국 기록 여부 자동 판정</li>
                <li><strong>사람 검토</strong>: AI 분석 결과를 사람이 확인/수정</li>
                <li><strong>결과 출력</strong>: 엑셀 + 관련 PDF를 ZIP으로 묶어 다운로드</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="strategy">
            <p className="intro">
              최초 기록을 찾기 위해서는 <strong>검색 전략</strong>이 매우 중요합니다.
              오래된 문헌에서는 &quot;Korea&quot;가 아닌 다른 표기(朝鮮, Chosen, Corea 등)가 사용되었기 때문입니다.
            </p>

            {/* 검색 전략 카드 */}
            <section className="strategy-section">
              <h2>검색 전략 (Search Strategy)</h2>
              <div className="strategy-cards">
                {SEARCH_STRATEGIES.map((strategy) => (
                  <div key={strategy.id} className={`strategy-card ${strategy.id === 'both' ? 'recommended' : ''}`}>
                    {strategy.id === 'both' && <span className="badge">권장</span>}
                    <h3>{strategy.name}</h3>
                    <p className="strategy-desc">{strategy.description}</p>
                    <div className="strategy-details">
                      <div className="detail-row">
                        <span className="label">연도 범위</span>
                        <span className="value">{strategy.yearRange}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">목적</span>
                        <span className="value">{strategy.purpose}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">소스</span>
                        <span className="value">{strategy.sources.join(', ')}</span>
                      </div>
                    </div>
                    <p className="strategy-note">{strategy.note}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 이명(Synonym) 검색 설명 */}
            <section className="strategy-section">
              <h2>이명(Synonym) 검색</h2>
              <div className="info-box">
                <p>
                  WoRMS API에서 추출한 <strong>모든 이명(synonym)</strong>으로 검색합니다.
                  종의 학명은 시간이 지나면서 여러 번 바뀔 수 있기 때문에,
                  과거 문헌에서는 현재와 다른 학명으로 기록되어 있을 수 있습니다.
                </p>
                <div className="example-box">
                  <strong>예시:</strong> <code>Sebastes schlegelii</code>의 이명
                  <ul>
                    <li>Sebastes schlegelii Hilgendorf, 1880 (유효명)</li>
                    <li>Sebastes inermis Cuvier, 1829</li>
                    <li>Sebastichthys inermis (Cuvier, 1829)</li>
                    <li>등...</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 한국 키워드 섹션 */}
            <section className="strategy-section">
              <h2>한국 관련 키워드 (80+ 키워드)</h2>
              <p className="section-intro">
                한국을 지칭하는 다양한 역사적, 언어적 표기를 모두 검색합니다.
                특히 일제강점기(1910-1945) 일본어 문헌에서 사용된 표기가 중요합니다.
              </p>

              <div className="keywords-grid">
                {Object.entries(KOREA_KEYWORDS_CATEGORIZED).map(([key, category]) => (
                  <div key={key} className="keyword-category">
                    <h4>{category.title}</h4>
                    <div className="keyword-tags">
                      {category.keywords.map((kw, idx) => (
                        <span key={idx} className="keyword-tag">{kw}</span>
                      ))}
                    </div>
                    <p className="keyword-note">{category.note}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 검색 흐름도 */}
            <section className="strategy-section">
              <h2>검색 흐름</h2>
              <div className="search-flow">
                <div className="flow-step">
                  <div className="flow-icon">1</div>
                  <div className="flow-content">
                    <strong>학명 입력</strong>
                    <span>예: Sebastes schlegelii</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-icon">2</div>
                  <div className="flow-content">
                    <strong>이명 추출</strong>
                    <span>WoRMS API</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-icon">3</div>
                  <div className="flow-content">
                    <strong>검색 전략 선택</strong>
                    <span>historical / korea / both</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-icon">4</div>
                  <div className="flow-content">
                    <strong>각 이명 × 전략으로 검색</strong>
                    <span>BHL, Semantic Scholar</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-icon">5</div>
                  <div className="flow-content">
                    <strong>연도순 정렬</strong>
                    <span>가장 오래된 기록 = 최초</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings">
            <section className="settings-section">
              <h2>문헌 소스 설정</h2>
              <p className="section-intro">
                검색에 사용할 문헌 소스를 선택합니다. 비활성화된 소스는 검색 시 제외됩니다.
              </p>

              <div className="source-settings-list">
                {sourceConfigs.map((config) => (
                  <div key={config.source} className={`source-setting-item ${config.enabled ? 'enabled' : 'disabled'}`}>
                    <div className="source-toggle">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) => toggleSource(config.source, e.target.checked)}
                          disabled={savingSource === config.source}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <div className="source-info">
                      <div className="source-header">
                        <span className="source-name">{config.name}</span>
                        {config.requiresApiKey && (
                          <span className="api-key-badge">API 키 필요</span>
                        )}
                        {savingSource === config.source && (
                          <span className="saving-badge">저장 중...</span>
                        )}
                      </div>
                      <span className="source-description">{config.description}</span>
                      {config.requiresApiKey && config.apiKeyEnvVar && (
                        <span className="env-var-hint">환경변수: {config.apiKeyEnvVar}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="settings-note">
                <h3>참고</h3>
                <ul>
                  <li><strong>OpenAlex</strong>: 현대 논문 검색의 주력 소스 (2억+ 논문, 무료)</li>
                  <li><strong>Semantic Scholar</strong>: OpenAlex 백업용으로 비활성화됨</li>
                  <li><strong>KCI/RISS</strong>: 공공데이터포털 API 키 발급 후 활성화</li>
                  <li>설정은 서버 재시작 시 초기화됩니다. 영구 저장은 추후 지원 예정.</li>
                </ul>
              </div>
            </section>
          </div>
        )}
      </main>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: #fafafa;
          color: #1a1a1a;
        }

        header {
          background: #fff;
          border-bottom: 1px solid #eee;
          padding: 24px;
        }

        .header-content h1 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 4px;
        }

        .header-content p {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-top: 20px;
        }

        .tabs button {
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tabs button:hover {
          background: #eee;
        }

        .tabs button.active {
          background: #1a1a1a;
          color: #fff;
          border-color: #1a1a1a;
        }

        main {
          max-width: 1000px;
          margin: 0 auto;
          padding: 24px;
        }

        /* Overview */
        .summary-cards {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
        }

        .card {
          flex: 1;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }

        .card-value {
          font-size: 36px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .card-label {
          font-size: 14px;
          color: #666;
          margin-top: 4px;
        }

        .phase-section {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .phase-section h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px;
          color: #1a1a1a;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          color: #fff;
          min-width: 60px;
          text-align: center;
        }

        .item-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-name {
          font-size: 14px;
          font-weight: 500;
        }

        .item-desc {
          font-size: 12px;
          color: #666;
        }

        .action-links {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn {
          padding: 10px 20px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          text-decoration: none;
          color: #1a1a1a;
          cursor: pointer;
        }

        .btn:hover {
          background: #eee;
        }

        .btn.primary {
          background: #1a1a1a;
          color: #fff;
          border-color: #1a1a1a;
        }

        .btn.primary:hover {
          background: #333;
        }

        /* Sources */
        .sources .intro {
          font-size: 14px;
          color: #666;
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .sources-table {
          width: 100%;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          border-collapse: collapse;
          overflow: hidden;
        }

        .sources-table th,
        .sources-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .sources-table th {
          background: #f9f9f9;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
        }

        .sources-table td {
          font-size: 14px;
        }

        .sources-table tr:last-child td {
          border-bottom: none;
        }

        .sources-table a {
          color: #1a1a1a;
          text-decoration: none;
          font-weight: 500;
        }

        .sources-table a:hover {
          text-decoration: underline;
        }

        .type-badge {
          padding: 2px 8px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 12px;
          color: #666;
        }

        .status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }

        .notes {
          font-size: 12px;
          color: #666;
        }

        .source-notes {
          margin-top: 24px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 20px;
        }

        .source-notes h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px;
        }

        .source-notes ul {
          margin: 0;
          padding-left: 20px;
        }

        .source-notes li {
          font-size: 14px;
          margin-bottom: 8px;
          color: #666;
        }

        .source-notes strong {
          color: #1a1a1a;
        }

        /* Implementation Summary */
        .implementation-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .impl-card {
          flex: 1;
          background: #f5f5f5;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .impl-card.implemented {
          background: #f0fdf4;
          border-color: #22c55e;
        }

        .impl-card.planned {
          background: #fffbeb;
          border-color: #f59e0b;
        }

        .impl-card.limited {
          background: #fef2f2;
          border-color: #ef4444;
        }

        .impl-count {
          font-size: 32px;
          font-weight: 700;
          display: block;
        }

        .impl-card.implemented .impl-count {
          color: #16a34a;
        }

        .impl-card.planned .impl-count {
          color: #d97706;
        }

        .impl-card.limited .impl-count {
          color: #dc2626;
        }

        .impl-label {
          font-size: 13px;
          color: #666;
          margin-top: 4px;
          display: block;
        }

        .impl-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .impl-badge.done {
          background: #dcfce7;
          color: #16a34a;
        }

        .impl-badge.planned {
          background: #fef3c7;
          color: #d97706;
        }

        .impl-badge.limited {
          background: #fee2e2;
          color: #dc2626;
        }

        .row-implemented {
          background: #f8fdf9;
        }

        .coverage-cell {
          font-size: 13px;
          color: #666;
        }

        .cost-cell {
          font-size: 13px;
          color: #444;
        }

        .usecase-cell {
          font-size: 13px;
          color: #444;
          max-width: 250px;
        }

        .impl-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .impl-section {
          background: #f9f9f9;
          border-radius: 8px;
          padding: 16px;
        }

        .impl-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px;
          color: #1a1a1a;
        }

        .impl-section ul {
          margin: 0;
          padding-left: 18px;
        }

        .impl-section li {
          font-size: 13px;
          color: #666;
          margin-bottom: 6px;
        }

        .impl-section li strong {
          color: #1a1a1a;
        }

        /* Workflow */
        .workflow-diagram {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 24px;
        }

        .workflow-step {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 8px;
        }

        .step-icon {
          width: 36px;
          height: 36px;
          background: #1a1a1a;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
          padding-top: 6px;
        }

        .step-name {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .step-desc {
          font-size: 13px;
          color: #666;
          margin-top: 2px;
        }

        .step-arrow {
          color: #ccc;
          font-size: 20px;
          margin: 8px 0 8px 10px;
        }

        .workflow-notes {
          margin-top: 24px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 20px;
        }

        .workflow-notes h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px;
        }

        .workflow-notes ul {
          margin: 0;
          padding-left: 20px;
        }

        .workflow-notes li {
          font-size: 14px;
          margin-bottom: 8px;
          color: #666;
        }

        .workflow-notes strong {
          color: #1a1a1a;
        }

        /* Strategy Tab */
        .strategy .intro {
          font-size: 15px;
          color: #444;
          margin-bottom: 24px;
          line-height: 1.7;
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #1a1a1a;
        }

        .strategy-section {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .strategy-section h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 16px;
          color: #1a1a1a;
        }

        .section-intro {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .strategy-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .strategy-card {
          background: #f9f9f9;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 20px;
          position: relative;
        }

        .strategy-card.recommended {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .strategy-card .badge {
          position: absolute;
          top: -10px;
          right: 12px;
          background: #22c55e;
          color: #fff;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .strategy-card h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px;
          color: #1a1a1a;
        }

        .strategy-desc {
          font-size: 13px;
          color: #666;
          margin: 0 0 16px;
        }

        .strategy-details {
          background: #fff;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 4px 0;
        }

        .detail-row .label {
          color: #888;
        }

        .detail-row .value {
          color: #1a1a1a;
          font-weight: 500;
        }

        .strategy-note {
          font-size: 12px;
          color: #888;
          margin: 0;
          font-style: italic;
        }

        .info-box {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
        }

        .info-box p {
          font-size: 14px;
          line-height: 1.7;
          margin: 0 0 16px;
          color: #444;
        }

        .example-box {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          padding: 16px;
        }

        .example-box code {
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
        }

        .example-box ul {
          margin: 8px 0 0;
          padding-left: 20px;
        }

        .example-box li {
          font-size: 13px;
          color: #666;
          margin-bottom: 4px;
        }

        .keywords-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .keyword-category {
          background: #f9f9f9;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 16px;
        }

        .keyword-category h4 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px;
          color: #1a1a1a;
        }

        .keyword-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .keyword-tag {
          background: #fff;
          border: 1px solid #ddd;
          padding: 4px 10px;
          border-radius: 14px;
          font-size: 12px;
          color: #444;
        }

        .keyword-note {
          font-size: 11px;
          color: #888;
          margin: 0;
          font-style: italic;
        }

        .search-flow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .flow-step {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .flow-icon {
          width: 28px;
          height: 28px;
          background: #1a1a1a;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .flow-content {
          display: flex;
          flex-direction: column;
        }

        .flow-content strong {
          font-size: 13px;
          color: #1a1a1a;
        }

        .flow-content span {
          font-size: 11px;
          color: #888;
        }

        .flow-arrow {
          color: #ccc;
          font-size: 20px;
          font-weight: bold;
        }

        /* Rate Limit Section */
        .rate-limit-section {
          background: #f8f9fa;
          border-color: #e9ecef;
        }

        .rate-limit-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .usage-bar-container {
          height: 12px;
          background: #e9ecef;
          border-radius: 6px;
          overflow: hidden;
        }

        .usage-bar {
          height: 100%;
          background: #22c55e;
          border-radius: 6px;
          transition: width 0.3s ease;
        }

        .usage-bar.warning {
          background: #f59e0b;
        }

        .usage-bar.exceeded {
          background: #ef4444;
        }

        .usage-stats {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #666;
        }

        .usage-count {
          font-weight: 600;
          color: #1a1a1a;
        }

        .rate-warning {
          background: #fef3c7;
          color: #92400e;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        .rate-exceeded {
          background: #fee2e2;
          color: #991b1b;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        /* Free Models List */
        .section-note {
          font-size: 13px;
          color: #666;
          margin: 0 0 16px;
        }

        .free-models-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .free-model-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #f9f9f9;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
        }

        .model-id {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 11px;
          background: #e5e5e5;
          padding: 4px 8px;
          border-radius: 4px;
          color: #333;
          flex-shrink: 0;
        }

        .model-name {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          min-width: 140px;
        }

        .model-desc {
          font-size: 13px;
          color: #666;
        }

        /* OCR Strategy */
        .ocr-strategy {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ocr-quality-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .ocr-quality-item {
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e5e5e5;
        }

        .ocr-quality-item.good {
          background: #dcfce7;
          border-color: #86efac;
        }

        .ocr-quality-item.fair {
          background: #fef9c3;
          border-color: #fde047;
        }

        .ocr-quality-item.poor {
          background: #ffedd5;
          border-color: #fdba74;
        }

        .ocr-quality-item.manual {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .quality-badge {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .ocr-quality-item.good .quality-badge { color: #166534; }
        .ocr-quality-item.fair .quality-badge { color: #854d0e; }
        .ocr-quality-item.poor .quality-badge { color: #c2410c; }
        .ocr-quality-item.manual .quality-badge { color: #991b1b; }

        .quality-desc {
          font-size: 11px;
          color: #666;
        }

        .ocr-folder-info {
          background: #f9f9f9;
          padding: 12px 16px;
          border-radius: 6px;
        }

        .ocr-folder-info p {
          margin: 0 0 8px;
          font-size: 13px;
        }

        .ocr-folder-info ul {
          margin: 0;
          padding-left: 20px;
        }

        .ocr-folder-info li {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .ocr-folder-info code {
          background: #e5e5e5;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
        }

        .ocr-languages {
          background: #f0f9ff;
          padding: 10px 14px;
          border-radius: 6px;
          border: 1px solid #bae6fd;
          margin-bottom: 16px;
        }

        .ocr-languages p {
          margin: 0;
          font-size: 13px;
          color: #0369a1;
        }

        .quality-score {
          display: block;
          font-size: 10px;
          color: #888;
          margin-bottom: 2px;
        }

        .ocr-test-results {
          margin-top: 20px;
          background: #fafafa;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e5e5e5;
        }

        .ocr-test-results > p {
          margin: 0 0 12px;
          font-size: 13px;
        }

        .ocr-test-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .ocr-test-table th,
        .ocr-test-table td {
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid #e5e5e5;
        }

        .ocr-test-table th {
          background: #f5f5f5;
          font-weight: 600;
          color: #333;
        }

        .ocr-test-table tbody tr:hover {
          background: #f9f9f9;
        }

        .ocr-test-table .test-good td:first-child {
          border-left: 3px solid #22c55e;
        }

        .ocr-test-table .test-fair td:first-child {
          border-left: 3px solid #f59e0b;
        }

        .ocr-test-table .test-manual td:first-child {
          border-left: 3px solid #ef4444;
        }

        .test-summary {
          margin-top: 12px !important;
          font-size: 12px !important;
          color: #22c55e;
          font-weight: 500;
        }

        /* Settings Tab */
        .settings-section {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 24px;
        }

        .settings-section h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px;
          color: #1a1a1a;
        }

        .source-settings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .source-setting-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          background: #f9f9f9;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .source-setting-item.enabled {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .source-setting-item.disabled {
          background: #fafafa;
          border-color: #e5e5e5;
          opacity: 0.7;
        }

        .source-toggle {
          flex-shrink: 0;
          padding-top: 2px;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #22c55e;
        }

        .toggle-switch input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .source-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .source-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .source-name {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .source-description {
          font-size: 13px;
          color: #666;
        }

        .api-key-badge {
          background: #fef3c7;
          color: #92400e;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }

        .saving-badge {
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }

        .env-var-hint {
          font-size: 11px;
          color: #888;
          font-family: 'Consolas', 'Monaco', monospace;
        }

        .settings-note {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }

        .settings-note h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px;
          color: #1a1a1a;
        }

        .settings-note ul {
          margin: 0;
          padding-left: 20px;
        }

        .settings-note li {
          font-size: 13px;
          color: #666;
          margin-bottom: 6px;
        }

        .settings-note li strong {
          color: #1a1a1a;
        }

        @media (max-width: 768px) {
          .summary-cards {
            flex-direction: column;
          }

          .implementation-summary {
            flex-direction: column;
          }

          .impl-details {
            grid-template-columns: 1fr;
          }

          .sources-table {
            display: block;
            overflow-x: auto;
          }

          .tabs {
            flex-wrap: wrap;
          }

          .strategy-cards {
            grid-template-columns: 1fr;
          }

          .keywords-grid {
            grid-template-columns: 1fr;
          }

          .search-flow {
            flex-direction: column;
            align-items: stretch;
          }

          .flow-arrow {
            transform: rotate(90deg);
            text-align: center;
          }

          .usage-stats {
            flex-direction: column;
            gap: 4px;
          }

          .free-model-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }

          .model-name {
            min-width: auto;
          }

          .ocr-quality-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
