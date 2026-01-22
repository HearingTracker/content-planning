-- Enable Row Level Security on all public tables
-- This prevents unauthorized access via PostgREST/Supabase client

ALTER TABLE public.accessory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acoustic_profile_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acoustic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adonis_schema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adonis_schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_accessory_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_hardware_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_listening_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_software_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.color_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hear_advisor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ht_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_listening_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_mode_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.styles ENABLE ROW LEVEL SECURITY;

-- Create read-only policies for public catalog data (anonymous users can read)
CREATE POLICY "Allow public read access" ON public.accessory_tags FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.acoustic_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.acoustic_profile_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.authors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brand_accessories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brand_accessory_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brand_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brand_hardware_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brand_listening_modes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brand_software_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.color_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.colors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.hardware_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.ht_ratings FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.level_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.level_listening_modes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.levels FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.listening_mode_tags FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.model_accessories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.model_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.model_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.model_tags FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.models FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.offer_coupons FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.offers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.product_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.published_stories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.redirects FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.release_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.release_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.release_tags FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.releases FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.seller_assets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.sellers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.software_features FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.styles FOR SELECT USING (true);

-- Sensitive tables have RLS enabled but NO public policies
-- This means only service_role can access: price_alerts, reviews, evaluations,
-- hear_advisor_metrics, draft_stories, adonis_schema, adonis_schema_versions
