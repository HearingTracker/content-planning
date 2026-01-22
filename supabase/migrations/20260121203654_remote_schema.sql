


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";








ALTER SCHEMA "public" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS '@graphql({"max_rows": 1000})';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  execute sql;
end;
$$;


ALTER FUNCTION "public"."exec_sql"("sql" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accessory_tags" (
    "id" bigint NOT NULL,
    "tag" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."accessory_tags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."accessory_tags_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."accessory_tags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."accessory_tags_id_seq" OWNED BY "public"."accessory_tags"."id";



CREATE TABLE IF NOT EXISTS "public"."acoustic_profile_assets" (
    "id" bigint NOT NULL,
    "acoustic_profile_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "acoustic_profile_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."acoustic_profile_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."acoustic_profile_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."acoustic_profile_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."acoustic_profile_assets_id_seq" OWNED BY "public"."acoustic_profile_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."acoustic_profiles" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "reference_test_gain" integer,
    "maximum_output" integer,
    "maximum_output_high_frequency_average" integer,
    "maximum_gain" integer,
    "maximum_gain_high_frequency_average" integer,
    "total_harmonic_distortion_500Hz" numeric(3,1),
    "total_harmonic_distortion_800Hz" numeric(3,1),
    "total_harmonic_distortion_1600Hz" numeric(3,1),
    "telecoil_sensitivity_max" integer,
    "telecoil_spliv" integer,
    "telecoil_splits" integer,
    "telecoil_full_on_sensitivity" integer,
    "equivalent_input_noise" integer,
    "frequency_range_low" integer,
    "frequency_range_high" integer,
    "current_drain" numeric(3,1),
    "coupler_type" character varying(255),
    "device_reviews_count" integer DEFAULT 0,
    "score" integer DEFAULT 0,
    "minimum_250_hz" integer,
    "minimum_500_hz" integer,
    "minimum_750_hz" integer,
    "minimum_1000_hz" integer,
    "minimum_1500_hz" integer,
    "minimum_2000_hz" integer,
    "minimum_3000_hz" integer,
    "minimum_4000_hz" integer,
    "minimum_6000_hz" integer,
    "minimum_8000_hz" integer,
    "maximum_250_hz" integer,
    "maximum_500_hz" integer,
    "maximum_750_hz" integer,
    "maximum_1000_hz" integer,
    "maximum_1500_hz" integer,
    "maximum_2000_hz" integer,
    "maximum_3000_hz" integer,
    "maximum_4000_hz" integer,
    "maximum_6000_hz" integer,
    "maximum_8000_hz" integer,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."acoustic_profiles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."acoustic_profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."acoustic_profiles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."acoustic_profiles_id_seq" OWNED BY "public"."acoustic_profiles"."id";



CREATE TABLE IF NOT EXISTS "public"."adonis_schema" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "batch" integer NOT NULL,
    "migration_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."adonis_schema" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."adonis_schema_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."adonis_schema_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."adonis_schema_id_seq" OWNED BY "public"."adonis_schema"."id";



CREATE TABLE IF NOT EXISTS "public"."adonis_schema_versions" (
    "version" integer NOT NULL
);


ALTER TABLE "public"."adonis_schema_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "url" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" character varying(255),
    "content_type" character varying(255) NOT NULL,
    "metadata" json NOT NULL,
    "record_type" character varying(255) NOT NULL,
    "record_id" bigint NOT NULL,
    "usage" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."assets_id_seq" OWNED BY "public"."assets"."id";



CREATE TABLE IF NOT EXISTS "public"."authors" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "about" "text" NOT NULL,
    "about_brief" character varying(255) NOT NULL,
    "about_markdown" "text" NOT NULL,
    "avatar_url" character varying(255) NOT NULL,
    "facebook" character varying(255),
    "instagram" character varying(255),
    "linkedin" character varying(255),
    "twitter" character varying(255),
    "youtube" character varying(255),
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."authors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."authors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."authors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."authors_id_seq" OWNED BY "public"."authors"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_accessories" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "brand_id" bigint NOT NULL,
    "about" "text" NOT NULL,
    "tags" json DEFAULT '[]'::json NOT NULL,
    "purchase_link" character varying(255),
    "product_id" character varying(255),
    "sku" character varying(255),
    "price" character varying(255),
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."brand_accessories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brand_accessories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brand_accessories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brand_accessories_id_seq" OWNED BY "public"."brand_accessories"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_accessory_assets" (
    "id" bigint NOT NULL,
    "brand_accessory_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "brand_accessory_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."brand_accessory_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brand_accessory_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brand_accessory_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brand_accessory_assets_id_seq" OWNED BY "public"."brand_accessory_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_assets" (
    "id" bigint NOT NULL,
    "brand_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "brand_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."brand_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brand_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brand_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brand_assets_id_seq" OWNED BY "public"."brand_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_hardware_features" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "brand_id" bigint NOT NULL,
    "proprietary_name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "data_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "hardware_feature_id" bigint NOT NULL,
    "options_name" character varying(255),
    "disclaimer" boolean DEFAULT true,
    "options" json DEFAULT '[]'::json NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "brand_hardware_features_data_type_check" CHECK (("data_type" = ANY (ARRAY['text'::"text", 'singleOption'::"text", 'multipleOptions'::"text"])))
);


ALTER TABLE "public"."brand_hardware_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brand_hardware_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brand_hardware_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brand_hardware_features_id_seq" OWNED BY "public"."brand_hardware_features"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_listening_modes" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "brand_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "automatic_group_name" character varying(255),
    "streaming" boolean DEFAULT false,
    "tags" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."brand_listening_modes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brand_listening_modes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brand_listening_modes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brand_listening_modes_id_seq" OWNED BY "public"."brand_listening_modes"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_software_features" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "brand_id" bigint NOT NULL,
    "proprietary_name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "data_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "software_feature_id" bigint NOT NULL,
    "options_name" character varying(255),
    "disclaimer" boolean DEFAULT true,
    "options" json DEFAULT '[]'::json NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "brand_software_features_data_type_check" CHECK (("data_type" = ANY (ARRAY['text'::"text", 'singleOption'::"text", 'multipleOptions'::"text"])))
);


ALTER TABLE "public"."brand_software_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brand_software_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brand_software_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brand_software_features_id_seq" OWNED BY "public"."brand_software_features"."id";



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "hidden" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."brands_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."brands_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."brands_id_seq" OWNED BY "public"."brands"."id";



CREATE TABLE IF NOT EXISTS "public"."color_assets" (
    "id" bigint NOT NULL,
    "color_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "color_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."color_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."color_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."color_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."color_assets_id_seq" OWNED BY "public"."color_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."colors" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "hex" character varying(255),
    "brand_id" bigint,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."colors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."colors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."colors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."colors_id_seq" OWNED BY "public"."colors"."id";



CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "amount_off" numeric(9,2),
    "code" character varying(255) NOT NULL,
    "expires_at" "date",
    "message" "text" NOT NULL,
    "percent_off" numeric(5,2),
    "style" "text" DEFAULT 'link'::"text" NOT NULL,
    "url" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "coupons_style_check" CHECK (("style" = ANY (ARRAY['link'::"text", 'banner'::"text", 'copy'::"text"])))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coupons_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coupons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coupons_id_seq" OWNED BY "public"."coupons"."id";



CREATE TABLE IF NOT EXISTS "public"."draft_stories" (
    "id" bigint NOT NULL,
    "storyblok_id" bigint,
    "name" "text",
    "uuid" "uuid",
    "slug" "text",
    "full_slug" "text",
    "lang" "text",
    "parent_id" bigint,
    "group_id" "uuid",
    "position" integer,
    "is_startpage" boolean,
    "first_published_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "content" "jsonb",
    "sort_by_date" timestamp with time zone,
    "tag_list" "jsonb",
    "meta_data" "jsonb",
    "release_id" bigint,
    "path" "text",
    "alternates" "jsonb",
    "default_full_slug" "text",
    "translated_slugs" "jsonb"
);


ALTER TABLE "public"."draft_stories" OWNER TO "postgres";


ALTER TABLE "public"."draft_stories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."draft_stories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."evaluations" (
    "id" integer NOT NULL,
    "average_metrics" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dropbox_id" "text",
    "ear_coupling" "text",
    "evaluation_id" "text",
    "feedback_handling" numeric,
    "fit_score" numeric,
    "fit_score_adjusted" numeric,
    "fit_score_normalized" numeric,
    "fit_type" "text",
    "fitting_formula" "text",
    "listening_program" "text",
    "metrics_version" "text",
    "music_streaming" numeric,
    "noisy_audio" "text",
    "notes" "text",
    "own_voice" numeric,
    "product_id" integer,
    "quiet_audio" "text",
    "radar_values" "jsonb",
    "receiver" "text",
    "reig55" "jsonb",
    "reig65" "jsonb",
    "reig75" "jsonb",
    "results_description" "text",
    "software_version" "text",
    "speech_in_noise" numeric,
    "speech_in_quiet" numeric,
    "streaming_music_audio" "text",
    "target_audiogram_id" integer,
    "tested_on" timestamp with time zone,
    "tuning_adjustments" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "volume_setting" "text"
);


ALTER TABLE "public"."evaluations" OWNER TO "postgres";


ALTER TABLE "public"."evaluations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."evaluations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."hardware_features" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "data_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "options_name" character varying(255),
    "options" json DEFAULT '[]'::json NOT NULL,
    "disclaimer" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "hardware_features_data_type_check" CHECK (("data_type" = ANY (ARRAY['text'::"text", 'singleOption'::"text", 'multipleOptions'::"text"])))
);


ALTER TABLE "public"."hardware_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."hardware_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."hardware_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."hardware_features_id_seq" OWNED BY "public"."hardware_features"."id";



CREATE TABLE IF NOT EXISTS "public"."hear_advisor_metrics" (
    "id" bigint NOT NULL,
    "streaming" numeric(5,2),
    "quiet" numeric(5,2),
    "loud" numeric(5,2),
    "boomy" numeric(5,2),
    "feedback" numeric(5,2),
    "tuned" boolean NOT NULL,
    "product_id" bigint NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."hear_advisor_metrics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."hear_advisor_metrics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."hear_advisor_metrics_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."hear_advisor_metrics_id_seq" OWNED BY "public"."hear_advisor_metrics"."id";



CREATE TABLE IF NOT EXISTS "public"."ht_ratings" (
    "id" integer NOT NULL,
    "product_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sound_score" numeric(3,1),
    "build_quality" numeric(3,1),
    "battery" numeric(3,1),
    "bluetooth" numeric(3,1),
    "app_features" numeric(3,1),
    "comfort" numeric(3,1),
    "design" numeric(3,1),
    "pro_support" numeric(3,1),
    "handling" numeric(3,1),
    "sound_score_comment" "text",
    "build_quality_comment" "text",
    "battery_comment" "text",
    "bluetooth_comment" "text",
    "app_features_comment" "text",
    "comfort_comment" "text",
    "design_comment" "text",
    "pro_support_comment" "text",
    "handling_comment" "text",
    "value_comment" "text",
    "speech_in_quiet_description" "text",
    "speech_in_noise_description" "text",
    "streaming_music_description" "text",
    "weighted_score" numeric(5,2),
    "normalized_price" numeric(5,2),
    "value" numeric(3,1),
    "ht_score" numeric(3,1),
    "note" "text",
    "airtable_id" integer
);


ALTER TABLE "public"."ht_ratings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ht_ratings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ht_ratings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ht_ratings_id_seq" OWNED BY "public"."ht_ratings"."id";



CREATE TABLE IF NOT EXISTS "public"."level_features" (
    "id" bigint NOT NULL,
    "level_id" bigint NOT NULL,
    "brand_software_feature_id" bigint NOT NULL,
    "value" json,
    "excluded_model_ids" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."level_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."level_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."level_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."level_features_id_seq" OWNED BY "public"."level_features"."id";



CREATE TABLE IF NOT EXISTS "public"."level_listening_modes" (
    "id" bigint NOT NULL,
    "level_id" bigint NOT NULL,
    "brand_listening_mode_id" bigint NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."level_listening_modes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."level_listening_modes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."level_listening_modes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."level_listening_modes_id_seq" OWNED BY "public"."level_listening_modes"."id";



CREATE TABLE IF NOT EXISTS "public"."levels" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "release_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "level" integer NOT NULL,
    "from_styles" boolean DEFAULT false,
    "score" integer,
    "reviews_count" integer DEFAULT 0 NOT NULL,
    "financing" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."levels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."levels_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."levels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."levels_id_seq" OWNED BY "public"."levels"."id";



CREATE TABLE IF NOT EXISTS "public"."listening_mode_tags" (
    "id" bigint NOT NULL,
    "tag" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."listening_mode_tags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."listening_mode_tags_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."listening_mode_tags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."listening_mode_tags_id_seq" OWNED BY "public"."listening_mode_tags"."id";



CREATE TABLE IF NOT EXISTS "public"."model_accessories" (
    "id" bigint NOT NULL,
    "model_id" bigint NOT NULL,
    "brand_accessory_id" bigint NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."model_accessories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."model_accessories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."model_accessories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."model_accessories_id_seq" OWNED BY "public"."model_accessories"."id";



CREATE TABLE IF NOT EXISTS "public"."model_assets" (
    "id" bigint NOT NULL,
    "model_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "model_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."model_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."model_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."model_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."model_assets_id_seq" OWNED BY "public"."model_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."model_features" (
    "id" bigint NOT NULL,
    "model_id" bigint NOT NULL,
    "brand_hardware_feature_id" bigint NOT NULL,
    "value" json,
    "excluded_level_ids" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."model_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."model_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."model_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."model_features_id_seq" OWNED BY "public"."model_features"."id";



CREATE TABLE IF NOT EXISTS "public"."model_tags" (
    "id" bigint NOT NULL,
    "tag" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "configuration" json DEFAULT '{}'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."model_tags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."model_tags_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."model_tags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."model_tags_id_seq" OWNED BY "public"."model_tags"."id";



CREATE TABLE IF NOT EXISTS "public"."models" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "release_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "release_date" "date",
    "hearing_loss_level" json DEFAULT '[]'::json NOT NULL,
    "product_type" "text" NOT NULL,
    "description" "text",
    "feature_text" "text",
    "style_id" bigint NOT NULL,
    "primary" boolean DEFAULT false,
    "from_styles" boolean DEFAULT false,
    "device_reviews_count" integer DEFAULT 0,
    "power_aid" boolean DEFAULT false,
    "disposable" boolean DEFAULT false,
    "discontinued" boolean DEFAULT false,
    "score" integer DEFAULT 0,
    "colors" json DEFAULT '[]'::json NOT NULL,
    "tags" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "models_product_type_check" CHECK (("product_type" = ANY (ARRAY['Amplifier'::"text", 'Bone Anchored Hearing Aid'::"text", 'Cochlear Implant'::"text", 'Direct To Consumer Hearing Aid'::"text", 'Hearable'::"text", 'Hearing Aid'::"text"])))
);


ALTER TABLE "public"."models" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."models_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."models_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."models_id_seq" OWNED BY "public"."models"."id";



CREATE TABLE IF NOT EXISTS "public"."offer_coupons" (
    "id" bigint NOT NULL,
    "offer_id" bigint NOT NULL,
    "coupon_id" bigint NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."offer_coupons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."offer_coupons_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."offer_coupons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."offer_coupons_id_seq" OWNED BY "public"."offer_coupons"."id";



CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" bigint NOT NULL,
    "seller_id" bigint NOT NULL,
    "release_id" bigint NOT NULL,
    "level_id" bigint,
    "product_id" bigint,
    "price" numeric(10,2) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "url" character varying(255) NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "channels" json DEFAULT '[]'::json NOT NULL,
    "click_text" character varying(255),
    "countries" json DEFAULT '[]'::json NOT NULL,
    "currency" character varying(255) DEFAULT 'USD'::character varying NOT NULL,
    "lease_price" numeric(10,2),
    "price_type" "text" DEFAULT 'pair'::"text" NOT NULL,
    "regions" json DEFAULT '[]'::json NOT NULL,
    "seller_reference" character varying(255),
    "seller_timestamp" timestamp with time zone,
    "tagline" character varying(255),
    "unit_price" numeric(10,2),
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "offers_price_type_check" CHECK (("price_type" = ANY (ARRAY['pair'::"text", 'single'::"text"])))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."offers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."offers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."offers_id_seq" OWNED BY "public"."offers"."id";



CREATE TABLE IF NOT EXISTS "public"."price_alerts" (
    "id" bigint NOT NULL,
    "active" boolean NOT NULL,
    "email" character varying(255) NOT NULL,
    "user_price" numeric(6,2) NOT NULL,
    "level_id" bigint NOT NULL,
    "best_offer_price" numeric(6,2) NOT NULL,
    "history" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."price_alerts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_alerts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_alerts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_alerts_id_seq" OWNED BY "public"."price_alerts"."id";



CREATE TABLE IF NOT EXISTS "public"."product_assets" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "product_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."product_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_assets_id_seq" OWNED BY "public"."product_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "model_id" bigint NOT NULL,
    "level_id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "expert_choice_winner" boolean DEFAULT false,
    "featured" boolean DEFAULT false,
    "featured_weighting" numeric(10,2) DEFAULT '1'::numeric,
    "from_styles" boolean DEFAULT false,
    "home_featured" boolean DEFAULT false,
    "name_override" boolean DEFAULT false,
    "monthly_view_count" integer DEFAULT 0,
    "reviews_count" integer DEFAULT 0,
    "score" integer,
    "sound_score" numeric(10,2),
    "view_count" integer DEFAULT 0,
    "weighted_average" numeric(10,2) DEFAULT '0'::numeric,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."products_id_seq" OWNED BY "public"."products"."id";



CREATE TABLE IF NOT EXISTS "public"."published_stories" (
    "id" bigint NOT NULL,
    "storyblok_id" bigint,
    "name" "text",
    "uuid" "uuid",
    "slug" "text",
    "full_slug" "text",
    "lang" "text",
    "parent_id" bigint,
    "group_id" "uuid",
    "position" integer,
    "is_startpage" boolean,
    "first_published_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "content" "jsonb",
    "sort_by_date" timestamp with time zone,
    "tag_list" "jsonb",
    "meta_data" "jsonb",
    "release_id" bigint,
    "path" "text",
    "alternates" "jsonb",
    "default_full_slug" "text",
    "translated_slugs" "jsonb"
);


ALTER TABLE "public"."published_stories" OWNER TO "postgres";


ALTER TABLE "public"."published_stories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."published_stories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."redirects" (
    "id" bigint NOT NULL,
    "old_path" "text" NOT NULL,
    "new_path" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."redirects" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."redirects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."redirects_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."redirects_id_seq" OWNED BY "public"."redirects"."id";



CREATE TABLE IF NOT EXISTS "public"."release_assets" (
    "id" bigint NOT NULL,
    "release_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "release_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text", 'transparent_image'::"text", 'head_left_image'::"text", 'head_right_image'::"text"])))
);


ALTER TABLE "public"."release_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."release_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."release_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."release_assets_id_seq" OWNED BY "public"."release_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."release_features" (
    "id" bigint NOT NULL,
    "release_id" bigint NOT NULL,
    "brand_software_feature_id" bigint NOT NULL,
    "value" json,
    "excluded_level_ids" json DEFAULT '[]'::json NOT NULL,
    "excluded_model_ids" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."release_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."release_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."release_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."release_features_id_seq" OWNED BY "public"."release_features"."id";



CREATE TABLE IF NOT EXISTS "public"."release_tags" (
    "id" bigint NOT NULL,
    "tag" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "configuration" json DEFAULT '{}'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."release_tags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."release_tags_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."release_tags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."release_tags_id_seq" OWNED BY "public"."release_tags"."id";



CREATE TABLE IF NOT EXISTS "public"."releases" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "short_name" character varying(255),
    "family" character varying(255),
    "brand_id" bigint NOT NULL,
    "description" "text" NOT NULL,
    "meta_description" "text",
    "release_date" "date",
    "title" character varying(255),
    "heading" character varying(255),
    "product_class" "text" DEFAULT 'rX'::"text" NOT NULL,
    "product_type" "text" DEFAULT 'Hearing Aid'::"text" NOT NULL,
    "story_slug" character varying(255),
    "sort_order" integer DEFAULT 0,
    "reviews_count" integer DEFAULT 0 NOT NULL,
    "score" integer,
    "ghost_score" numeric(5,2),
    "alt_toc" boolean DEFAULT false,
    "compare_override" boolean DEFAULT false,
    "comparable" boolean DEFAULT false,
    "discontinued" boolean DEFAULT false,
    "all_page_views" integer DEFAULT 0 NOT NULL,
    "page_view_multiplier" numeric(5,2) DEFAULT '1'::numeric NOT NULL,
    "recent_page_views" integer DEFAULT 0 NOT NULL,
    "tags" json DEFAULT '[]'::json NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "releases_product_class_check" CHECK (("product_class" = ANY (ARRAY['rX'::"text", 'OTC'::"text", 'Hearable'::"text"]))),
    CONSTRAINT "releases_product_type_check" CHECK (("product_type" = ANY (ARRAY['Amplifier'::"text", 'Bone Anchored Hearing Aid'::"text", 'Cochlear Implant'::"text", 'Direct To Consumer Hearing Aid'::"text", 'Hearable'::"text", 'Hearing Aid'::"text"])))
);


ALTER TABLE "public"."releases" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."releases_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."releases_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."releases_id_seq" OWNED BY "public"."releases"."id";



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" bigint NOT NULL,
    "email" character varying(255),
    "user_id" character varying(255),
    "publishable" boolean DEFAULT false,
    "dismissed" boolean DEFAULT false,
    "completed" boolean DEFAULT false,
    "duplicate" boolean DEFAULT false,
    "moderated" boolean DEFAULT false,
    "thanked" boolean DEFAULT false,
    "release_id" bigint,
    "model_id" bigint,
    "level_id" bigint,
    "product_id" bigint,
    "fitting_type" "text",
    "score" integer DEFAULT 0 NOT NULL,
    "comment_text" "text",
    "comment_text_markdown" "text",
    "comment_title" character varying(255),
    "alt_style" character varying(255),
    "answer00" integer,
    "answer01" integer,
    "answer02" integer,
    "answer03" integer,
    "answer04" integer,
    "answer05" integer,
    "answer06" integer,
    "answer07" integer,
    "answer08" integer,
    "answer09" integer,
    "answer10" integer,
    "accessories" character varying(255),
    "battery_life" integer,
    "disp_flag_id" character varying(255),
    "dob" character varying(255),
    "experience" integer,
    "failed_fit" boolean DEFAULT false,
    "featured" boolean DEFAULT false,
    "fitted_by" integer,
    "hours" integer,
    "notify" boolean DEFAULT false,
    "options" json,
    "rems" character varying(255),
    "secret_code" character varying(255),
    "sex" character varying(255),
    "trial_length" integer,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "reviews_fitting_type_check" CHECK (("fitting_type" = ANY (ARRAY['Both'::"text", 'Left'::"text", 'Right'::"text"])))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reviews_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reviews_id_seq" OWNED BY "public"."reviews"."id";



CREATE TABLE IF NOT EXISTS "public"."seller_assets" (
    "id" bigint NOT NULL,
    "seller_id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "usage" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "seller_assets_usage_check" CHECK (("usage" = ANY (ARRAY['image'::"text", 'social_image'::"text", 'audio'::"text", 'video'::"text", 'document'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."seller_assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."seller_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."seller_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."seller_assets_id_seq" OWNED BY "public"."seller_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."sellers" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "blurb" "text" NOT NULL,
    "boost" integer DEFAULT 0,
    "channels" json DEFAULT '[]'::json NOT NULL,
    "features" json DEFAULT '[]'::json NOT NULL,
    "logo_url" character varying(255),
    "partner_type" "text" DEFAULT 'lead-gen'::"text" NOT NULL,
    "position" integer DEFAULT 0,
    "rating" numeric(3,2),
    "reviews" integer DEFAULT 0,
    "tagline" character varying(255) NOT NULL,
    "url" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "sellers_partner_type_check" CHECK (("partner_type" = ANY (ARRAY['lead-gen'::"text", 'affiliate'::"text", 'analytics-only'::"text"])))
);


ALTER TABLE "public"."sellers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sellers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sellers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sellers_id_seq" OWNED BY "public"."sellers"."id";



CREATE TABLE IF NOT EXISTS "public"."software_features" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "hidden" boolean DEFAULT false,
    "data_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "options_name" character varying(255),
    "options" json DEFAULT '[]'::json NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "software_features_data_type_check" CHECK (("data_type" = ANY (ARRAY['text'::"text", 'singleOption'::"text", 'multipleOptions'::"text"])))
);


ALTER TABLE "public"."software_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."software_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."software_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."software_features_id_seq" OWNED BY "public"."software_features"."id";



CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "title" character varying(255) NOT NULL,
    "story" json DEFAULT '{}'::json NOT NULL,
    "storyblok_id" bigint NOT NULL,
    "uuid" character varying(255) NOT NULL,
    "archived" boolean DEFAULT false,
    "author_text" character varying(255) NOT NULL,
    "description" "text",
    "featured" boolean DEFAULT false,
    "language" character varying(255) DEFAULT 'en'::character varying NOT NULL,
    "noindex" boolean DEFAULT false,
    "published" boolean DEFAULT false,
    "published_at" timestamp with time zone NOT NULL,
    "republished_at" timestamp with time zone,
    "all_page_views" integer,
    "page_view_multiplier" numeric(5,2) DEFAULT '1'::numeric,
    "recent_page_views" integer,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."stories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stories_id_seq" OWNED BY "public"."stories"."id";



CREATE TABLE IF NOT EXISTS "public"."styles" (
    "id" bigint NOT NULL,
    "slug" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "styles_category_check" CHECK (("category" = ANY (ARRAY['Receiver in Canal'::"text", 'Behind the Ear'::"text", 'In the Ear'::"text", 'In Canal'::"text", 'Not used'::"text"])))
);


ALTER TABLE "public"."styles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."styles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."styles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."styles_id_seq" OWNED BY "public"."styles"."id";



ALTER TABLE ONLY "public"."accessory_tags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."accessory_tags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."acoustic_profile_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."acoustic_profile_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."acoustic_profiles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."acoustic_profiles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."adonis_schema" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."adonis_schema_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."authors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."authors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_accessories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brand_accessories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_accessory_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brand_accessory_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brand_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_hardware_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brand_hardware_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_listening_modes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brand_listening_modes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_software_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brand_software_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brands" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."brands_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."color_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."color_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."colors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."colors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coupons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coupons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."hardware_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."hardware_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."hear_advisor_metrics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."hear_advisor_metrics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ht_ratings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ht_ratings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."level_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."level_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."level_listening_modes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."level_listening_modes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."levels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."levels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."listening_mode_tags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."listening_mode_tags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."model_accessories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."model_accessories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."model_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."model_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."model_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."model_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."model_tags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."model_tags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."models" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."models_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."offer_coupons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."offer_coupons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."offers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."offers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."price_alerts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_alerts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."products" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."products_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."redirects" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."redirects_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."release_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."release_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."release_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."release_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."release_tags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."release_tags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."releases" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."releases_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reviews" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reviews_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."seller_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."seller_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sellers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sellers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."software_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."software_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."styles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."styles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accessory_tags"
    ADD CONSTRAINT "accessory_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accessory_tags"
    ADD CONSTRAINT "accessory_tags_tag_unique" UNIQUE ("tag");



ALTER TABLE ONLY "public"."acoustic_profile_assets"
    ADD CONSTRAINT "acoustic_profile_assets_acoustic_profile_id_asset_id_usage_uniq" UNIQUE ("acoustic_profile_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."acoustic_profile_assets"
    ADD CONSTRAINT "acoustic_profile_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acoustic_profiles"
    ADD CONSTRAINT "acoustic_profiles_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."acoustic_profiles"
    ADD CONSTRAINT "acoustic_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acoustic_profiles"
    ADD CONSTRAINT "acoustic_profiles_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."adonis_schema"
    ADD CONSTRAINT "adonis_schema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adonis_schema_versions"
    ADD CONSTRAINT "adonis_schema_versions_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."brand_accessories"
    ADD CONSTRAINT "brand_accessories_brand_id_slug_unique" UNIQUE ("brand_id", "slug");



ALTER TABLE ONLY "public"."brand_accessories"
    ADD CONSTRAINT "brand_accessories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_accessory_assets"
    ADD CONSTRAINT "brand_accessory_assets_brand_accessory_id_asset_id_usage_unique" UNIQUE ("brand_accessory_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."brand_accessory_assets"
    ADD CONSTRAINT "brand_accessory_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_assets"
    ADD CONSTRAINT "brand_assets_brand_id_asset_id_usage_unique" UNIQUE ("brand_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."brand_assets"
    ADD CONSTRAINT "brand_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_hardware_features"
    ADD CONSTRAINT "brand_hardware_features_brand_id_proprietary_name_unique" UNIQUE ("brand_id", "proprietary_name");



ALTER TABLE ONLY "public"."brand_hardware_features"
    ADD CONSTRAINT "brand_hardware_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_hardware_features"
    ADD CONSTRAINT "brand_hardware_features_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."brand_listening_modes"
    ADD CONSTRAINT "brand_listening_modes_brand_id_slug_unique" UNIQUE ("brand_id", "slug");



ALTER TABLE ONLY "public"."brand_listening_modes"
    ADD CONSTRAINT "brand_listening_modes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_software_features"
    ADD CONSTRAINT "brand_software_features_brand_id_proprietary_name_unique" UNIQUE ("brand_id", "proprietary_name");



ALTER TABLE ONLY "public"."brand_software_features"
    ADD CONSTRAINT "brand_software_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_software_features"
    ADD CONSTRAINT "brand_software_features_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."color_assets"
    ADD CONSTRAINT "color_assets_color_id_asset_id_usage_unique" UNIQUE ("color_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."color_assets"
    ADD CONSTRAINT "color_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colors"
    ADD CONSTRAINT "colors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colors"
    ADD CONSTRAINT "colors_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."draft_stories"
    ADD CONSTRAINT "draft_stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hardware_features"
    ADD CONSTRAINT "hardware_features_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."hardware_features"
    ADD CONSTRAINT "hardware_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hardware_features"
    ADD CONSTRAINT "hardware_features_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."hear_advisor_metrics"
    ADD CONSTRAINT "hear_advisor_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ht_ratings"
    ADD CONSTRAINT "ht_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."level_features"
    ADD CONSTRAINT "level_features_level_id_brand_software_feature_id_unique" UNIQUE ("level_id", "brand_software_feature_id");



ALTER TABLE ONLY "public"."level_features"
    ADD CONSTRAINT "level_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."level_listening_modes"
    ADD CONSTRAINT "level_listening_modes_level_id_brand_listening_mode_id_unique" UNIQUE ("level_id", "brand_listening_mode_id");



ALTER TABLE ONLY "public"."level_listening_modes"
    ADD CONSTRAINT "level_listening_modes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."listening_mode_tags"
    ADD CONSTRAINT "listening_mode_tags_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."listening_mode_tags"
    ADD CONSTRAINT "listening_mode_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listening_mode_tags"
    ADD CONSTRAINT "listening_mode_tags_tag_unique" UNIQUE ("tag");



ALTER TABLE ONLY "public"."model_accessories"
    ADD CONSTRAINT "model_accessories_model_id_brand_accessory_id_unique" UNIQUE ("model_id", "brand_accessory_id");



ALTER TABLE ONLY "public"."model_accessories"
    ADD CONSTRAINT "model_accessories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_assets"
    ADD CONSTRAINT "model_assets_model_id_asset_id_usage_unique" UNIQUE ("model_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."model_assets"
    ADD CONSTRAINT "model_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_features"
    ADD CONSTRAINT "model_features_model_id_brand_hardware_feature_id_unique" UNIQUE ("model_id", "brand_hardware_feature_id");



ALTER TABLE ONLY "public"."model_features"
    ADD CONSTRAINT "model_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_tags"
    ADD CONSTRAINT "model_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_tags"
    ADD CONSTRAINT "model_tags_tag_unique" UNIQUE ("tag");



ALTER TABLE ONLY "public"."models"
    ADD CONSTRAINT "models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."models"
    ADD CONSTRAINT "models_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."offer_coupons"
    ADD CONSTRAINT "offer_coupons_offer_id_coupon_id_unique" UNIQUE ("offer_id", "coupon_id");



ALTER TABLE ONLY "public"."offer_coupons"
    ADD CONSTRAINT "offer_coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_alerts"
    ADD CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_product_id_asset_id_usage_unique" UNIQUE ("product_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_model_id_level_id_unique" UNIQUE ("model_id", "level_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."published_stories"
    ADD CONSTRAINT "published_stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."redirects"
    ADD CONSTRAINT "redirects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_assets"
    ADD CONSTRAINT "release_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_assets"
    ADD CONSTRAINT "release_assets_release_id_asset_id_usage_unique" UNIQUE ("release_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."release_features"
    ADD CONSTRAINT "release_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_features"
    ADD CONSTRAINT "release_features_release_id_brand_software_feature_id_unique" UNIQUE ("release_id", "brand_software_feature_id");



ALTER TABLE ONLY "public"."release_tags"
    ADD CONSTRAINT "release_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_tags"
    ADD CONSTRAINT "release_tags_tag_unique" UNIQUE ("tag");



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_full_name_unique" UNIQUE ("full_name");



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_assets"
    ADD CONSTRAINT "seller_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_assets"
    ADD CONSTRAINT "seller_assets_seller_id_asset_id_usage_unique" UNIQUE ("seller_id", "asset_id", "usage");



ALTER TABLE ONLY "public"."sellers"
    ADD CONSTRAINT "sellers_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."sellers"
    ADD CONSTRAINT "sellers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sellers"
    ADD CONSTRAINT "sellers_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."software_features"
    ADD CONSTRAINT "software_features_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."software_features"
    ADD CONSTRAINT "software_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."software_features"
    ADD CONSTRAINT "software_features_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_storyblok_id_unique" UNIQUE ("storyblok_id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_uuid_unique" UNIQUE ("uuid");



ALTER TABLE ONLY "public"."styles"
    ADD CONSTRAINT "styles_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."styles"
    ADD CONSTRAINT "styles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."styles"
    ADD CONSTRAINT "styles_slug_unique" UNIQUE ("slug");



CREATE INDEX "assets_slug_index" ON "public"."assets" USING "btree" ("slug");



CREATE INDEX "authors_slug_index" ON "public"."authors" USING "btree" ("slug");



CREATE INDEX "brand_hardware_features_slug_index" ON "public"."brand_hardware_features" USING "btree" ("slug");



CREATE INDEX "brand_software_features_slug_index" ON "public"."brand_software_features" USING "btree" ("slug");



CREATE INDEX "brands_slug_index" ON "public"."brands" USING "btree" ("slug");



CREATE INDEX "colors_slug_index" ON "public"."colors" USING "btree" ("slug");



CREATE INDEX "coupons_slug_index" ON "public"."coupons" USING "btree" ("slug");



CREATE UNIQUE INDEX "draft_stories_full_slug_lang_idx" ON "public"."draft_stories" USING "btree" ("full_slug", "lang");



CREATE INDEX "hardware_features_slug_index" ON "public"."hardware_features" USING "btree" ("slug");



CREATE INDEX "levels_slug_index" ON "public"."levels" USING "btree" ("slug");



CREATE INDEX "listening_mode_tags_tag_index" ON "public"."listening_mode_tags" USING "btree" ("tag");



CREATE INDEX "models_slug_index" ON "public"."models" USING "btree" ("slug");



CREATE INDEX "products_slug_index" ON "public"."products" USING "btree" ("slug");



CREATE UNIQUE INDEX "published_stories_full_slug_lang_idx" ON "public"."published_stories" USING "btree" ("full_slug", "lang");



CREATE INDEX "releases_slug_index" ON "public"."releases" USING "btree" ("slug");



CREATE INDEX "sellers_slug_index" ON "public"."sellers" USING "btree" ("slug");



CREATE INDEX "software_features_slug_index" ON "public"."software_features" USING "btree" ("slug");



CREATE INDEX "stories_slug_index" ON "public"."stories" USING "btree" ("slug");



CREATE INDEX "styles_slug_index" ON "public"."styles" USING "btree" ("slug");



ALTER TABLE ONLY "public"."acoustic_profile_assets"
    ADD CONSTRAINT "acoustic_profile_assets_acoustic_profile_id_foreign" FOREIGN KEY ("acoustic_profile_id") REFERENCES "public"."acoustic_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."acoustic_profile_assets"
    ADD CONSTRAINT "acoustic_profile_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_accessories"
    ADD CONSTRAINT "brand_accessories_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."brand_accessory_assets"
    ADD CONSTRAINT "brand_accessory_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_accessory_assets"
    ADD CONSTRAINT "brand_accessory_assets_brand_accessory_id_foreign" FOREIGN KEY ("brand_accessory_id") REFERENCES "public"."brand_accessories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_assets"
    ADD CONSTRAINT "brand_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_assets"
    ADD CONSTRAINT "brand_assets_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_hardware_features"
    ADD CONSTRAINT "brand_hardware_features_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."brand_hardware_features"
    ADD CONSTRAINT "brand_hardware_features_hardware_feature_id_foreign" FOREIGN KEY ("hardware_feature_id") REFERENCES "public"."hardware_features"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."brand_listening_modes"
    ADD CONSTRAINT "brand_listening_modes_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."brand_software_features"
    ADD CONSTRAINT "brand_software_features_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."brand_software_features"
    ADD CONSTRAINT "brand_software_features_software_feature_id_foreign" FOREIGN KEY ("software_feature_id") REFERENCES "public"."software_features"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."color_assets"
    ADD CONSTRAINT "color_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."color_assets"
    ADD CONSTRAINT "color_assets_color_id_foreign" FOREIGN KEY ("color_id") REFERENCES "public"."colors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."colors"
    ADD CONSTRAINT "colors_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hear_advisor_metrics"
    ADD CONSTRAINT "hear_advisor_metrics_product_id_foreign" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."level_features"
    ADD CONSTRAINT "level_features_brand_software_feature_id_foreign" FOREIGN KEY ("brand_software_feature_id") REFERENCES "public"."brand_software_features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."level_features"
    ADD CONSTRAINT "level_features_level_id_foreign" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."level_listening_modes"
    ADD CONSTRAINT "level_listening_modes_brand_listening_mode_id_foreign" FOREIGN KEY ("brand_listening_mode_id") REFERENCES "public"."brand_listening_modes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."level_listening_modes"
    ADD CONSTRAINT "level_listening_modes_level_id_foreign" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_release_id_foreign" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_accessories"
    ADD CONSTRAINT "model_accessories_brand_accessory_id_foreign" FOREIGN KEY ("brand_accessory_id") REFERENCES "public"."brand_accessories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_accessories"
    ADD CONSTRAINT "model_accessories_model_id_foreign" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_assets"
    ADD CONSTRAINT "model_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_assets"
    ADD CONSTRAINT "model_assets_model_id_foreign" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_features"
    ADD CONSTRAINT "model_features_brand_hardware_feature_id_foreign" FOREIGN KEY ("brand_hardware_feature_id") REFERENCES "public"."brand_hardware_features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."model_features"
    ADD CONSTRAINT "model_features_model_id_foreign" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."models"
    ADD CONSTRAINT "models_release_id_foreign" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."models"
    ADD CONSTRAINT "models_style_id_foreign" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_coupons"
    ADD CONSTRAINT "offer_coupons_coupon_id_foreign" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_coupons"
    ADD CONSTRAINT "offer_coupons_offer_id_foreign" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_level_id_foreign" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_product_id_foreign" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_release_id_foreign" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_seller_id_foreign" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."price_alerts"
    ADD CONSTRAINT "price_alerts_level_id_foreign" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_product_id_foreign" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_level_id_foreign" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_model_id_foreign" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_assets"
    ADD CONSTRAINT "release_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_assets"
    ADD CONSTRAINT "release_assets_release_id_foreign" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_features"
    ADD CONSTRAINT "release_features_brand_software_feature_id_foreign" FOREIGN KEY ("brand_software_feature_id") REFERENCES "public"."brand_software_features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."release_features"
    ADD CONSTRAINT "release_features_release_id_foreign" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."releases"
    ADD CONSTRAINT "releases_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_level_id_foreign" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_model_id_foreign" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_product_id_foreign" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_release_id_foreign" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_assets"
    ADD CONSTRAINT "seller_assets_asset_id_foreign" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_assets"
    ADD CONSTRAINT "seller_assets_seller_id_foreign" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."accessory_tags" TO "anon";
GRANT ALL ON TABLE "public"."accessory_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."accessory_tags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."accessory_tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."accessory_tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."accessory_tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."acoustic_profile_assets" TO "anon";
GRANT ALL ON TABLE "public"."acoustic_profile_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."acoustic_profile_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."acoustic_profile_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."acoustic_profile_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."acoustic_profile_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."acoustic_profiles" TO "anon";
GRANT ALL ON TABLE "public"."acoustic_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."acoustic_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."acoustic_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."acoustic_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."acoustic_profiles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."adonis_schema" TO "anon";
GRANT ALL ON TABLE "public"."adonis_schema" TO "authenticated";
GRANT ALL ON TABLE "public"."adonis_schema" TO "service_role";



GRANT ALL ON SEQUENCE "public"."adonis_schema_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."adonis_schema_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."adonis_schema_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."adonis_schema_versions" TO "anon";
GRANT ALL ON TABLE "public"."adonis_schema_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."adonis_schema_versions" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."authors" TO "anon";
GRANT ALL ON TABLE "public"."authors" TO "authenticated";
GRANT ALL ON TABLE "public"."authors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."authors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."authors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."authors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_accessories" TO "anon";
GRANT ALL ON TABLE "public"."brand_accessories" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_accessories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brand_accessories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brand_accessories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brand_accessories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_accessory_assets" TO "anon";
GRANT ALL ON TABLE "public"."brand_accessory_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_accessory_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brand_accessory_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brand_accessory_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brand_accessory_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_assets" TO "anon";
GRANT ALL ON TABLE "public"."brand_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brand_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brand_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brand_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_hardware_features" TO "anon";
GRANT ALL ON TABLE "public"."brand_hardware_features" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_hardware_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brand_hardware_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brand_hardware_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brand_hardware_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_listening_modes" TO "anon";
GRANT ALL ON TABLE "public"."brand_listening_modes" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_listening_modes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brand_listening_modes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brand_listening_modes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brand_listening_modes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_software_features" TO "anon";
GRANT ALL ON TABLE "public"."brand_software_features" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_software_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brand_software_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brand_software_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brand_software_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brands_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brands_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brands_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."color_assets" TO "anon";
GRANT ALL ON TABLE "public"."color_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."color_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."color_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."color_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."color_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."colors" TO "anon";
GRANT ALL ON TABLE "public"."colors" TO "authenticated";
GRANT ALL ON TABLE "public"."colors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."colors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."colors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."colors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coupons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coupons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coupons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."draft_stories" TO "anon";
GRANT ALL ON TABLE "public"."draft_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."draft_stories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."draft_stories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."draft_stories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."draft_stories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."evaluations" TO "anon";
GRANT ALL ON TABLE "public"."evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hardware_features" TO "anon";
GRANT ALL ON TABLE "public"."hardware_features" TO "authenticated";
GRANT ALL ON TABLE "public"."hardware_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hardware_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hardware_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hardware_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hear_advisor_metrics" TO "anon";
GRANT ALL ON TABLE "public"."hear_advisor_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."hear_advisor_metrics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hear_advisor_metrics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hear_advisor_metrics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hear_advisor_metrics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ht_ratings" TO "anon";
GRANT ALL ON TABLE "public"."ht_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ht_ratings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ht_ratings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ht_ratings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ht_ratings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."level_features" TO "anon";
GRANT ALL ON TABLE "public"."level_features" TO "authenticated";
GRANT ALL ON TABLE "public"."level_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."level_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."level_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."level_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."level_listening_modes" TO "anon";
GRANT ALL ON TABLE "public"."level_listening_modes" TO "authenticated";
GRANT ALL ON TABLE "public"."level_listening_modes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."level_listening_modes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."level_listening_modes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."level_listening_modes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."levels" TO "anon";
GRANT ALL ON TABLE "public"."levels" TO "authenticated";
GRANT ALL ON TABLE "public"."levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."levels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."listening_mode_tags" TO "anon";
GRANT ALL ON TABLE "public"."listening_mode_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."listening_mode_tags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."listening_mode_tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."listening_mode_tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."listening_mode_tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."model_accessories" TO "anon";
GRANT ALL ON TABLE "public"."model_accessories" TO "authenticated";
GRANT ALL ON TABLE "public"."model_accessories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."model_accessories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."model_accessories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."model_accessories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."model_assets" TO "anon";
GRANT ALL ON TABLE "public"."model_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."model_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."model_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."model_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."model_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."model_features" TO "anon";
GRANT ALL ON TABLE "public"."model_features" TO "authenticated";
GRANT ALL ON TABLE "public"."model_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."model_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."model_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."model_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."model_tags" TO "anon";
GRANT ALL ON TABLE "public"."model_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."model_tags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."model_tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."model_tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."model_tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."models" TO "anon";
GRANT ALL ON TABLE "public"."models" TO "authenticated";
GRANT ALL ON TABLE "public"."models" TO "service_role";



GRANT ALL ON SEQUENCE "public"."models_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."models_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."models_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."offer_coupons" TO "anon";
GRANT ALL ON TABLE "public"."offer_coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_coupons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."offer_coupons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."offer_coupons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."offer_coupons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."offers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."offers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."offers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_alerts" TO "anon";
GRANT ALL ON TABLE "public"."price_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."price_alerts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_alerts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_alerts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_alerts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_assets" TO "anon";
GRANT ALL ON TABLE "public"."product_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."product_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."published_stories" TO "anon";
GRANT ALL ON TABLE "public"."published_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."published_stories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."published_stories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."published_stories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."published_stories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."redirects" TO "anon";
GRANT ALL ON TABLE "public"."redirects" TO "authenticated";
GRANT ALL ON TABLE "public"."redirects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."redirects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."redirects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."redirects_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."release_assets" TO "anon";
GRANT ALL ON TABLE "public"."release_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."release_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."release_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."release_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."release_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."release_features" TO "anon";
GRANT ALL ON TABLE "public"."release_features" TO "authenticated";
GRANT ALL ON TABLE "public"."release_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."release_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."release_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."release_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."release_tags" TO "anon";
GRANT ALL ON TABLE "public"."release_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."release_tags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."release_tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."release_tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."release_tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."releases" TO "anon";
GRANT ALL ON TABLE "public"."releases" TO "authenticated";
GRANT ALL ON TABLE "public"."releases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."releases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."releases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."releases_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."seller_assets" TO "anon";
GRANT ALL ON TABLE "public"."seller_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seller_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."seller_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seller_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sellers" TO "anon";
GRANT ALL ON TABLE "public"."sellers" TO "authenticated";
GRANT ALL ON TABLE "public"."sellers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sellers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sellers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sellers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."software_features" TO "anon";
GRANT ALL ON TABLE "public"."software_features" TO "authenticated";
GRANT ALL ON TABLE "public"."software_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."software_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."software_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."software_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."styles" TO "anon";
GRANT ALL ON TABLE "public"."styles" TO "authenticated";
GRANT ALL ON TABLE "public"."styles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."styles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."styles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."styles_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























