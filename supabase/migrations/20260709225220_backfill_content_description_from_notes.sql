-- The content card's Details tab now surfaces `description` as "Summary" (the
-- column a promoted brief's Summary already lands in), and the Kanban card
-- renders it as the preview line. Content that predates the unified model --
-- notably the Trello import, which only ever wrote `notes` for stage='content'
-- rows -- has no `description`, so those cards would render a blank preview.
--
-- Copy notes across for those rows only. `notes` is left intact: it is now
-- surfaced as "Additional Notes" on the Content tab.
update public.cp_content
   set description = notes
 where stage = 'content'
   and coalesce(description, '') = ''
   and coalesce(notes, '') <> '';
