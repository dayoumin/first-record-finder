import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testBhlApi() {
  const apiKey = process.env.BHL_API_KEY;
  console.log('API Key:', apiKey ? apiKey.slice(0,8) + '...' : 'NOT SET');
  
  // 여러 엔드포인트 테스트
  const tests = [
    // 1. Part 검색
    { 
      name: 'PartSearch', 
      url: `https://www.biodiversitylibrary.org/api3?op=PartSearch&searchterm=fish&searchtype=C&format=json&apikey=${apiKey}` 
    },
    // 2. Publication 검색
    { 
      name: 'PublicationSearch', 
      url: `https://www.biodiversitylibrary.org/api3?op=PublicationSearch&searchterm=fish&searchtype=C&format=json&apikey=${apiKey}` 
    },
    // 3. Subject 검색 (다른 방식)
    { 
      name: 'SubjectSearch', 
      url: `https://www.biodiversitylibrary.org/api3?op=SubjectSearch&subject=fish&format=json&apikey=${apiKey}` 
    },
    // 4. GetItemMetadata (특정 아이템 조회)
    { 
      name: 'GetItemMetadata', 
      url: `https://www.biodiversitylibrary.org/api3?op=GetItemMetadata&id=123456&format=json&apikey=${apiKey}` 
    },
  ];
  
  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
    try {
      const response = await fetch(test.url);
      console.log('Status:', response.status);
      
      const text = await response.text();
      console.log('Response length:', text.length);
      
      if (text.length > 0 && text.length < 100) {
        console.log('Full response:', text);
      } else if (text.length > 0) {
        console.log('Response preview:', text.slice(0, 300));
        try {
          const json = JSON.parse(text);
          console.log('Parsed - Status:', json.Status, 'Results:', json.Result?.length || 0);
        } catch {}
      }
    } catch (err: any) {
      console.error('Error:', err.message);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }
}

testBhlApi();
