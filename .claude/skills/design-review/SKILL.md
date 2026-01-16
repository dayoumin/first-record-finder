---
name: design-review
description: |
  UI/UX 디자인 리뷰 스킬. 시각적 일관성, 반응형 디자인, 접근성(WCAG 2.1 AA), 인터랙션 패턴을 검토합니다.
  Use when: reviewing UI components, page layouts, frontend changes, or when user asks for design review, UI check, layout verification.
  Triggers: 디자인 리뷰, UI 검토, 레이아웃 확인, design review, UI audit, layout check
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# UI/UX Design Review Skill

Senior UI/UX design reviewer for SaaS applications (Stripe, Airbnb, Linear quality).

## When to Activate

- After `.tsx`, `.css`, `.scss` file modifications
- Layout or style related questions
- User requests: "디자인 확인", "UI 검토", "design review", "check layout"

## Quick Checklist

### 1. Visual Consistency
- [ ] 8px spacing system (p-2, p-4, p-6, p-8)
- [ ] Typography hierarchy clear
- [ ] Color consistency (Primary, Muted, Destructive, Accent)
- [ ] Visual hierarchy appropriate

### 2. Responsive Design
- [ ] Mobile (<768px): single column, touch-friendly (min 44x44px)
- [ ] Tablet (768-1024px): adaptive layout
- [ ] Desktop (>1024px): full layout with sidebar

### 3. Accessibility (WCAG 2.1 AA)
- [ ] Color contrast 4.5:1+
- [ ] Keyboard navigation support
- [ ] Focus states visible (`focus-visible:ring-2`)
- [ ] Semantic HTML (`<header>`, `<nav>`, `<main>`, `<footer>`)
- [ ] Proper `aria-label`, `role` usage

### 4. Interactions
- [ ] hover/focus/active states defined
- [ ] Loading feedback (skeleton, spinner)
- [ ] Error handling (toast, NOT `alert()`)
- [ ] Animations 150-300ms

## Issue Priority

| Level | Description |
|-------|-------------|
| **[Blocker]** | Release blocking - broken layout, accessibility violation |
| **[High]** | Significant UX impact - small touch targets, no keyboard access |
| **[Medium]** | Visual inconsistency - spacing, color mismatch |
| **[Nitpick]** | Suggestions - code cleanup, minor tweaks |

## Report Format

```markdown
# 🎨 Design Review

## Summary
- **Scope**: [file list]
- **Score**: X/10

## Issues
### [Priority] Issue Title
- **Location**: file:line
- **Problem**: description
- **Suggestion**: fix direction

## Positive Observations
[Well-implemented patterns]

## Recommendations
[Improvement suggestions]
```

## Project Context

- **UI Framework**: shadcn/ui + Tailwind CSS v4
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Container**: `max-w-6xl mx-auto w-full px-6`
- **Layout**: Header + Sidebar + Main content

See [CLAUDE.md](../../../CLAUDE.md) for detailed design guidelines.
