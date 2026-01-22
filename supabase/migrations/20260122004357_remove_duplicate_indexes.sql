-- Remove duplicate indexes that are redundant with unique constraints
-- When a UNIQUE constraint exists, it already creates an index
-- These non-unique indexes on the same columns are unnecessary

DROP INDEX IF EXISTS public.assets_slug_index;
DROP INDEX IF EXISTS public.authors_slug_index;
DROP INDEX IF EXISTS public.brand_hardware_features_slug_index;
DROP INDEX IF EXISTS public.brand_software_features_slug_index;
DROP INDEX IF EXISTS public.brands_slug_index;
DROP INDEX IF EXISTS public.colors_slug_index;
DROP INDEX IF EXISTS public.coupons_slug_index;
DROP INDEX IF EXISTS public.hardware_features_slug_index;
DROP INDEX IF EXISTS public.levels_slug_index;
DROP INDEX IF EXISTS public.listening_mode_tags_tag_index;
DROP INDEX IF EXISTS public.models_slug_index;
DROP INDEX IF EXISTS public.products_slug_index;
DROP INDEX IF EXISTS public.releases_slug_index;
DROP INDEX IF EXISTS public.sellers_slug_index;
DROP INDEX IF EXISTS public.software_features_slug_index;
DROP INDEX IF EXISTS public.stories_slug_index;
DROP INDEX IF EXISTS public.styles_slug_index;
