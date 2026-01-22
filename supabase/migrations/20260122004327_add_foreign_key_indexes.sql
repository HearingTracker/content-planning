-- Add indexes on unindexed foreign keys for better JOIN performance
-- These indexes speed up queries that join tables via foreign keys

-- acoustic_profile_assets
CREATE INDEX IF NOT EXISTS idx_acoustic_profile_assets_asset_id
ON public.acoustic_profile_assets (asset_id);

-- brand_accessory_assets
CREATE INDEX IF NOT EXISTS idx_brand_accessory_assets_asset_id
ON public.brand_accessory_assets (asset_id);

-- brand_accessories
CREATE INDEX IF NOT EXISTS idx_brand_accessories_brand_id
ON public.brand_accessories (brand_id);

-- brand_assets
CREATE INDEX IF NOT EXISTS idx_brand_assets_asset_id
ON public.brand_assets (asset_id);

-- brand_hardware_features
CREATE INDEX IF NOT EXISTS idx_brand_hardware_features_hardware_feature_id
ON public.brand_hardware_features (hardware_feature_id);

-- brand_listening_modes
CREATE INDEX IF NOT EXISTS idx_brand_listening_modes_brand_id
ON public.brand_listening_modes (brand_id);

-- brand_software_features
CREATE INDEX IF NOT EXISTS idx_brand_software_features_software_feature_id
ON public.brand_software_features (software_feature_id);

-- color_assets
CREATE INDEX IF NOT EXISTS idx_color_assets_asset_id
ON public.color_assets (asset_id);

-- colors
CREATE INDEX IF NOT EXISTS idx_colors_brand_id
ON public.colors (brand_id);

-- hear_advisor_metrics
CREATE INDEX IF NOT EXISTS idx_hear_advisor_metrics_product_id
ON public.hear_advisor_metrics (product_id);

-- level_features
CREATE INDEX IF NOT EXISTS idx_level_features_brand_software_feature_id
ON public.level_features (brand_software_feature_id);

-- level_listening_modes
CREATE INDEX IF NOT EXISTS idx_level_listening_modes_brand_listening_mode_id
ON public.level_listening_modes (brand_listening_mode_id);

-- levels
CREATE INDEX IF NOT EXISTS idx_levels_release_id
ON public.levels (release_id);

-- model_accessories
CREATE INDEX IF NOT EXISTS idx_model_accessories_brand_accessory_id
ON public.model_accessories (brand_accessory_id);

-- model_assets
CREATE INDEX IF NOT EXISTS idx_model_assets_asset_id
ON public.model_assets (asset_id);

-- model_features
CREATE INDEX IF NOT EXISTS idx_model_features_brand_hardware_feature_id
ON public.model_features (brand_hardware_feature_id);

-- models
CREATE INDEX IF NOT EXISTS idx_models_release_id
ON public.models (release_id);

CREATE INDEX IF NOT EXISTS idx_models_style_id
ON public.models (style_id);

-- offer_coupons
CREATE INDEX IF NOT EXISTS idx_offer_coupons_coupon_id
ON public.offer_coupons (coupon_id);

-- offers (multiple FKs)
CREATE INDEX IF NOT EXISTS idx_offers_seller_id
ON public.offers (seller_id);

CREATE INDEX IF NOT EXISTS idx_offers_release_id
ON public.offers (release_id);

CREATE INDEX IF NOT EXISTS idx_offers_level_id
ON public.offers (level_id);

CREATE INDEX IF NOT EXISTS idx_offers_product_id
ON public.offers (product_id);

-- price_alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_level_id
ON public.price_alerts (level_id);

-- product_assets
CREATE INDEX IF NOT EXISTS idx_product_assets_asset_id
ON public.product_assets (asset_id);

-- products
CREATE INDEX IF NOT EXISTS idx_products_level_id
ON public.products (level_id);

CREATE INDEX IF NOT EXISTS idx_products_model_id
ON public.products (model_id);

-- release_assets
CREATE INDEX IF NOT EXISTS idx_release_assets_asset_id
ON public.release_assets (asset_id);

-- release_features
CREATE INDEX IF NOT EXISTS idx_release_features_brand_software_feature_id
ON public.release_features (brand_software_feature_id);

-- releases
CREATE INDEX IF NOT EXISTS idx_releases_brand_id
ON public.releases (brand_id);

-- reviews (multiple FKs)
CREATE INDEX IF NOT EXISTS idx_reviews_release_id
ON public.reviews (release_id);

CREATE INDEX IF NOT EXISTS idx_reviews_model_id
ON public.reviews (model_id);

CREATE INDEX IF NOT EXISTS idx_reviews_level_id
ON public.reviews (level_id);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id
ON public.reviews (product_id);

-- seller_assets
CREATE INDEX IF NOT EXISTS idx_seller_assets_asset_id
ON public.seller_assets (asset_id);
