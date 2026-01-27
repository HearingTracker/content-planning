-- Add display_order column for kanban card ordering within columns
ALTER TABLE cp_content_items ADD COLUMN display_order integer DEFAULT 0;

-- Set initial display_order based on created_at (newest first gets lower order)
WITH ordered_items AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY workflow_status_id ORDER BY created_at DESC) - 1 as new_order
  FROM cp_content_items
)
UPDATE cp_content_items
SET display_order = ordered_items.new_order
FROM ordered_items
WHERE cp_content_items.id = ordered_items.id;

-- Create index for efficient ordering queries
CREATE INDEX idx_content_items_status_order ON cp_content_items(workflow_status_id, display_order);
