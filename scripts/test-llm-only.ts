/**
 * LLM 분석만 테스트 (이미 추출된 텍스트 사용)
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createLLMClient } from '../src/llm';
import { LLMConfig } from '../src/llm/types';

// .env.local 파일 로드
dotenv.config({ path: '.env.local' });

const TEXT_FILE = 'd:/Projects/first-record-finder/data/pdfs/test_output/openalex_Variations_in_species_composition_of_demersal_orga_1768378484575.txt';

// OpenRouter 무료 모델 사용
const LLM_CONFIG: LLMConfig = {
  provider: 'openrouter',
  model: process.env.OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
  apiKey: process.env.OPENROUTER_API_KEY,
};

async function testLLMAnalysis() {
  console.log('='.repeat(60));
  console.log('LLM 분석 테스트');
  console.log('='.repeat(60));

  // 텍스트 파일 읽기
  console.log(`\n[1] 텍스트 파일 로드: ${TEXT_FILE}`);
  const text = fs.readFileSync(TEXT_FILE, 'utf-8');
  console.log(`  텍스트 길이: ${text.length}자`);

  // 텍스트 일부만 사용 (토큰 제한)
  const truncatedText = text.slice(0, 8000);
  console.log(`  분석 대상: ${truncatedText.length}자 (처음 8000자)`);

  // LLM 클라이언트 생성
  console.log(`\n[2] LLM 분석 시작`);
  console.log(`  Provider: ${LLM_CONFIG.provider}`);
  console.log(`  Model: ${LLM_CONFIG.model}`);
  console.log('-'.repeat(40));

  const llmClient = createLLMClient(LLM_CONFIG);

  const startTime = Date.now();
  const result = await llmClient.analyzeLiterature({
    text: truncatedText,
    scientificName: 'Ditrema temminckii',
    synonyms: ['Ditrema laeve', 'Ditrema smitti', 'Embiotoca temminckii'],
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[3] 분석 완료 (${elapsed}초)`);
  console.log('-'.repeat(40));
  console.log(`  한국 기록 여부: ${result.hasKoreaRecord}`);
  console.log(`  신뢰도: ${(result.confidence * 100).toFixed(0)}%`);

  if (result.locality) {
    console.log(`  채집지: ${result.locality}`);
  }
  if (result.collectionDate) {
    console.log(`  채집일: ${result.collectionDate}`);
  }

  console.log(`\n  관련 인용문:`);
  result.relevantQuotes.slice(0, 3).forEach((q, i) => {
    console.log(`    ${i + 1}. "${q.slice(0, 100)}..."`);
  });

  console.log(`\n  판단 근거:`);
  console.log(`    ${result.reasoning}`);

  console.log('\n' + '='.repeat(60));
  console.log('테스트 완료');
}

testLLMAnalysis().catch(console.error);
