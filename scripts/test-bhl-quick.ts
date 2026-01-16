import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { BhlClient } from '../src/literature/bhl-client';

async function test() {
  console.log('BHL API 키:', process.env.BHL_API_KEY ? '설정됨' : '없음');
  const client = new BhlClient();
  
  // 여러 검색어 테스트
  const queries = ['Ditrema', 'Pagrus', 'fish Korea', 'Anguilla japonica'];
  
  for (const query of queries) {
    console.log(`\n=== 검색: "${query}" ===`);
    const items = await client.search(query, { maxResults: 3 });
    console.log(`결과: ${items.length}건`);
    if (items.length > 0) {
      console.log('첫 번째:', items[0].year, '-', items[0].title?.slice(0, 60));
    }
    await new Promise(r => setTimeout(r, 500));
  }
}
test().catch(err => console.error('오류:', err.message));
