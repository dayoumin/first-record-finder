---
name: accessibility-audit
description: |
  웹 접근성(WCAG 2.1 AA) 전문 감사 스킬. 색상 대비, 키보드 네비게이션, 스크린 리더 호환성, 시맨틱 HTML을 심층 검토합니다.
  Use when: auditing accessibility, checking a11y compliance, reviewing ARIA usage, or verifying keyboard navigation.
  Triggers: 접근성 검사, a11y 체크, WCAG 확인, accessibility audit, a11y check, screen reader test
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Accessibility Audit Skill (WCAG 2.1 AA)

Comprehensive web accessibility audit following WCAG 2.1 Level AA guidelines.

## When to Activate

- User mentions "접근성", "a11y", "accessibility", "WCAG"
- Reviewing forms, navigation, or interactive components
- Before release accessibility verification

## Audit Checklist

### 1. Perceivable

#### Text Alternatives
- [ ] All `<img>` have meaningful `alt` attributes
- [ ] Decorative images use `alt=""` or `aria-hidden="true"`
- [ ] Icon buttons have `aria-label`

#### Color Contrast
- [ ] Normal text: 4.5:1 ratio
- [ ] Large text (18px+): 3:1 ratio
- [ ] UI components: 3:1 ratio
- [ ] Information not conveyed by color alone

#### Content Structure
- [ ] Heading levels sequential (h1 → h2 → h3)
- [ ] Landmark roles (`<header>`, `<nav>`, `<main>`, `<footer>`)
- [ ] Lists use `<ul>`, `<ol>`, `<dl>`

### 2. Operable

#### Keyboard Access
- [ ] All interactive elements Tab-accessible
- [ ] Logical focus order
- [ ] No keyboard traps (except modals)
- [ ] Skip links available

#### Focus Indication
- [ ] Focus states visually clear
- [ ] Pattern: `focus-visible:ring-2 focus-visible:ring-ring`
- [ ] Proper `:focus-visible` vs `:focus` usage

#### Touch Targets
- [ ] Minimum 44x44px (iOS) / 48x48dp (Android)
- [ ] 8px+ spacing between targets

### 3. Understandable

#### Form Labels
- [ ] All inputs have associated `<label>` (htmlFor)
- [ ] Error messages linked to input fields
- [ ] Required fields marked (`aria-required`)

#### Error Handling
- [ ] Error messages use `role="alert"` or `aria-live="polite"`
- [ ] Focus moves to error on occurrence
- [ ] NO `alert()` usage → use toast or inline errors

### 4. Robust

#### ARIA Usage
- [ ] `aria-label`: name for unlabeled elements
- [ ] `aria-describedby`: additional descriptions
- [ ] `aria-expanded`: expand/collapse state
- [ ] `aria-current`: current location in navigation
- [ ] `aria-hidden`: hide decorative elements

#### Dynamic Content
- [ ] `aria-live` regions for updates
- [ ] `aria-busy` for loading states

## Report Format

```markdown
# ♿ Accessibility Audit Report

## Summary
- **WCAG 2.1 AA Compliance**: X%
- **Critical Issues**: N
- **Warnings**: N

## Violations

### [Critical] 1.4.3 Color Contrast
- **Location**: file:line
- **Current**: 3.2:1
- **Required**: 4.5:1
- **Fix**: `text-gray-600` → `text-gray-700`

## Passed Checks
[List of passed items]

## Recommendations
[Optional improvements]
```

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
