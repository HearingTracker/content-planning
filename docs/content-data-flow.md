# Content Data Flow: Pitch → Brief → Content

This document describes how data flows through the unified `cp_content` table as content progresses from pitch (idea) to brief to content.

## Overview

All content lives in a single `cp_content` table with a `stage` field that tracks its current phase:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   PITCH     │ ──── │    BRIEF    │ ──── │   CONTENT   │
│ stage=idea  │      │ stage=brief │      │stage=content│
└─────────────┘      └─────────────┘      └─────────────┘
```

When content is promoted, the `stage` field is updated and data is preserved or transformed as shown below.

---

## Field Usage by Stage

| Field | Pitch (idea) | Brief | Content | Notes |
|-------|:------------:|:-----:|:-------:|-------|
| **Core Fields** |
| `title` | ✓ | ✓ | ✓ | Used at all stages |
| `slug` | - | ✓ | ✓ | Generated on promotion to brief |
| `description` | ✓ | ✓ (as summary) | ✓ | Idea description becomes brief summary |
| **Stage Tracking** |
| `stage` | `'idea'` | `'brief'` | `'content'` | Updated on promotion |
| `idea_status` | ✓ | `'converted'` | `'converted'` | Set to converted when promoted |
| `brief_status` | - | ✓ | `'completed'` | Set to completed when promoted |
| `workflow_status_id` | - | - | ✓ | Set to initial status on promotion |
| **Common Fields** |
| `content_type_id` | ✓ | ✓ | ✓ | Preserved through all stages |
| `campaign_id` | ✓ | ✓ | ✓ | Preserved through all stages |
| `priority` | ✓ | ✓ | ✓ | Preserved through all stages |
| `notes` | ✓ | ✓ | ✓ | Preserved through all stages |
| `metadata` | ✓ | ✓ | ✓ | Preserved through all stages |
| **Pitch-Specific Fields** |
| `source` | ✓ | ✓ | ✓ | Preserved (where did idea come from) |
| `potential_keywords` | ✓ | ✓ | ✓ | Original keyword list with volumes |
| `target_audience` | ✓ | ✓ | ✓ | Preserved through all stages |
| `estimated_effort` | ✓ | ✓ | ✓ | Preserved through all stages |
| `vote_count` | ✓ | ✓ | ✓ | Preserved for reference |
| `votes` | ✓ | ✓ | ✓ | Preserved for reference |
| `rejection_reason` | ✓ | - | - | Only used if rejected |
| `submitted_by` | ✓ | ✓ | ✓ | Preserved (who submitted the idea) |
| `reviewed_by` | ✓ | ✓ | ✓ | Preserved (who approved the idea) |
| `reviewed_at` | ✓ | ✓ | ✓ | Preserved |
| **Brief/SEO Fields** |
| `primary_keyword` | - | ✓ | ✓ | Set manually in brief |
| `secondary_keywords` | - | ✓ | ✓ | Copied from potential_keywords on promotion |
| `search_intent` | - | ✓ | ✓ | Set in brief |
| `target_word_count` | - | ✓ | ✓ | Set in brief |
| `content_goals` | - | ✓ | ✓ | Set in brief |
| `tone_and_style` | - | ✓ | ✓ | Set in brief |
| `outline` | - | ✓ | ✓ | Set in brief |
| `required_sections` | - | ✓ | ✓ | Set in brief |
| `internal_links` | - | ✓ | ✓ | Set in brief |
| `external_references` | - | ✓ | ✓ | Set in brief |
| `competitor_examples` | - | ✓ | ✓ | Set in brief |
| **Content-Specific Fields** |
| `body` | - | - | ✓ | EditorJS content |
| `storyblok_url` | - | - | ✓ | CMS link |
| `story_id` | - | - | ✓ | Storyblok ID |
| `due_date` | - | - | ✓ | When content is due |
| `scheduled_date` | - | - | ✓ | When to publish |
| `publish_date` | - | - | ✓ | When published |
| `display_order` | - | - | ✓ | Kanban ordering |

---

## Promotion Transformations

### Pitch → Brief

When an idea is promoted to a brief:

```
┌────────────────────────────────────────────────────────────┐
│                    TRANSFORMATIONS                          │
├────────────────────────────────────────────────────────────┤
│  stage:            'idea' → 'brief'                        │
│  idea_status:      'approved' → 'converted'                │
│  brief_status:     null → 'draft'                          │
│  slug:             null → generated from title             │
│  potential_keywords → secondary_keywords (strings only)    │
│                                                            │
│  All other fields: PRESERVED                               │
└────────────────────────────────────────────────────────────┘
```

**Code location:** `app/(dashboard)/strategy/actions.ts` → `promoteContent()`

### Brief → Content

When a brief is promoted to content:

```
┌────────────────────────────────────────────────────────────┐
│                    TRANSFORMATIONS                          │
├────────────────────────────────────────────────────────────┤
│  stage:            'brief' → 'content'                     │
│  brief_status:     any → 'completed'                       │
│  workflow_status_id: null → initial workflow status        │
│                                                            │
│  All other fields: PRESERVED                               │
└────────────────────────────────────────────────────────────┘
```

---

## Visual Flow

```
PITCH (idea)                    BRIEF                         CONTENT
─────────────                   ─────                         ───────
title ─────────────────────────→ title ───────────────────────→ title
description ───────────────────→ summary ─────────────────────→ summary
source ────────────────────────→ source ──────────────────────→ source
target_audience ───────────────→ target_audience ─────────────→ target_audience
potential_keywords ────┐
                       ├───────→ secondary_keywords ──────────→ secondary_keywords
                       │         primary_keyword ─────────────→ primary_keyword
                       │         (set manually)
                       └───────→ potential_keywords ──────────→ potential_keywords
                                 (preserved for reference)

content_type_id ───────────────→ content_type_id ─────────────→ content_type_id
campaign_id ───────────────────→ campaign_id ─────────────────→ campaign_id
priority ──────────────────────→ priority ────────────────────→ priority
notes ─────────────────────────→ notes ───────────────────────→ notes

idea_status ───────────────────→ (converted) ─────────────────→ (converted)
                                 brief_status ─────────────────→ (completed)
                                                                 workflow_status_id

                                 search_intent ───────────────→ search_intent
                                 target_word_count ────────────→ target_word_count
                                 content_goals ────────────────→ content_goals
                                 tone_and_style ───────────────→ tone_and_style
                                 outline ──────────────────────→ outline

                                                                 body
                                                                 due_date
                                                                 scheduled_date
                                                                 publish_date
```

---

## Key Benefits of Unified Model

1. **No data loss** - All fields are preserved when promoting between stages
2. **Single ID** - Content keeps the same ID throughout its lifecycle
3. **Full history** - Can see original pitch data even on published content
4. **Simpler queries** - One table with stage filter vs. three separate tables
5. **Atomic updates** - Promotion is a single UPDATE, not INSERT + DELETE
