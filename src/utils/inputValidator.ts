/**
 * 학명 입력 유효성 검사 및 자동 수정
 */

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
}

/**
 * 학명 입력 검증 클래스
 */
export class InputValidator {
  /**
   * 학명 유효성 검사 및 자동 수정
   *
   * - 속명: 첫 글자 대문자, 나머지 소문자 (예: Danaus)
   * - 종소명: 모두 소문자 (예: plexippus)
   * - 아종명: 모두 소문자
   * - 특수문자 제거 (허용: 공백, 하이픈, 점, 괄호, ×)
   */
  static validateScientificName(name: string): ValidationResult {
    const warnings: string[] = [];
    let sanitized = name.trim();

    // 기본 유효성 검사
    if (!sanitized || sanitized.length < 2) {
      return { isValid: false, sanitized, warnings: ['학명이 너무 짧습니다'] };
    }

    // 특수문자 제거 (일부 허용)
    const allowedSpecialChars = /[^a-zA-Z\s\-.'()×]/g;
    if (allowedSpecialChars.test(sanitized)) {
      warnings.push('특수문자가 제거되었습니다');
      sanitized = sanitized.replace(allowedSpecialChars, '');
    }

    // 연속된 공백 제거
    sanitized = sanitized.replace(/\s+/g, ' ');

    // 학명 형식 검사 (속명 + 종소명)
    const parts = sanitized.split(' ');

    // 속명만 입력한 경우도 허용 (속 전체 검색용)
    if (parts.length === 1) {
      // 속명: 첫 글자 대문자, 나머지 소문자
      const originalGenus = parts[0];
      parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      if (originalGenus !== parts[0]) {
        warnings.push(`속명 "${originalGenus}"을(를) "${parts[0]}"(으)로 자동 수정했습니다`);
      }
      sanitized = parts[0];
      return { isValid: true, sanitized, warnings };
    }

    // 대소문자 자동 수정
    if (parts.length >= 2) {
      // 속명: 첫 글자 대문자, 나머지 소문자
      if (parts[0]) {
        const originalGenus = parts[0];
        parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        if (originalGenus !== parts[0]) {
          warnings.push(`속명 "${originalGenus}"을(를) "${parts[0]}"(으)로 자동 수정했습니다`);
        }
      }

      // 종소명: 모두 소문자
      if (parts[1]) {
        const originalSpecies = parts[1];
        parts[1] = parts[1].toLowerCase();
        if (originalSpecies !== parts[1]) {
          warnings.push(`종소명 "${originalSpecies}"을(를) "${parts[1]}"(으)로 자동 수정했습니다`);
        }
      }

      // 아종명이 있는 경우 (예: subsp., var. 등)
      const rankIndicators = ['subsp.', 'var.', 'f.', 'nothosubsp.', 'nothovar.'];
      for (let i = 2; i < parts.length; i++) {
        if (!rankIndicators.includes(parts[i])) {
          const original = parts[i];
          parts[i] = parts[i].toLowerCase();
          // 숫자가 포함된 경우는 경고 제외
          if (original !== parts[i] && !/\d/.test(original)) {
            warnings.push(`"${original}"을(를) "${parts[i]}"(으)로 자동 수정했습니다`);
          }
        }
      }

      sanitized = parts.join(' ');
    }

    return {
      isValid: parts.length >= 1,
      sanitized,
      warnings
    };
  }
}