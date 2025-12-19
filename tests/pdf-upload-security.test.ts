/**
 * PDF 업로드 보안 테스트
 */
import { describe, it, expect } from 'vitest';

// 테스트용 함수들 (실제 route.ts에서 추출)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

function isPdfSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return PDF_MAGIC_BYTES.every((byte, index) => buffer[index] === byte);
}

function sanitizeFileName(fileName: string): string {
  let safe = fileName.replace(/[\\\/]/g, '_');
  safe = safe.replace(/\.\./g, '_');
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe || safe === '.pdf') {
    safe = 'unnamed';
  }
  safe = safe.replace(/\.pdf$/i, '');
  return safe;
}

describe('PDF 시그니처 검증', () => {
  it('유효한 PDF 시그니처 (%PDF)', () => {
    const validPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    expect(isPdfSignature(validPdf)).toBe(true);
  });

  it('잘못된 시그니처 (PNG)', () => {
    const pngFile = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isPdfSignature(pngFile)).toBe(false);
  });

  it('잘못된 시그니처 (JPEG)', () => {
    const jpegFile = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(isPdfSignature(jpegFile)).toBe(false);
  });

  it('빈 버퍼', () => {
    const emptyBuffer = Buffer.from([]);
    expect(isPdfSignature(emptyBuffer)).toBe(false);
  });

  it('너무 짧은 버퍼', () => {
    const shortBuffer = Buffer.from([0x25, 0x50]);
    expect(isPdfSignature(shortBuffer)).toBe(false);
  });

  it('부분 일치 (처음 3바이트만 일치)', () => {
    const partialMatch = Buffer.from([0x25, 0x50, 0x44, 0x00]);
    expect(isPdfSignature(partialMatch)).toBe(false);
  });
});

describe('파일명 보안 처리', () => {
  describe('경로 조작 방지', () => {
    it('상위 디렉토리 이동 시도 차단', () => {
      // 핵심: .. 와 / 가 제거되어 경로 조작 불가
      const result1 = sanitizeFileName('../../../etc/passwd.pdf');
      expect(result1).not.toContain('..');
      expect(result1).not.toContain('/');

      const result2 = sanitizeFileName('..\\..\\windows\\system32.pdf');
      expect(result2).not.toContain('..');
      expect(result2).not.toContain('\\');
    });

    it('Unix 경로 구분자 제거', () => {
      const result = sanitizeFileName('/etc/passwd.pdf');
      expect(result).not.toContain('/');
      expect(result).toContain('etc');
    });

    it('Windows 경로 구분자 제거', () => {
      const result = sanitizeFileName('C:\\Users\\test.pdf');
      expect(result).not.toContain('\\');
      expect(result).toContain('Users');
    });

    it('혼합 경로 조작 시도', () => {
      const result = sanitizeFileName('..\\../test/../../../file.pdf');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });
  });

  describe('특수문자 처리', () => {
    it('한글 파일명 -> 언더스코어 대체', () => {
      const result = sanitizeFileName('한국어파일.pdf');
      expect(result).toMatch(/^_+$/);
      expect(result.length).toBeGreaterThan(0);
    });

    it('특수문자 제거', () => {
      const result = sanitizeFileName('file<>:"|?*.pdf');
      expect(result).not.toMatch(/[<>:"|?*]/);
      expect(result).toContain('file');
    });

    it('공백 처리', () => {
      expect(sanitizeFileName('my file name.pdf')).toBe('my_file_name');
    });

    it('허용 문자 유지', () => {
      expect(sanitizeFileName('valid-file_name.test.pdf')).toBe('valid-file_name.test');
    });
  });

  describe('빈 파일명 처리', () => {
    it('빈 문자열', () => {
      expect(sanitizeFileName('')).toBe('unnamed');
    });

    it('.pdf만 있는 경우', () => {
      expect(sanitizeFileName('.pdf')).toBe('unnamed');
    });

    it('특수문자만 있는 경우 -> 언더스코어', () => {
      const result = sanitizeFileName('!!!@@@###.pdf');
      expect(result).toMatch(/^_+$/);
    });
  });
});

describe('파일 크기 제한', () => {
  it('50MB 제한', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  it('49MB 파일 허용', () => {
    const fileSize = 49 * 1024 * 1024;
    expect(fileSize <= MAX_FILE_SIZE).toBe(true);
  });

  it('51MB 파일 거부', () => {
    const fileSize = 51 * 1024 * 1024;
    expect(fileSize <= MAX_FILE_SIZE).toBe(false);
  });
});
