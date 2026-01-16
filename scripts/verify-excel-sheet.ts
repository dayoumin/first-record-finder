
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const reportsDir = path.join(process.cwd(), 'data/reports');

// Find the most recent Ditrema temminckii file
const files = fs.readdirSync(reportsDir)
  .filter(f => f.startsWith('분석결과_Ditrema_temminckii_') && f.endsWith('.xlsx'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.error('No report file found for Ditrema temminckii');
  process.exit(1);
}

const targetFile = path.join(reportsDir, files[0]);
console.log(`Checking file: ${targetFile}`);

const workbook = XLSX.readFile(targetFile);
const sheetNames = workbook.SheetNames;

console.log('Sheet names:', sheetNames);

if (sheetNames.includes('LLM분석상세')) {
  console.log('✅ "LLM분석상세" sheet found.');
  
  const sheet = workbook.Sheets['LLM분석상세'];
  const json = XLSX.utils.sheet_to_json(sheet);
  console.log('Row count:', json.length);
  if (json.length > 0) {
      console.log('First row keys:', Object.keys(json[0] as object));
  }
} else {
  console.error('❌ "LLM분석상세" sheet NOT found.');
  process.exit(1);
}
