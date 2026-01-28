-- Add Resource content type
INSERT INTO cp_content_types (name, slug, description, is_active)
VALUES ('Resource', 'resource', 'Educational resource or informational content', true)
ON CONFLICT (slug) DO NOTHING;
