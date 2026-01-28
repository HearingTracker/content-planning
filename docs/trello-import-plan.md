# Trello Import Plan

## Overview

Import cards from Trello Publishing board into the content planning system.

## Entity Mapping

| Trello List | → | Entity | Status |
|-------------|---|--------|--------|
| Pitches | → | `cp_content_ideas` | submitted |
| New Articles Queue | → | `cp_content_briefs` | draft |
| Update Queue | → | `cp_content_briefs` | draft (is_update=true) |
| Assigned | → | `cp_content_items` | draft |
| Submitted | → | `cp_content_items` | in_review |
| Published | → | `cp_content_items` | published |
| Interlinked | → | `cp_content_items` | published |
| Done | → | `cp_content_items` | archived |
| SEO Research | → | *skipped* | - |

## Field Mapping

### Content Items (from Assigned, Submitted, Published, Interlinked, Done lists)

| Trello | → | cp_content_items | Notes |
|--------|---|------------------|-------|
| `name` | → | `title` | Direct mapping |
| Live URL path | → | `slug` | Extract from hearingtracker.com URL |
| `labels[].name` | → | `content_type_id` | Resource→guide, Best List→best-list, etc. |
| `idList` | → | `workflow_status_id` | Based on list mapping |
| `due` | → | `due_date` | ISO date |
| Storyblok URL | → | `storyblok_url` | From description |
| Urgent label | → | `priority` | urgent/medium/low |
| Keywords | → | `seo_metadata.keywords[]` | Parsed with volumes |
| FAQs | → | `metadata.faqs[]` | Parsed list |
| Outline | → | `metadata.outline` | Raw text |
| `id` | → | `metadata.trello_card_id` | For deduplication |
| `url` | → | `metadata.trello_url` | Reference |
| Live URL | → | `metadata.live_url` | Reference |

### Content Links (cp_content_links)

For each content item, create links for:

| Source | link_type | Notes |
|--------|-----------|-------|
| Trello card URL | `trello` | Always created |
| Live site URL | `live_url` | If exists |
| Google Docs/Sheets | `reference` | From description or attachments |
| Competitor URLs | `competitor` | From Competitors section |

### Briefs (from Queue lists)

| Trello | → | cp_content_briefs | Notes |
|--------|---|-------------------|-------|
| `name` | → | `title` | Direct mapping |
| SEO title | → | `summary` | From description |
| Slug | → | `slug` | From description |
| Primary keyword | → | `primary_keyword` | Parsed |
| Keywords | → | `secondary_keywords[]` | Parsed with volumes |
| Internal links | → | `internal_links[]` | URLs |
| Forum/External | → | `external_references[]` | URLs |
| Outline | → | `outline` | As JSON array |
| Update label | → | `metadata.is_update` | Boolean |
| FAQs | → | `metadata.faqs[]` | Parsed list |

### Ideas (from Pitches list)

| Trello | → | cp_content_ideas | Notes |
|--------|---|------------------|-------|
| `name` | → | `title` | Direct mapping |
| Description | → | `description` | Brief or notes |
| Forum Idea label | → | `source` | "forum" |
| Keywords | → | `potential_keywords[]` | Parsed |
| Urgent label | → | `priority` | urgent/medium/low |

## Skipped for Now

- **Assignments**: Trello members not mapped to system users
- **Attachments**: Image files require auth to download
- **Comments**: Not importing card comments

## Deduplication

Check `metadata.trello_card_id` before inserting to avoid duplicates.

## Running the Import

### Local (CLI)

```bash
# Preview (dry run)
npx tsx scripts/import-trello.ts --dry-run

# Import all, skip existing
npx tsx scripts/import-trello.ts

# Re-import all (including existing)
npx tsx scripts/import-trello.ts --force
```

### Production (API)

```bash
# Preview
curl -X GET /api/trello/import

# Import
curl -X POST /api/trello/import \
  -H "Content-Type: application/json" \
  -d '{"skipExisting": true}'
```

## Future Enhancements

1. **User Mapping**: Add `trello_username` to user_profiles
2. **Attachments**: Download images and upload to Supabase Storage
3. **Comments**: Import as cp_comments
4. **Sync**: Webhook for real-time sync from Trello
