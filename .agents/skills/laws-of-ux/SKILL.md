---
name: laws-of-ux
description: Apply psychology-based UX heuristics from Laws of UX when designing, reviewing, or refactoring interfaces and product flows. Use for UI/UX audits, frontend implementation choices, design critiques, onboarding, forms, navigation, search and filtering, dashboards, performance feedback, visual hierarchy, information architecture, and explaining tradeoffs with laws like Fitts's, Hick's, Jakob's, cognitive load, Gestalt grouping, Peak-End, Postel's, and Tesler's laws.
---

# Laws of UX

Use this skill to turn psychology-informed UX laws into concrete interface decisions. Treat laws as heuristics, not mandates: balance them against user research, accessibility, product constraints, platform conventions, and measured behavior.

## Workflow

1. Identify the user's task, context, device/input mode, domain risk, and success criteria.
2. Pick the few laws most relevant to the interface surface. Load `references/laws-checklist.md` for the practical checklist.
3. Translate each selected law into specific UI implications: layout, copy, hierarchy, defaults, flow steps, feedback, target sizing, grouping, or validation behavior.
4. Resolve conflicts explicitly. Common tensions: simplicity vs necessary complexity, familiarity vs useful novelty, emphasis vs clutter, aesthetic polish vs masking usability defects, fast feedback vs honest progress, and reduced choices vs sufficient user control.
5. When reviewing, lead with concrete findings and file/line references when available. Tie each finding to the law only after stating the observable user problem.
6. When implementing, make scoped changes that fit the existing design system. Prefer improving task clarity, target acquisition, scanability, feedback, and state persistence over decorative changes.
7. Cite source links when making externally facing recommendations or when the user asks for rationale. Load `references/resource-map.md` for the crawled Laws of UX pages and linked resources.

## Selection Guide

- Navigation, IA, menus, search, filters: Hick's Law, Choice Overload, Jakob's Law, Miller's Law, Chunking, Serial Position Effect.
- Forms, input, validation, data import: Fitts's Law, Postel's Law, Parkinson's Law, Cognitive Load, Working Memory, Paradox of the Active User.
- Dashboards, tables, dense operational screens: Chunking, Law of Proximity, Law of Common Region, Law of Similarity, Uniform Connectedness, Pareto Principle, Selective Attention.
- Onboarding, setup, wizards, empty states: Paradox of the Active User, Cognitive Load, Hick's Law, Goal-Gradient Effect, Zeigarnik Effect, Flow.
- Visual hierarchy and calls to action: Von Restorff Effect, Selective Attention, Aesthetic-Usability Effect, Similarity, Proximity, Common Region.
- Performance, loading, save states, long-running work: Doherty Threshold, Goal-Gradient Effect, Zeigarnik Effect, Peak-End Rule.
- Complex applications and power tools: Tesler's Law, Occam's Razor, Mental Model, Jakob's Law, Cognitive Bias.

## Output Guidance

For audits, group findings by user impact rather than by law. A good finding names the affected screen/state, the likely user failure, the relevant law, and a specific repair.

For design proposals, present the smallest set of changes that improves the user's path through the task. Avoid listing every applicable law; choose the laws that explain the highest-leverage decisions.

For code changes, verify responsive behavior, focus states, keyboard/mouse/touch interaction, loading/error/empty states, and whether text or controls shift layout under realistic content.

## References

- `references/laws-checklist.md`: compact checklist for applying each law.
- `references/resource-map.md`: Laws of UX pages, official articles, and further-reading links crawled from the site on 2026-05-05.
