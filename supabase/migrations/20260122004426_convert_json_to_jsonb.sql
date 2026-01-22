-- Convert all json columns to jsonb for better indexing and query performance
-- jsonb provides GIN indexing, containment operators, and deduplication

-- assets
ALTER TABLE public.assets
ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb;

-- brand_accessories
ALTER TABLE public.brand_accessories
ALTER COLUMN tags TYPE jsonb USING tags::jsonb,
ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- brand_hardware_features
ALTER TABLE public.brand_hardware_features
ALTER COLUMN options TYPE jsonb USING options::jsonb,
ALTER COLUMN options SET DEFAULT '[]'::jsonb;

-- brand_listening_modes
ALTER TABLE public.brand_listening_modes
ALTER COLUMN tags TYPE jsonb USING tags::jsonb,
ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- brand_software_features
ALTER TABLE public.brand_software_features
ALTER COLUMN options TYPE jsonb USING options::jsonb,
ALTER COLUMN options SET DEFAULT '[]'::jsonb;

-- hardware_features
ALTER TABLE public.hardware_features
ALTER COLUMN options TYPE jsonb USING options::jsonb,
ALTER COLUMN options SET DEFAULT '[]'::jsonb;

-- level_features
ALTER TABLE public.level_features
ALTER COLUMN excluded_model_ids TYPE jsonb USING excluded_model_ids::jsonb,
ALTER COLUMN excluded_model_ids SET DEFAULT '[]'::jsonb,
ALTER COLUMN value TYPE jsonb USING value::jsonb;

-- model_features
ALTER TABLE public.model_features
ALTER COLUMN excluded_level_ids TYPE jsonb USING excluded_level_ids::jsonb,
ALTER COLUMN excluded_level_ids SET DEFAULT '[]'::jsonb,
ALTER COLUMN value TYPE jsonb USING value::jsonb;

-- model_tags
ALTER TABLE public.model_tags
ALTER COLUMN configuration TYPE jsonb USING configuration::jsonb,
ALTER COLUMN configuration SET DEFAULT '{}'::jsonb;

-- models
ALTER TABLE public.models
ALTER COLUMN colors TYPE jsonb USING colors::jsonb,
ALTER COLUMN colors SET DEFAULT '[]'::jsonb,
ALTER COLUMN hearing_loss_level TYPE jsonb USING hearing_loss_level::jsonb,
ALTER COLUMN hearing_loss_level SET DEFAULT '[]'::jsonb,
ALTER COLUMN tags TYPE jsonb USING tags::jsonb,
ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- offers
ALTER TABLE public.offers
ALTER COLUMN channels TYPE jsonb USING channels::jsonb,
ALTER COLUMN channels SET DEFAULT '[]'::jsonb,
ALTER COLUMN countries TYPE jsonb USING countries::jsonb,
ALTER COLUMN countries SET DEFAULT '[]'::jsonb,
ALTER COLUMN regions TYPE jsonb USING regions::jsonb,
ALTER COLUMN regions SET DEFAULT '[]'::jsonb;

-- price_alerts
ALTER TABLE public.price_alerts
ALTER COLUMN history TYPE jsonb USING history::jsonb,
ALTER COLUMN history SET DEFAULT '[]'::jsonb;

-- release_features
ALTER TABLE public.release_features
ALTER COLUMN excluded_level_ids TYPE jsonb USING excluded_level_ids::jsonb,
ALTER COLUMN excluded_level_ids SET DEFAULT '[]'::jsonb,
ALTER COLUMN excluded_model_ids TYPE jsonb USING excluded_model_ids::jsonb,
ALTER COLUMN excluded_model_ids SET DEFAULT '[]'::jsonb,
ALTER COLUMN value TYPE jsonb USING value::jsonb;

-- release_tags
ALTER TABLE public.release_tags
ALTER COLUMN configuration TYPE jsonb USING configuration::jsonb,
ALTER COLUMN configuration SET DEFAULT '{}'::jsonb;

-- releases
ALTER TABLE public.releases
ALTER COLUMN tags TYPE jsonb USING tags::jsonb,
ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- reviews
ALTER TABLE public.reviews
ALTER COLUMN options TYPE jsonb USING options::jsonb;

-- sellers
ALTER TABLE public.sellers
ALTER COLUMN channels TYPE jsonb USING channels::jsonb,
ALTER COLUMN channels SET DEFAULT '[]'::jsonb,
ALTER COLUMN features TYPE jsonb USING features::jsonb,
ALTER COLUMN features SET DEFAULT '[]'::jsonb;

-- software_features
ALTER TABLE public.software_features
ALTER COLUMN options TYPE jsonb USING options::jsonb,
ALTER COLUMN options SET DEFAULT '[]'::jsonb;

-- stories
ALTER TABLE public.stories
ALTER COLUMN story TYPE jsonb USING story::jsonb,
ALTER COLUMN story SET DEFAULT '{}'::jsonb;
