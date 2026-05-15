# Laws of UX Checklist

Paraphrased from Laws of UX pages crawled on 2026-05-05. Use this as a practical checklist, not as proof. Load `resource-map.md` when source links or deeper reading are needed.

## Choice, Complexity, and Memory

### Hick's Law
Use when users must choose between actions, settings, routes, filters, or options.
- Reduce simultaneous choices when decision speed matters.
- Break large tasks into visible, ordered steps.
- Highlight a recommended/default path when one exists.
- Do not simplify so far that users lose needed context or control.

### Choice Overload
Use when lists, catalogs, pricing, settings, or filters feel exhaustive.
- Prioritize the most useful options first.
- Support narrowing through search, filters, defaults, or guided comparison.
- Provide side-by-side comparison when decisions depend on tradeoffs.
- Avoid making every option visually equal.

### Cognitive Load
Use when the screen requires sustained interpretation or memory.
- Remove irrelevant information, duplicated controls, and avoidable visual noise.
- Keep labels, affordances, and next steps close to the content they explain.
- Prefer recognition over recall: show context, prior choices, examples, and constraints.
- Split dense tasks into chunks without hiding critical dependencies.

### Miller's Law
Use when grouping information, nav items, form sections, or data summaries.
- Organize into meaningful chunks instead of relying on arbitrary item limits.
- Do not use "7 plus or minus 2" as a blanket cap.
- Account for differences in user expertise and situation.

### Chunking
Use for content-heavy pages, dashboards, forms, and onboarding.
- Group related information into scannable modules with clear hierarchy.
- Use headings, spacing, dividers, and sequence to reveal relationships.
- Keep chunks aligned to user goals, not internal data structures.

### Working Memory
Use when users compare, copy, calculate, or carry state across screens.
- Keep necessary reference information visible or easy to return to.
- Preserve prior choices and progress.
- Mark visited/viewed/completed items clearly.
- Avoid requiring users to remember codes, values, or instructions from previous steps.

### Tesler's Law
Use when a complex flow cannot be made genuinely simple.
- Decide whether the system or the user should carry each piece of complexity.
- Automate or default complexity only when the result remains inspectable and reversible.
- Do not pretend inherent complexity has disappeared; stage it and explain it at the right moment.

### Occam's Razor
Use when a design has accumulated extra states, controls, panels, or explanations.
- Remove elements that do not change user outcomes.
- Prefer the simpler explanation, flow, or component when it predicts the same behavior.
- Stop only when further removal would reduce function, clarity, or trust.

## Input, Performance, and Task Flow

### Fitts's Law
Use for buttons, menus, drag handles, destructive actions, touch targets, and primary CTAs.
- Make frequent or important targets large enough and easy to reach.
- Keep related targets close to the user's attention area.
- Add spacing between adjacent targets, especially where mistakes are costly.
- Respect platform and accessibility target-size conventions.

### Doherty Threshold
Use for loading, search, saves, generation, sync, and background jobs.
- Provide visible feedback quickly, especially before 400 ms when possible.
- Use perceived-performance techniques honestly: skeletons, optimistic states, progress, and partial results.
- Keep users oriented during longer waits with status, cancellation, or next available action.

### Parkinson's Law
Use for forms, checkout, bookings, and workflows with expected effort.
- Make routine tasks take about as long as users expect, or less.
- Use autofill, defaults, saved data, and batch actions to avoid task inflation.
- Do not add confirmation, configuration, or review steps without clear risk reduction.

### Postel's Law
Use for inputs, imports, parsing, APIs, integrations, and error handling.
- Accept flexible user input where possible.
- Normalize and validate with clear boundaries.
- Return conservative, predictable output and state.
- Give actionable feedback when input cannot be accepted.

### Paradox of the Active User
Use for onboarding, complex products, docs, and first-run experiences.
- Expect users to start doing the task before reading instructions.
- Put help inside the workflow where it is needed.
- Let users skip, revisit, and discover guidance.
- Prefer progressive education over front-loaded tutorials.

### Flow
Use for productivity tools, editors, creation flows, and repeated work.
- Match challenge to user skill; avoid boredom and avoid overload.
- Give clear, immediate feedback for user actions.
- Remove avoidable interruptions and unnecessary mode changes.
- Keep essential tools discoverable without forcing attention away from the task.

