-- Add new content types for Trello label mapping
INSERT INTO cp_content_types (name, slug, description, is_active)
VALUES
  ('Brand Page', 'brand-page', 'Brand overview and information page', true),
  ('Product Page', 'product-page', 'Individual product review or information page', true),
  ('Opinion', 'opinion', 'Opinion piece or editorial content', true)
ON CONFLICT (slug) DO NOTHING;