## Perception and Visual Organization

### Aesthetic-Usability Effect
Use for visual polish, trust, and first impressions.
- Improve visual quality because it affects perceived usability.
- Do not let attractive UI hide usability defects in testing.
- Validate whether users can still complete tasks, not only whether the screen feels polished.

### Law of Proximity
Use for forms, tables, cards, labels, filters, and grouped actions.
- Put related items near each other and unrelated items farther apart.
- Keep labels and helper text close to their controls.
- Use spacing to clarify ownership and hierarchy.

### Law of Common Region
Use when grouped elements need an explicit boundary.
- Use containers, backgrounds, borders, or panels to communicate related sections.
- Avoid over-framing every section; boundaries should clarify relationships.
- Make nested regions visually unambiguous.

### Law of Similarity
Use for repeated items, links, buttons, badges, statuses, and data visualizations.
- Make similar things look related.
- Make different actions or meanings visually distinct.
- Do not rely on color alone for meaning.
- Ensure links and interactive controls are differentiated from ordinary text.

### Law of Uniform Connectedness
Use for flows, timelines, selections, groups, and connected data.
- Use lines, shared backgrounds, connectors, or linked motion to show relationships.
- Connect only items that are truly related.
- Avoid connector clutter that competes with labels and content.

### Law of Pragnanz
Use when a visual, chart, icon, or layout is complex or ambiguous.
- Prefer the simplest interpretable shape, path, and grouping.
- Reduce decorative detail where it harms recognition.
- Make ambiguous visuals resolve toward the user's goal.

### Von Restorff Effect
Use for primary CTAs, alerts, selected states, and high-priority information.
- Make the most important item distinct from similar surrounding items.
- Use emphasis sparingly so important items do not compete.
- Include non-color cues for low vision and color vision differences.
- Be careful with motion for users with motion sensitivity.

### Selective Attention
Use for dashboards, alerts, ads, banners, updates, and multi-change screens.
- Guide attention toward goal-relevant content.
- Avoid styling important content like ads or peripheral banners.
- Avoid simultaneous competing changes that make important updates easy to miss.
- Make changed, new, or urgent information obvious but not noisy.

## Motivation, Progress, and Memory of Experience

### Goal-Gradient Effect
Use for progress bars, completion flows, loyalty, onboarding, and setup.
- Show clear progress toward a goal.
- Consider helpful starter progress when it is honest and motivates completion.
- Make the next step obvious near the end of a task.

### Zeigarnik Effect
Use for incomplete tasks, drafts, notifications, checklists, and discovery cues.
- Preserve incomplete work and make unfinished state visible.
- Use progress and "continue where you left off" affordances.
- Signal additional content without trapping users in artificial incompletion.

### Peak-End Rule
Use for checkout, support, errors, completion, cancellation, and long workflows.
- Improve the most intense moments and the final moment of a journey.
- Make recovery from negative moments especially clear and respectful.
- End with confirmation, reassurance, and the next useful action.

### Serial Position Effect
Use for navigation, ordered lists, menus, onboarding steps, and command bars.
- Put important items at the beginning or end where recall is stronger.
- Avoid burying key actions in the middle of long undifferentiated lists.
- Keep middle items organized and searchable.

## Expectations, Models, and Bias

### Jakob's Law
Use for familiar web/app patterns, navigation, controls, search, checkout, and settings.
- Reuse established patterns unless novelty solves a clear user problem.
- Let users transfer expectations from products they already know.
- When changing familiar behavior, support transition and explain the difference in context.

### Mental Model
Use when user expectations and system behavior may diverge.
- Match the interface to how users think the system works.
- Use research artifacts and observed behavior to find model gaps.
- Name concepts in user language, not only internal terminology.

### Pareto Principle
Use for prioritization, dashboards, analytics, product scope, and workflow optimization.
- Identify the small set of actions, users, cases, or content driving most value or pain.
- Optimize the highest-impact paths first.
- Do not let edge cases dominate the default experience.

### Cognitive Bias
Use when decisions, rankings, comparisons, defaults, or research interpretation can be distorted.
- Account for confirmation bias, framing, anchoring, recency, and social proof.
- Make tradeoffs and assumptions visible.
- Avoid dark patterns that exploit predictable bias.
- Triangulate design decisions with data, testing, and user context.
