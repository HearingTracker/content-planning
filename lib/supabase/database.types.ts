export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accessory_tags: {
        Row: {
          created_at: string
          description: string
          id: number
          tag: string
          updated_at: string
        }
        Insert: {
          created_at: string
          description: string
          id?: number
          tag: string
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      acoustic_profile_assets: {
        Row: {
          acoustic_profile_id: number
          asset_id: number
          created_at: string
          id: number
          updated_at: string
          usage: string
        }
        Insert: {
          acoustic_profile_id: number
          asset_id: number
          created_at: string
          id?: number
          updated_at: string
          usage: string
        }
        Update: {
          acoustic_profile_id?: number
          asset_id?: number
          created_at?: string
          id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoustic_profile_assets_acoustic_profile_id_foreign"
            columns: ["acoustic_profile_id"]
            isOneToOne: false
            referencedRelation: "acoustic_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoustic_profile_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      acoustic_profiles: {
        Row: {
          coupler_type: string | null
          created_at: string
          current_drain: number | null
          device_reviews_count: number | null
          equivalent_input_noise: number | null
          frequency_range_high: number | null
          frequency_range_low: number | null
          id: number
          maximum_1000_hz: number | null
          maximum_1500_hz: number | null
          maximum_2000_hz: number | null
          maximum_250_hz: number | null
          maximum_3000_hz: number | null
          maximum_4000_hz: number | null
          maximum_500_hz: number | null
          maximum_6000_hz: number | null
          maximum_750_hz: number | null
          maximum_8000_hz: number | null
          maximum_gain: number | null
          maximum_gain_high_frequency_average: number | null
          maximum_output: number | null
          maximum_output_high_frequency_average: number | null
          minimum_1000_hz: number | null
          minimum_1500_hz: number | null
          minimum_2000_hz: number | null
          minimum_250_hz: number | null
          minimum_3000_hz: number | null
          minimum_4000_hz: number | null
          minimum_500_hz: number | null
          minimum_6000_hz: number | null
          minimum_750_hz: number | null
          minimum_8000_hz: number | null
          name: string
          reference_test_gain: number | null
          score: number | null
          slug: string
          telecoil_full_on_sensitivity: number | null
          telecoil_sensitivity_max: number | null
          telecoil_splits: number | null
          telecoil_spliv: number | null
          total_harmonic_distortion_1600Hz: number | null
          total_harmonic_distortion_500Hz: number | null
          total_harmonic_distortion_800Hz: number | null
          updated_at: string
        }
        Insert: {
          coupler_type?: string | null
          created_at: string
          current_drain?: number | null
          device_reviews_count?: number | null
          equivalent_input_noise?: number | null
          frequency_range_high?: number | null
          frequency_range_low?: number | null
          id?: number
          maximum_1000_hz?: number | null
          maximum_1500_hz?: number | null
          maximum_2000_hz?: number | null
          maximum_250_hz?: number | null
          maximum_3000_hz?: number | null
          maximum_4000_hz?: number | null
          maximum_500_hz?: number | null
          maximum_6000_hz?: number | null
          maximum_750_hz?: number | null
          maximum_8000_hz?: number | null
          maximum_gain?: number | null
          maximum_gain_high_frequency_average?: number | null
          maximum_output?: number | null
          maximum_output_high_frequency_average?: number | null
          minimum_1000_hz?: number | null
          minimum_1500_hz?: number | null
          minimum_2000_hz?: number | null
          minimum_250_hz?: number | null
          minimum_3000_hz?: number | null
          minimum_4000_hz?: number | null
          minimum_500_hz?: number | null
          minimum_6000_hz?: number | null
          minimum_750_hz?: number | null
          minimum_8000_hz?: number | null
          name: string
          reference_test_gain?: number | null
          score?: number | null
          slug: string
          telecoil_full_on_sensitivity?: number | null
          telecoil_sensitivity_max?: number | null
          telecoil_splits?: number | null
          telecoil_spliv?: number | null
          total_harmonic_distortion_1600Hz?: number | null
          total_harmonic_distortion_500Hz?: number | null
          total_harmonic_distortion_800Hz?: number | null
          updated_at: string
        }
        Update: {
          coupler_type?: string | null
          created_at?: string
          current_drain?: number | null
          device_reviews_count?: number | null
          equivalent_input_noise?: number | null
          frequency_range_high?: number | null
          frequency_range_low?: number | null
          id?: number
          maximum_1000_hz?: number | null
          maximum_1500_hz?: number | null
          maximum_2000_hz?: number | null
          maximum_250_hz?: number | null
          maximum_3000_hz?: number | null
          maximum_4000_hz?: number | null
          maximum_500_hz?: number | null
          maximum_6000_hz?: number | null
          maximum_750_hz?: number | null
          maximum_8000_hz?: number | null
          maximum_gain?: number | null
          maximum_gain_high_frequency_average?: number | null
          maximum_output?: number | null
          maximum_output_high_frequency_average?: number | null
          minimum_1000_hz?: number | null
          minimum_1500_hz?: number | null
          minimum_2000_hz?: number | null
          minimum_250_hz?: number | null
          minimum_3000_hz?: number | null
          minimum_4000_hz?: number | null
          minimum_500_hz?: number | null
          minimum_6000_hz?: number | null
          minimum_750_hz?: number | null
          minimum_8000_hz?: number | null
          name?: string
          reference_test_gain?: number | null
          score?: number | null
          slug?: string
          telecoil_full_on_sensitivity?: number | null
          telecoil_sensitivity_max?: number | null
          telecoil_splits?: number | null
          telecoil_spliv?: number | null
          total_harmonic_distortion_1600Hz?: number | null
          total_harmonic_distortion_500Hz?: number | null
          total_harmonic_distortion_800Hz?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      adonis_schema: {
        Row: {
          batch: number
          id: number
          migration_time: string | null
          name: string
        }
        Insert: {
          batch: number
          id?: number
          migration_time?: string | null
          name: string
        }
        Update: {
          batch?: number
          id?: number
          migration_time?: string | null
          name?: string
        }
        Relationships: []
      }
      adonis_schema_versions: {
        Row: {
          version: number
        }
        Insert: {
          version: number
        }
        Update: {
          version?: number
        }
        Relationships: []
      }
      assets: {
        Row: {
          content_type: string
          created_at: string
          description: string | null
          id: number
          metadata: Json
          name: string
          record_id: number
          record_type: string
          slug: string
          updated_at: string
          url: string
          usage: string
        }
        Insert: {
          content_type: string
          created_at: string
          description?: string | null
          id?: number
          metadata: Json
          name: string
          record_id: number
          record_type: string
          slug: string
          updated_at: string
          url: string
          usage: string
        }
        Update: {
          content_type?: string
          created_at?: string
          description?: string | null
          id?: number
          metadata?: Json
          name?: string
          record_id?: number
          record_type?: string
          slug?: string
          updated_at?: string
          url?: string
          usage?: string
        }
        Relationships: []
      }
      authors: {
        Row: {
          about: string
          about_brief: string
          about_markdown: string
          avatar_url: string
          created_at: string
          facebook: string | null
          id: number
          instagram: string | null
          linkedin: string | null
          name: string
          slug: string
          twitter: string | null
          updated_at: string
          youtube: string | null
        }
        Insert: {
          about: string
          about_brief: string
          about_markdown: string
          avatar_url: string
          created_at: string
          facebook?: string | null
          id?: number
          instagram?: string | null
          linkedin?: string | null
          name: string
          slug: string
          twitter?: string | null
          updated_at: string
          youtube?: string | null
        }
        Update: {
          about?: string
          about_brief?: string
          about_markdown?: string
          avatar_url?: string
          created_at?: string
          facebook?: string | null
          id?: number
          instagram?: string | null
          linkedin?: string | null
          name?: string
          slug?: string
          twitter?: string | null
          updated_at?: string
          youtube?: string | null
        }
        Relationships: []
      }
      brand_accessories: {
        Row: {
          about: string
          brand_id: number
          created_at: string
          id: number
          name: string
          price: string | null
          product_id: string | null
          purchase_link: string | null
          sku: string | null
          slug: string
          tags: Json
          updated_at: string
        }
        Insert: {
          about: string
          brand_id: number
          created_at: string
          id?: number
          name: string
          price?: string | null
          product_id?: string | null
          purchase_link?: string | null
          sku?: string | null
          slug: string
          tags?: Json
          updated_at: string
        }
        Update: {
          about?: string
          brand_id?: number
          created_at?: string
          id?: number
          name?: string
          price?: string | null
          product_id?: string | null
          purchase_link?: string | null
          sku?: string | null
          slug?: string
          tags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_accessories_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_accessory_assets: {
        Row: {
          asset_id: number
          brand_accessory_id: number
          created_at: string
          id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          brand_accessory_id: number
          created_at: string
          id?: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          brand_accessory_id?: number
          created_at?: string
          id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_accessory_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_accessory_assets_brand_accessory_id_foreign"
            columns: ["brand_accessory_id"]
            isOneToOne: false
            referencedRelation: "brand_accessories"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          asset_id: number
          brand_id: number
          created_at: string
          id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          brand_id: number
          created_at: string
          id?: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          brand_id?: number
          created_at?: string
          id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_hardware_features: {
        Row: {
          brand_id: number
          created_at: string
          data_type: string
          description: string
          disclaimer: boolean | null
          display_order: number | null
          hardware_feature_id: number
          id: number
          options: Json
          options_name: string | null
          proprietary_name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_id: number
          created_at: string
          data_type?: string
          description: string
          disclaimer?: boolean | null
          display_order?: number | null
          hardware_feature_id: number
          id?: number
          options?: Json
          options_name?: string | null
          proprietary_name: string
          slug: string
          updated_at: string
        }
        Update: {
          brand_id?: number
          created_at?: string
          data_type?: string
          description?: string
          disclaimer?: boolean | null
          display_order?: number | null
          hardware_feature_id?: number
          id?: number
          options?: Json
          options_name?: string | null
          proprietary_name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_hardware_features_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_hardware_features_hardware_feature_id_foreign"
            columns: ["hardware_feature_id"]
            isOneToOne: false
            referencedRelation: "hardware_features"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_listening_modes: {
        Row: {
          automatic_group_name: string | null
          brand_id: number
          created_at: string
          id: number
          name: string
          slug: string
          streaming: boolean | null
          tags: Json
          updated_at: string
        }
        Insert: {
          automatic_group_name?: string | null
          brand_id: number
          created_at: string
          id?: number
          name: string
          slug: string
          streaming?: boolean | null
          tags?: Json
          updated_at: string
        }
        Update: {
          automatic_group_name?: string | null
          brand_id?: number
          created_at?: string
          id?: number
          name?: string
          slug?: string
          streaming?: boolean | null
          tags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_listening_modes_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_software_features: {
        Row: {
          brand_id: number
          created_at: string
          data_type: string
          description: string
          disclaimer: boolean | null
          display_order: number | null
          id: number
          options: Json
          options_name: string | null
          proprietary_name: string
          slug: string
          software_feature_id: number
          updated_at: string
        }
        Insert: {
          brand_id: number
          created_at: string
          data_type?: string
          description: string
          disclaimer?: boolean | null
          display_order?: number | null
          id?: number
          options?: Json
          options_name?: string | null
          proprietary_name: string
          slug: string
          software_feature_id: number
          updated_at: string
        }
        Update: {
          brand_id?: number
          created_at?: string
          data_type?: string
          description?: string
          disclaimer?: boolean | null
          display_order?: number | null
          id?: number
          options?: Json
          options_name?: string | null
          proprietary_name?: string
          slug?: string
          software_feature_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_software_features_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_software_features_software_feature_id_foreign"
            columns: ["software_feature_id"]
            isOneToOne: false
            referencedRelation: "software_features"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          display_order: number | null
          hidden: boolean | null
          id: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at: string
          display_order?: number | null
          hidden?: boolean | null
          id?: number
          name: string
          slug: string
          updated_at: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          hidden?: boolean | null
          id?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      color_assets: {
        Row: {
          asset_id: number
          color_id: number
          created_at: string
          id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          color_id: number
          created_at: string
          id?: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          color_id?: number
          created_at?: string
          id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "color_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_assets_color_id_foreign"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
        ]
      }
      colors: {
        Row: {
          brand_id: number | null
          created_at: string
          hex: string | null
          id: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_id?: number | null
          created_at: string
          hex?: string | null
          id?: number
          name: string
          slug: string
          updated_at: string
        }
        Update: {
          brand_id?: number | null
          created_at?: string
          hex?: string | null
          id?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colors_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          amount_off: number | null
          code: string
          created_at: string
          expires_at: string | null
          id: number
          message: string
          percent_off: number | null
          slug: string
          style: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          amount_off?: number | null
          code: string
          created_at: string
          expires_at?: string | null
          id?: number
          message: string
          percent_off?: number | null
          slug: string
          style?: string
          updated_at: string
          url: string
        }
        Update: {
          active?: boolean
          amount_off?: number | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: number
          message?: string
          percent_off?: number | null
          slug?: string
          style?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      cp_author_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: number
          completed_at: string | null
          content_id: number | null
          created_at: string | null
          due_date: string | null
          id: number
          notes: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          author_id: number
          completed_at?: string | null
          content_id?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: never
          notes?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          author_id?: number
          completed_at?: string | null
          content_id?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: never
          notes?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_author_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_author_assignments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_author_assignments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "cp_author_workload"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "cp_author_assignments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_best_list_products: {
        Row: {
          content_id: number | null
          created_at: string
          custom_product_brand: string | null
          custom_product_name: string | null
          id: number
          label: string | null
          notes: string | null
          position: number
          product_id: number | null
          updated_at: string
        }
        Insert: {
          content_id?: number | null
          created_at?: string
          custom_product_brand?: string | null
          custom_product_name?: string | null
          id?: number
          label?: string | null
          notes?: string | null
          position?: number
          product_id?: number | null
          updated_at?: string
        }
        Update: {
          content_id?: number | null
          created_at?: string
          custom_product_brand?: string | null
          custom_product_name?: string | null
          id?: number
          label?: string | null
          notes?: string | null
          position?: number
          product_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cp_best_list_products_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_best_list_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: Json | null
          campaign_id: number | null
          color: string | null
          content_id: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          event_type: string
          id: number
          is_recurring: boolean | null
          location: string | null
          meeting_link: string | null
          metadata: Json | null
          notes: string | null
          recurrence_rule: Json | null
          start_date: string
          start_time: string | null
          timezone: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          attendees?: Json | null
          campaign_id?: number | null
          color?: string | null
          content_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type: string
          id?: never
          is_recurring?: boolean | null
          location?: string | null
          meeting_link?: string | null
          metadata?: Json | null
          notes?: string | null
          recurrence_rule?: Json | null
          start_date: string
          start_time?: string | null
          timezone?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          attendees?: Json | null
          campaign_id?: number | null
          color?: string | null
          content_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string
          id?: never
          is_recurring?: boolean | null
          location?: string | null
          meeting_link?: string | null
          metadata?: Json | null
          notes?: string | null
          recurrence_rule?: Json | null
          start_date?: string
          start_time?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_calendar_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cp_campaign_summary"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "cp_calendar_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_calendar_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_campaigns: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          goals: string | null
          id: number
          metadata: Json | null
          name: string
          release_id: number | null
          slug: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          goals?: string | null
          id?: never
          metadata?: Json | null
          name: string
          release_id?: number | null
          slug: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          goals?: string | null
          id?: never
          metadata?: Json | null
          name?: string
          release_id?: number | null
          slug?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_campaigns_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_comment_attachments: {
        Row: {
          comment_id: number
          created_at: string | null
          file_name: string
          file_size: number | null
          id: number
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          comment_id: number
          created_at?: string | null
          file_name: string
          file_size?: number | null
          id?: never
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          comment_id?: number
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: never
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "cp_comment_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "cp_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_comments: {
        Row: {
          author_email: string | null
          author_id: string
          body: string
          body_html: string | null
          commentable_id: number
          commentable_type: string
          created_at: string | null
          id: number
          is_resolved: boolean | null
          mentions: Json | null
          metadata: Json | null
          parent_id: number | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string | null
        }
        Insert: {
          author_email?: string | null
          author_id: string
          body: string
          body_html?: string | null
          commentable_id: number
          commentable_type: string
          created_at?: string | null
          id?: never
          is_resolved?: boolean | null
          mentions?: Json | null
          metadata?: Json | null
          parent_id?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string | null
        }
        Update: {
          author_email?: string | null
          author_id?: string
          body?: string
          body_html?: string | null
          commentable_id?: number
          commentable_type?: string
          created_at?: string | null
          id?: never
          is_resolved?: boolean | null
          mentions?: Json | null
          metadata?: Json | null
          parent_id?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cp_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: Json | null
          brief_status: string | null
          campaign_id: number | null
          competitor_examples: Json | null
          content_goals: string | null
          content_type_id: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          draft_story_id: number | null
          due_date: string | null
          estimated_effort: string | null
          external_references: Json | null
          id: number
          idea_status: string | null
          internal_links: Json | null
          metadata: Json | null
          notes: string | null
          outline: Json | null
          potential_keywords: Json | null
          primary_keyword: string | null
          priority: string | null
          publish_date: string | null
          rejection_reason: string | null
          release_id: number | null
          required_sections: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          search_intent: string | null
          secondary_keywords: Json | null
          seo_metadata: Json | null
          slug: string | null
          social_metadata: Json | null
          source: string | null
          stage: string
          story_id: number | null
          storyblok_url: string | null
          submitted_by: string | null
          target_audience: string | null
          target_word_count: number | null
          title: string
          tone_and_style: string | null
          updated_at: string | null
          vote_count: number | null
          votes: Json | null
          workflow_status_id: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: Json | null
          brief_status?: string | null
          campaign_id?: number | null
          competitor_examples?: Json | null
          content_goals?: string | null
          content_type_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          draft_story_id?: number | null
          due_date?: string | null
          estimated_effort?: string | null
          external_references?: Json | null
          id?: number
          idea_status?: string | null
          internal_links?: Json | null
          metadata?: Json | null
          notes?: string | null
          outline?: Json | null
          potential_keywords?: Json | null
          primary_keyword?: string | null
          priority?: string | null
          publish_date?: string | null
          rejection_reason?: string | null
          release_id?: number | null
          required_sections?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          search_intent?: string | null
          secondary_keywords?: Json | null
          seo_metadata?: Json | null
          slug?: string | null
          social_metadata?: Json | null
          source?: string | null
          stage?: string
          story_id?: number | null
          storyblok_url?: string | null
          submitted_by?: string | null
          target_audience?: string | null
          target_word_count?: number | null
          title: string
          tone_and_style?: string | null
          updated_at?: string | null
          vote_count?: number | null
          votes?: Json | null
          workflow_status_id?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: Json | null
          brief_status?: string | null
          campaign_id?: number | null
          competitor_examples?: Json | null
          content_goals?: string | null
          content_type_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          draft_story_id?: number | null
          due_date?: string | null
          estimated_effort?: string | null
          external_references?: Json | null
          id?: number
          idea_status?: string | null
          internal_links?: Json | null
          metadata?: Json | null
          notes?: string | null
          outline?: Json | null
          potential_keywords?: Json | null
          primary_keyword?: string | null
          priority?: string | null
          publish_date?: string | null
          rejection_reason?: string | null
          release_id?: number | null
          required_sections?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          search_intent?: string | null
          secondary_keywords?: Json | null
          seo_metadata?: Json | null
          slug?: string | null
          social_metadata?: Json | null
          source?: string | null
          stage?: string
          story_id?: number | null
          storyblok_url?: string | null
          submitted_by?: string | null
          target_audience?: string | null
          target_word_count?: number | null
          title?: string
          tone_and_style?: string | null
          updated_at?: string | null
          vote_count?: number | null
          votes?: Json | null
          workflow_status_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cp_campaign_summary"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "cp_content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "cp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "cp_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_workflow_status_id_fkey"
            columns: ["workflow_status_id"]
            isOneToOne: false
            referencedRelation: "cp_content_pipeline"
            referencedColumns: ["status_id"]
          },
          {
            foreignKeyName: "cp_content_workflow_status_id_fkey"
            columns: ["workflow_status_id"]
            isOneToOne: false
            referencedRelation: "cp_workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content_analytics: {
        Row: {
          avg_time_on_page: number | null
          backlinks_count: number | null
          bounce_rate: number | null
          comments_count: number | null
          content_id: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          date: string
          device_breakdown: Json | null
          geo_breakdown: Json | null
          id: number
          keyword_rankings: Json | null
          metadata: Json | null
          organic_traffic: number | null
          page_views: number | null
          revenue: number | null
          scroll_depth: number | null
          social_shares: number | null
          traffic_sources: Json | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          avg_time_on_page?: number | null
          backlinks_count?: number | null
          bounce_rate?: number | null
          comments_count?: number | null
          content_id?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          date: string
          device_breakdown?: Json | null
          geo_breakdown?: Json | null
          id?: never
          keyword_rankings?: Json | null
          metadata?: Json | null
          organic_traffic?: number | null
          page_views?: number | null
          revenue?: number | null
          scroll_depth?: number | null
          social_shares?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_time_on_page?: number | null
          backlinks_count?: number | null
          bounce_rate?: number | null
          comments_count?: number | null
          content_id?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          device_breakdown?: Json | null
          geo_breakdown?: Json | null
          id?: never
          keyword_rankings?: Json | null
          metadata?: Json | null
          organic_traffic?: number | null
          page_views?: number | null
          revenue?: number | null
          scroll_depth?: number | null
          social_shares?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_analytics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          content_id: number | null
          created_at: string | null
          id: number
          notes: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          content_id?: number | null
          created_at?: string | null
          id?: never
          notes?: string | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          content_id?: number | null
          created_at?: string | null
          id?: never
          notes?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_assignments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content_attachments: {
        Row: {
          content_id: number | null
          created_at: string | null
          file_name: string
          file_size: number | null
          id: number
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          content_id?: number | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          id?: never
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          content_id?: number | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: never
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_attachments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content_links: {
        Row: {
          content_id: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: number
          link_type: string | null
          name: string | null
          url: string
        }
        Insert: {
          content_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: never
          link_type?: string | null
          name?: string | null
          url: string
        }
        Update: {
          content_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: never
          link_type?: string | null
          name?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_links_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content_tags: {
        Row: {
          content_id: number
          created_at: string | null
          id: number
          tag_id: number
        }
        Insert: {
          content_id: number
          created_at?: string | null
          id?: never
          tag_id: number
        }
        Update: {
          content_id?: number
          created_at?: string | null
          id?: never
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_content_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "cp_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_content_types: {
        Row: {
          created_at: string | null
          default_workflow_status_id: number | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: number
          is_active: boolean | null
          metadata_schema: Json | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_workflow_status_id?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: never
          is_active?: boolean | null
          metadata_schema?: Json | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_workflow_status_id?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: never
          is_active?: boolean | null
          metadata_schema?: Json | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_content_types_default_workflow_status_id_fkey"
            columns: ["default_workflow_status_id"]
            isOneToOne: false
            referencedRelation: "cp_content_pipeline"
            referencedColumns: ["status_id"]
          },
          {
            foreignKeyName: "cp_content_types_default_workflow_status_id_fkey"
            columns: ["default_workflow_status_id"]
            isOneToOne: false
            referencedRelation: "cp_workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: number
          is_active: boolean | null
          name: string
          parent_id: number | null
          slug: string
          tag_group: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: never
          is_active?: boolean | null
          name: string
          parent_id?: number | null
          slug: string
          tag_group?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: never
          is_active?: boolean | null
          name?: string
          parent_id?: number | null
          slug?: string
          tag_group?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_tags_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cp_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_workflow_statuses: {
        Row: {
          allowed_transitions: Json | null
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: number
          is_initial: boolean | null
          is_terminal: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          allowed_transitions?: Json | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: never
          is_initial?: boolean | null
          is_terminal?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          allowed_transitions?: Json | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: never
          is_initial?: boolean | null
          is_terminal?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cp_workflow_transitions: {
        Row: {
          content_id: number | null
          created_at: string | null
          from_status_id: number | null
          id: number
          metadata: Json | null
          reason: string | null
          to_status_id: number
          transitioned_by: string | null
        }
        Insert: {
          content_id?: number | null
          created_at?: string | null
          from_status_id?: number | null
          id?: never
          metadata?: Json | null
          reason?: string | null
          to_status_id: number
          transitioned_by?: string | null
        }
        Update: {
          content_id?: number | null
          created_at?: string | null
          from_status_id?: number | null
          id?: never
          metadata?: Json | null
          reason?: string | null
          to_status_id?: number
          transitioned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_workflow_transitions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "cp_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_workflow_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "cp_content_pipeline"
            referencedColumns: ["status_id"]
          },
          {
            foreignKeyName: "cp_workflow_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "cp_workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_workflow_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "cp_content_pipeline"
            referencedColumns: ["status_id"]
          },
          {
            foreignKeyName: "cp_workflow_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "cp_workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_workflow_transitions_transitioned_by_fkey"
            columns: ["transitioned_by"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_stories: {
        Row: {
          alternates: Json | null
          content: Json | null
          created_at: string | null
          default_full_slug: string | null
          first_published_at: string | null
          full_slug: string | null
          group_id: string | null
          id: number
          is_startpage: boolean | null
          lang: string | null
          meta_data: Json | null
          name: string | null
          parent_id: number | null
          path: string | null
          position: number | null
          published_at: string | null
          release_id: number | null
          slug: string | null
          sort_by_date: string | null
          storyblok_id: number | null
          tag_list: Json | null
          translated_slugs: Json | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          alternates?: Json | null
          content?: Json | null
          created_at?: string | null
          default_full_slug?: string | null
          first_published_at?: string | null
          full_slug?: string | null
          group_id?: string | null
          id?: never
          is_startpage?: boolean | null
          lang?: string | null
          meta_data?: Json | null
          name?: string | null
          parent_id?: number | null
          path?: string | null
          position?: number | null
          published_at?: string | null
          release_id?: number | null
          slug?: string | null
          sort_by_date?: string | null
          storyblok_id?: number | null
          tag_list?: Json | null
          translated_slugs?: Json | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          alternates?: Json | null
          content?: Json | null
          created_at?: string | null
          default_full_slug?: string | null
          first_published_at?: string | null
          full_slug?: string | null
          group_id?: string | null
          id?: never
          is_startpage?: boolean | null
          lang?: string | null
          meta_data?: Json | null
          name?: string | null
          parent_id?: number | null
          path?: string | null
          position?: number | null
          published_at?: string | null
          release_id?: number | null
          slug?: string | null
          sort_by_date?: string | null
          storyblok_id?: number | null
          tag_list?: Json | null
          translated_slugs?: Json | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          average_metrics: Json | null
          created_at: string
          dropbox_id: string | null
          ear_coupling: string | null
          evaluation_id: string | null
          feedback_handling: number | null
          fit_score: number | null
          fit_score_adjusted: number | null
          fit_score_normalized: number | null
          fit_type: string | null
          fitting_formula: string | null
          id: number
          listening_program: string | null
          metrics_version: string | null
          music_streaming: number | null
          noisy_audio: string | null
          notes: string | null
          own_voice: number | null
          product_id: number | null
          quiet_audio: string | null
          radar_values: Json | null
          receiver: string | null
          reig55: Json | null
          reig65: Json | null
          reig75: Json | null
          results_description: string | null
          software_version: string | null
          speech_in_noise: number | null
          speech_in_quiet: number | null
          streaming_music_audio: string | null
          target_audiogram_id: number | null
          tested_on: string | null
          tuning_adjustments: string | null
          updated_at: string
          volume_setting: string | null
        }
        Insert: {
          average_metrics?: Json | null
          created_at?: string
          dropbox_id?: string | null
          ear_coupling?: string | null
          evaluation_id?: string | null
          feedback_handling?: number | null
          fit_score?: number | null
          fit_score_adjusted?: number | null
          fit_score_normalized?: number | null
          fit_type?: string | null
          fitting_formula?: string | null
          id?: number
          listening_program?: string | null
          metrics_version?: string | null
          music_streaming?: number | null
          noisy_audio?: string | null
          notes?: string | null
          own_voice?: number | null
          product_id?: number | null
          quiet_audio?: string | null
          radar_values?: Json | null
          receiver?: string | null
          reig55?: Json | null
          reig65?: Json | null
          reig75?: Json | null
          results_description?: string | null
          software_version?: string | null
          speech_in_noise?: number | null
          speech_in_quiet?: number | null
          streaming_music_audio?: string | null
          target_audiogram_id?: number | null
          tested_on?: string | null
          tuning_adjustments?: string | null
          updated_at?: string
          volume_setting?: string | null
        }
        Update: {
          average_metrics?: Json | null
          created_at?: string
          dropbox_id?: string | null
          ear_coupling?: string | null
          evaluation_id?: string | null
          feedback_handling?: number | null
          fit_score?: number | null
          fit_score_adjusted?: number | null
          fit_score_normalized?: number | null
          fit_type?: string | null
          fitting_formula?: string | null
          id?: number
          listening_program?: string | null
          metrics_version?: string | null
          music_streaming?: number | null
          noisy_audio?: string | null
          notes?: string | null
          own_voice?: number | null
          product_id?: number | null
          quiet_audio?: string | null
          radar_values?: Json | null
          receiver?: string | null
          reig55?: Json | null
          reig65?: Json | null
          reig75?: Json | null
          results_description?: string | null
          software_version?: string | null
          speech_in_noise?: number | null
          speech_in_quiet?: number | null
          streaming_music_audio?: string | null
          target_audiogram_id?: number | null
          tested_on?: string | null
          tuning_adjustments?: string | null
          updated_at?: string
          volume_setting?: string | null
        }
        Relationships: []
      }
      hardware_features: {
        Row: {
          created_at: string
          data_type: string
          description: string
          disclaimer: boolean | null
          display_order: number | null
          id: number
          name: string
          options: Json
          options_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at: string
          data_type?: string
          description: string
          disclaimer?: boolean | null
          display_order?: number | null
          id?: number
          name: string
          options?: Json
          options_name?: string | null
          slug: string
          updated_at: string
        }
        Update: {
          created_at?: string
          data_type?: string
          description?: string
          disclaimer?: boolean | null
          display_order?: number | null
          id?: number
          name?: string
          options?: Json
          options_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      hear_advisor_metrics: {
        Row: {
          boomy: number | null
          created_at: string
          feedback: number | null
          id: number
          loud: number | null
          product_id: number
          quiet: number | null
          streaming: number | null
          tuned: boolean
          updated_at: string
        }
        Insert: {
          boomy?: number | null
          created_at: string
          feedback?: number | null
          id?: number
          loud?: number | null
          product_id: number
          quiet?: number | null
          streaming?: number | null
          tuned: boolean
          updated_at: string
        }
        Update: {
          boomy?: number | null
          created_at?: string
          feedback?: number | null
          id?: number
          loud?: number | null
          product_id?: number
          quiet?: number | null
          streaming?: number | null
          tuned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hear_advisor_metrics_product_id_foreign"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ht_ratings: {
        Row: {
          airtable_id: number | null
          app_features: number | null
          app_features_comment: string | null
          battery: number | null
          battery_comment: string | null
          bluetooth: number | null
          bluetooth_comment: string | null
          build_quality: number | null
          build_quality_comment: string | null
          comfort: number | null
          comfort_comment: string | null
          created_at: string
          design: number | null
          design_comment: string | null
          handling: number | null
          handling_comment: string | null
          ht_score: number | null
          id: number
          normalized_price: number | null
          note: string | null
          pro_support: number | null
          pro_support_comment: string | null
          product_id: number | null
          sound_score: number | null
          sound_score_comment: string | null
          speech_in_noise_description: string | null
          speech_in_quiet_description: string | null
          streaming_music_description: string | null
          updated_at: string
          value: number | null
          value_comment: string | null
          weighted_score: number | null
        }
        Insert: {
          airtable_id?: number | null
          app_features?: number | null
          app_features_comment?: string | null
          battery?: number | null
          battery_comment?: string | null
          bluetooth?: number | null
          bluetooth_comment?: string | null
          build_quality?: number | null
          build_quality_comment?: string | null
          comfort?: number | null
          comfort_comment?: string | null
          created_at?: string
          design?: number | null
          design_comment?: string | null
          handling?: number | null
          handling_comment?: string | null
          ht_score?: number | null
          id?: number
          normalized_price?: number | null
          note?: string | null
          pro_support?: number | null
          pro_support_comment?: string | null
          product_id?: number | null
          sound_score?: number | null
          sound_score_comment?: string | null
          speech_in_noise_description?: string | null
          speech_in_quiet_description?: string | null
          streaming_music_description?: string | null
          updated_at?: string
          value?: number | null
          value_comment?: string | null
          weighted_score?: number | null
        }
        Update: {
          airtable_id?: number | null
          app_features?: number | null
          app_features_comment?: string | null
          battery?: number | null
          battery_comment?: string | null
          bluetooth?: number | null
          bluetooth_comment?: string | null
          build_quality?: number | null
          build_quality_comment?: string | null
          comfort?: number | null
          comfort_comment?: string | null
          created_at?: string
          design?: number | null
          design_comment?: string | null
          handling?: number | null
          handling_comment?: string | null
          ht_score?: number | null
          id?: number
          normalized_price?: number | null
          note?: string | null
          pro_support?: number | null
          pro_support_comment?: string | null
          product_id?: number | null
          sound_score?: number | null
          sound_score_comment?: string | null
          speech_in_noise_description?: string | null
          speech_in_quiet_description?: string | null
          streaming_music_description?: string | null
          updated_at?: string
          value?: number | null
          value_comment?: string | null
          weighted_score?: number | null
        }
        Relationships: []
      }
      level_features: {
        Row: {
          brand_software_feature_id: number
          created_at: string
          excluded_model_ids: Json
          id: number
          level_id: number
          updated_at: string
          value: Json | null
        }
        Insert: {
          brand_software_feature_id: number
          created_at: string
          excluded_model_ids?: Json
          id?: number
          level_id: number
          updated_at: string
          value?: Json | null
        }
        Update: {
          brand_software_feature_id?: number
          created_at?: string
          excluded_model_ids?: Json
          id?: number
          level_id?: number
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "level_features_brand_software_feature_id_foreign"
            columns: ["brand_software_feature_id"]
            isOneToOne: false
            referencedRelation: "brand_software_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_features_level_id_foreign"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      level_listening_modes: {
        Row: {
          brand_listening_mode_id: number
          created_at: string
          id: number
          level_id: number
          updated_at: string
        }
        Insert: {
          brand_listening_mode_id: number
          created_at: string
          id?: number
          level_id: number
          updated_at: string
        }
        Update: {
          brand_listening_mode_id?: number
          created_at?: string
          id?: number
          level_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_listening_modes_brand_listening_mode_id_foreign"
            columns: ["brand_listening_mode_id"]
            isOneToOne: false
            referencedRelation: "brand_listening_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_listening_modes_level_id_foreign"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          financing: boolean
          from_styles: boolean | null
          full_name: string
          id: number
          level: number
          name: string
          release_id: number
          reviews_count: number
          score: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at: string
          financing?: boolean
          from_styles?: boolean | null
          full_name: string
          id?: number
          level: number
          name: string
          release_id: number
          reviews_count?: number
          score?: number | null
          slug: string
          updated_at: string
        }
        Update: {
          created_at?: string
          financing?: boolean
          from_styles?: boolean | null
          full_name?: string
          id?: number
          level?: number
          name?: string
          release_id?: number
          reviews_count?: number
          score?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_release_id_foreign"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_mode_tags: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          tag: string
          updated_at: string
        }
        Insert: {
          created_at: string
          description?: string | null
          id?: number
          name: string
          tag: string
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      model_accessories: {
        Row: {
          brand_accessory_id: number
          created_at: string
          id: number
          model_id: number
          updated_at: string
        }
        Insert: {
          brand_accessory_id: number
          created_at: string
          id?: number
          model_id: number
          updated_at: string
        }
        Update: {
          brand_accessory_id?: number
          created_at?: string
          id?: number
          model_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_accessories_brand_accessory_id_foreign"
            columns: ["brand_accessory_id"]
            isOneToOne: false
            referencedRelation: "brand_accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_accessories_model_id_foreign"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_assets: {
        Row: {
          asset_id: number
          created_at: string
          id: number
          model_id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          created_at: string
          id?: number
          model_id: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          created_at?: string
          id?: number
          model_id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_assets_model_id_foreign"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_features: {
        Row: {
          brand_hardware_feature_id: number
          created_at: string
          excluded_level_ids: Json
          id: number
          model_id: number
          updated_at: string
          value: Json | null
        }
        Insert: {
          brand_hardware_feature_id: number
          created_at: string
          excluded_level_ids?: Json
          id?: number
          model_id: number
          updated_at: string
          value?: Json | null
        }
        Update: {
          brand_hardware_feature_id?: number
          created_at?: string
          excluded_level_ids?: Json
          id?: number
          model_id?: number
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "model_features_brand_hardware_feature_id_foreign"
            columns: ["brand_hardware_feature_id"]
            isOneToOne: false
            referencedRelation: "brand_hardware_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_features_model_id_foreign"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_tags: {
        Row: {
          configuration: Json
          created_at: string
          description: string
          id: number
          tag: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at: string
          description: string
          id?: number
          tag: string
          updated_at: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          description?: string
          id?: number
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          colors: Json
          created_at: string
          description: string | null
          device_reviews_count: number | null
          discontinued: boolean | null
          disposable: boolean | null
          feature_text: string | null
          from_styles: boolean | null
          full_name: string
          hearing_loss_level: Json
          id: number
          name: string
          power_aid: boolean | null
          primary: boolean | null
          product_type: string
          release_date: string | null
          release_id: number
          score: number | null
          slug: string
          style_id: number
          tags: Json
          updated_at: string
        }
        Insert: {
          colors?: Json
          created_at: string
          description?: string | null
          device_reviews_count?: number | null
          discontinued?: boolean | null
          disposable?: boolean | null
          feature_text?: string | null
          from_styles?: boolean | null
          full_name: string
          hearing_loss_level?: Json
          id?: number
          name: string
          power_aid?: boolean | null
          primary?: boolean | null
          product_type: string
          release_date?: string | null
          release_id: number
          score?: number | null
          slug: string
          style_id: number
          tags?: Json
          updated_at: string
        }
        Update: {
          colors?: Json
          created_at?: string
          description?: string | null
          device_reviews_count?: number | null
          discontinued?: boolean | null
          disposable?: boolean | null
          feature_text?: string | null
          from_styles?: boolean | null
          full_name?: string
          hearing_loss_level?: Json
          id?: number
          name?: string
          power_aid?: boolean | null
          primary?: boolean | null
          product_type?: string
          release_date?: string | null
          release_id?: number
          score?: number | null
          slug?: string
          style_id?: number
          tags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "models_release_id_foreign"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_style_id_foreign"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          browser_enabled: boolean | null
          created_at: string | null
          email_enabled: boolean | null
          event_preferences: Json | null
          notifications_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          browser_enabled?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          event_preferences?: Json | null
          notifications_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          browser_enabled?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          event_preferences?: Json | null
          notifications_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          comment_id: number | null
          created_at: string | null
          entity_id: number | null
          entity_type: string | null
          id: number
          notification_type: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          comment_id?: number | null
          created_at?: string | null
          entity_id?: number | null
          entity_type?: string | null
          id?: never
          notification_type: string
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          comment_id?: number | null
          created_at?: string | null
          entity_id?: number | null
          entity_type?: string | null
          id?: never
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "cp_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_coupons: {
        Row: {
          coupon_id: number
          created_at: string
          id: number
          offer_id: number
          updated_at: string
        }
        Insert: {
          coupon_id: number
          created_at: string
          id?: number
          offer_id: number
          updated_at: string
        }
        Update: {
          coupon_id?: number
          created_at?: string
          id?: number
          offer_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_coupons_coupon_id_foreign"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_coupons_offer_id_foreign"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          active: boolean
          channels: Json
          click_text: string | null
          countries: Json
          created_at: string
          currency: string
          end_date: string | null
          id: number
          lease_price: number | null
          level_id: number | null
          price: number
          price_type: string
          product_id: number | null
          regions: Json
          release_id: number
          seller_id: number
          seller_reference: string | null
          seller_timestamp: string | null
          start_date: string | null
          tagline: string | null
          unit_price: number | null
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          channels?: Json
          click_text?: string | null
          countries?: Json
          created_at: string
          currency?: string
          end_date?: string | null
          id?: number
          lease_price?: number | null
          level_id?: number | null
          price: number
          price_type?: string
          product_id?: number | null
          regions?: Json
          release_id: number
          seller_id: number
          seller_reference?: string | null
          seller_timestamp?: string | null
          start_date?: string | null
          tagline?: string | null
          unit_price?: number | null
          updated_at: string
          url: string
        }
        Update: {
          active?: boolean
          channels?: Json
          click_text?: string | null
          countries?: Json
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: number
          lease_price?: number | null
          level_id?: number | null
          price?: number
          price_type?: string
          product_id?: number | null
          regions?: Json
          release_id?: number
          seller_id?: number
          seller_reference?: string | null
          seller_timestamp?: string | null
          start_date?: string | null
          tagline?: string | null
          unit_price?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_level_id_foreign"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_foreign"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_release_id_foreign"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_seller_id_foreign"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          active: boolean
          best_offer_price: number
          created_at: string
          email: string
          history: Json
          id: number
          level_id: number
          updated_at: string
          user_price: number
        }
        Insert: {
          active: boolean
          best_offer_price: number
          created_at: string
          email: string
          history?: Json
          id?: number
          level_id: number
          updated_at: string
          user_price: number
        }
        Update: {
          active?: boolean
          best_offer_price?: number
          created_at?: string
          email?: string
          history?: Json
          id?: number
          level_id?: number
          updated_at?: string
          user_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_level_id_foreign"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assets: {
        Row: {
          asset_id: number
          created_at: string
          id: number
          product_id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          created_at: string
          id?: number
          product_id: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          created_at?: string
          id?: number
          product_id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_assets_product_id_foreign"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_segments: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          sort_primary: string | null
          sort_primary_desc: boolean | null
          sort_secondary: string | null
          sort_secondary_desc: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          name: string
          sort_primary?: string | null
          sort_primary_desc?: boolean | null
          sort_secondary?: string | null
          sort_secondary_desc?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          sort_primary?: string | null
          sort_primary_desc?: boolean | null
          sort_secondary?: string | null
          sort_secondary_desc?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_segments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          expert_choice_winner: boolean | null
          featured: boolean | null
          featured_weighting: number | null
          from_styles: boolean | null
          full_name: string
          home_featured: boolean | null
          id: number
          level_id: number
          model_id: number
          monthly_view_count: number | null
          name: string
          name_override: boolean | null
          reviews_count: number | null
          score: number | null
          slug: string
          sound_score: number | null
          updated_at: string
          view_count: number | null
          weighted_average: number | null
        }
        Insert: {
          created_at: string
          expert_choice_winner?: boolean | null
          featured?: boolean | null
          featured_weighting?: number | null
          from_styles?: boolean | null
          full_name: string
          home_featured?: boolean | null
          id?: number
          level_id: number
          model_id: number
          monthly_view_count?: number | null
          name: string
          name_override?: boolean | null
          reviews_count?: number | null
          score?: number | null
          slug: string
          sound_score?: number | null
          updated_at: string
          view_count?: number | null
          weighted_average?: number | null
        }
        Update: {
          created_at?: string
          expert_choice_winner?: boolean | null
          featured?: boolean | null
          featured_weighting?: number | null
          from_styles?: boolean | null
          full_name?: string
          home_featured?: boolean | null
          id?: number
          level_id?: number
          model_id?: number
          monthly_view_count?: number | null
          name?: string
          name_override?: boolean | null
          reviews_count?: number | null
          score?: number | null
          slug?: string
          sound_score?: number | null
          updated_at?: string
          view_count?: number | null
          weighted_average?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_level_id_foreign"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_model_id_foreign"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      published_stories: {
        Row: {
          alternates: Json | null
          content: Json | null
          created_at: string | null
          default_full_slug: string | null
          first_published_at: string | null
          full_slug: string | null
          group_id: string | null
          id: number
          is_startpage: boolean | null
          lang: string | null
          meta_data: Json | null
          name: string | null
          parent_id: number | null
          path: string | null
          position: number | null
          published_at: string | null
          release_id: number | null
          slug: string | null
          sort_by_date: string | null
          storyblok_id: number | null
          tag_list: Json | null
          translated_slugs: Json | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          alternates?: Json | null
          content?: Json | null
          created_at?: string | null
          default_full_slug?: string | null
          first_published_at?: string | null
          full_slug?: string | null
          group_id?: string | null
          id?: never
          is_startpage?: boolean | null
          lang?: string | null
          meta_data?: Json | null
          name?: string | null
          parent_id?: number | null
          path?: string | null
          position?: number | null
          published_at?: string | null
          release_id?: number | null
          slug?: string | null
          sort_by_date?: string | null
          storyblok_id?: number | null
          tag_list?: Json | null
          translated_slugs?: Json | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          alternates?: Json | null
          content?: Json | null
          created_at?: string | null
          default_full_slug?: string | null
          first_published_at?: string | null
          full_slug?: string | null
          group_id?: string | null
          id?: never
          is_startpage?: boolean | null
          lang?: string | null
          meta_data?: Json | null
          name?: string | null
          parent_id?: number | null
          path?: string | null
          position?: number | null
          published_at?: string | null
          release_id?: number | null
          slug?: string | null
          sort_by_date?: string | null
          storyblok_id?: number | null
          tag_list?: Json | null
          translated_slugs?: Json | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: number
          p256dh_key: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: never
          p256dh_key: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: never
          p256dh_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      redirects: {
        Row: {
          created_at: string
          id: number
          new_path: string
          old_path: string
          updated_at: string
        }
        Insert: {
          created_at: string
          id?: number
          new_path: string
          old_path: string
          updated_at: string
        }
        Update: {
          created_at?: string
          id?: number
          new_path?: string
          old_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      release_assets: {
        Row: {
          asset_id: number
          created_at: string
          id: number
          release_id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          created_at: string
          id?: number
          release_id: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          created_at?: string
          id?: number
          release_id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_assets_release_id_foreign"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_features: {
        Row: {
          brand_software_feature_id: number
          created_at: string
          excluded_level_ids: Json
          excluded_model_ids: Json
          id: number
          release_id: number
          updated_at: string
          value: Json | null
        }
        Insert: {
          brand_software_feature_id: number
          created_at: string
          excluded_level_ids?: Json
          excluded_model_ids?: Json
          id?: number
          release_id: number
          updated_at: string
          value?: Json | null
        }
        Update: {
          brand_software_feature_id?: number
          created_at?: string
          excluded_level_ids?: Json
          excluded_model_ids?: Json
          id?: number
          release_id?: number
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "release_features_brand_software_feature_id_foreign"
            columns: ["brand_software_feature_id"]
            isOneToOne: false
            referencedRelation: "brand_software_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_features_release_id_foreign"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_tags: {
        Row: {
          configuration: Json
          created_at: string
          description: string
          id: number
          tag: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at: string
          description: string
          id?: number
          tag: string
          updated_at: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          description?: string
          id?: number
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          all_page_views: number
          alt_toc: boolean | null
          brand_id: number
          comparable: boolean | null
          compare_override: boolean | null
          created_at: string
          description: string
          discontinued: boolean | null
          family: string | null
          full_name: string
          ghost_score: number | null
          heading: string | null
          id: number
          meta_description: string | null
          name: string
          page_view_multiplier: number
          product_class: string
          product_type: string
          recent_page_views: number
          release_date: string | null
          reviews_count: number
          score: number | null
          short_name: string | null
          slug: string
          sort_order: number | null
          story_slug: string | null
          tags: Json
          title: string | null
          updated_at: string
        }
        Insert: {
          all_page_views?: number
          alt_toc?: boolean | null
          brand_id: number
          comparable?: boolean | null
          compare_override?: boolean | null
          created_at: string
          description: string
          discontinued?: boolean | null
          family?: string | null
          full_name: string
          ghost_score?: number | null
          heading?: string | null
          id?: number
          meta_description?: string | null
          name: string
          page_view_multiplier?: number
          product_class?: string
          product_type?: string
          recent_page_views?: number
          release_date?: string | null
          reviews_count?: number
          score?: number | null
          short_name?: string | null
          slug: string
          sort_order?: number | null
          story_slug?: string | null
          tags?: Json
          title?: string | null
          updated_at: string
        }
        Update: {
          all_page_views?: number
          alt_toc?: boolean | null
          brand_id?: number
          comparable?: boolean | null
          compare_override?: boolean | null
          created_at?: string
          description?: string
          discontinued?: boolean | null
          family?: string | null
          full_name?: string
          ghost_score?: number | null
          heading?: string | null
          id?: number
          meta_description?: string | null
          name?: string
          page_view_multiplier?: number
          product_class?: string
          product_type?: string
          recent_page_views?: number
          release_date?: string | null
          reviews_count?: number
          score?: number | null
          short_name?: string | null
          slug?: string
          sort_order?: number | null
          story_slug?: string | null
          tags?: Json
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_brand_id_foreign"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          accessories: string | null
          alt_style: string | null
          answer00: number | null
          answer01: number | null
          answer02: number | null
          answer03: number | null
          answer04: number | null
          answer05: number | null
          answer06: number | null
          answer07: number | null
          answer08: number | null
          answer09: number | null
          answer10: number | null
          battery_life: number | null
          comment_text: string | null
          comment_text_markdown: string | null
          comment_title: string | null
          completed: boolean | null
          created_at: string
          dismissed: boolean | null
          disp_flag_id: string | null
          dob: string | null
          duplicate: boolean | null
          email: string | null
          experience: number | null
          failed_fit: boolean | null
          featured: boolean | null
          fitted_by: number | null
          fitting_type: string | null
          hours: number | null
          id: number
          level_id: number | null
          model_id: number | null
          moderated: boolean | null
          notify: boolean | null
          options: Json | null
          product_id: number | null
          publishable: boolean | null
          release_id: number | null
          rems: string | null
          score: number
          secret_code: string | null
          sex: string | null
          thanked: boolean | null
          trial_length: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accessories?: string | null
          alt_style?: string | null
          answer00?: number | null
          answer01?: number | null
          answer02?: number | null
          answer03?: number | null
          answer04?: number | null
          answer05?: number | null
          answer06?: number | null
          answer07?: number | null
          answer08?: number | null
          answer09?: number | null
          answer10?: number | null
          battery_life?: number | null
          comment_text?: string | null
          comment_text_markdown?: string | null
          comment_title?: string | null
          completed?: boolean | null
          created_at: string
          dismissed?: boolean | null
          disp_flag_id?: string | null
          dob?: string | null
          duplicate?: boolean | null
          email?: string | null
          experience?: number | null
          failed_fit?: boolean | null
          featured?: boolean | null
          fitted_by?: number | null
          fitting_type?: string | null
          hours?: number | null
          id?: number
          level_id?: number | null
          model_id?: number | null
          moderated?: boolean | null
          notify?: boolean | null
          options?: Json | null
          product_id?: number | null
          publishable?: boolean | null
          release_id?: number | null
          rems?: string | null
          score?: number
          secret_code?: string | null
          sex?: string | null
          thanked?: boolean | null
          trial_length?: number | null
          updated_at: string
          user_id?: string | null
        }
        Update: {
          accessories?: string | null
          alt_style?: string | null
          answer00?: number | null
          answer01?: number | null
          answer02?: number | null
          answer03?: number | null
          answer04?: number | null
          answer05?: number | null
          answer06?: number | null
          answer07?: number | null
          answer08?: number | null
          answer09?: number | null
          answer10?: number | null
          battery_life?: number | null
          comment_text?: string | null
          comment_text_markdown?: string | null
          comment_title?: string | null
          completed?: boolean | null
          created_at?: string
          dismissed?: boolean | null
          disp_flag_id?: string | null
          dob?: string | null
          duplicate?: boolean | null
          email?: string | null
          experience?: number | null
          failed_fit?: boolean | null
          featured?: boolean | null
          fitted_by?: number | null
          fitting_type?: string | null
          hours?: number | null
          id?: number
          level_id?: number | null
          model_id?: number | null
          moderated?: boolean | null
          notify?: boolean | null
          options?: Json | null
          product_id?: number | null
          publishable?: boolean | null
          release_id?: number | null
          rems?: string | null
          score?: number
          secret_code?: string | null
          sex?: string | null
          thanked?: boolean | null
          trial_length?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_level_id_foreign"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_model_id_foreign"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_foreign"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_release_id_foreign"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_assets: {
        Row: {
          asset_id: number
          created_at: string
          id: number
          seller_id: number
          updated_at: string
          usage: string
        }
        Insert: {
          asset_id: number
          created_at: string
          id?: number
          seller_id: number
          updated_at: string
          usage: string
        }
        Update: {
          asset_id?: number
          created_at?: string
          id?: number
          seller_id?: number
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_assets_asset_id_foreign"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_assets_seller_id_foreign"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          active: boolean
          blurb: string
          boost: number | null
          channels: Json
          created_at: string
          features: Json
          id: number
          logo_url: string | null
          name: string
          partner_type: string
          position: number | null
          rating: number | null
          reviews: number | null
          slug: string
          tagline: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          blurb: string
          boost?: number | null
          channels?: Json
          created_at: string
          features?: Json
          id?: number
          logo_url?: string | null
          name: string
          partner_type?: string
          position?: number | null
          rating?: number | null
          reviews?: number | null
          slug: string
          tagline: string
          updated_at: string
          url: string
        }
        Update: {
          active?: boolean
          blurb?: string
          boost?: number | null
          channels?: Json
          created_at?: string
          features?: Json
          id?: number
          logo_url?: string | null
          name?: string
          partner_type?: string
          position?: number | null
          rating?: number | null
          reviews?: number | null
          slug?: string
          tagline?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      software_features: {
        Row: {
          created_at: string
          data_type: string
          description: string
          display_order: number | null
          hidden: boolean | null
          id: number
          name: string
          options: Json
          options_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at: string
          data_type?: string
          description: string
          display_order?: number | null
          hidden?: boolean | null
          id?: number
          name: string
          options?: Json
          options_name?: string | null
          slug: string
          updated_at: string
        }
        Update: {
          created_at?: string
          data_type?: string
          description?: string
          display_order?: number | null
          hidden?: boolean | null
          id?: number
          name?: string
          options?: Json
          options_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          all_page_views: number | null
          archived: boolean | null
          author_text: string
          created_at: string
          description: string | null
          featured: boolean | null
          id: number
          language: string
          noindex: boolean | null
          page_view_multiplier: number | null
          published: boolean | null
          published_at: string
          recent_page_views: number | null
          republished_at: string | null
          slug: string
          story: Json
          storyblok_id: number
          title: string
          updated_at: string
          uuid: string
        }
        Insert: {
          all_page_views?: number | null
          archived?: boolean | null
          author_text: string
          created_at: string
          description?: string | null
          featured?: boolean | null
          id?: number
          language?: string
          noindex?: boolean | null
          page_view_multiplier?: number | null
          published?: boolean | null
          published_at: string
          recent_page_views?: number | null
          republished_at?: string | null
          slug: string
          story?: Json
          storyblok_id: number
          title: string
          updated_at: string
          uuid: string
        }
        Update: {
          all_page_views?: number | null
          archived?: boolean | null
          author_text?: string
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: number
          language?: string
          noindex?: boolean | null
          page_view_multiplier?: number | null
          published?: boolean | null
          published_at?: string
          recent_page_views?: number | null
          republished_at?: string | null
          slug?: string
          story?: Json
          storyblok_id?: number
          title?: string
          updated_at?: string
          uuid?: string
        }
        Relationships: []
      }
      styles: {
        Row: {
          category: string
          created_at: string
          description: string
          full_name: string
          id: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at: string
          description: string
          full_name: string
          id?: number
          name: string
          slug: string
          updated_at: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          full_name?: string
          id?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "registered_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cp_author_workload: {
        Row: {
          active_assignments: number | null
          active_content_titles: string[] | null
          author_id: number | null
          author_name: string | null
          author_slug: string | null
          avatar_url: string | null
          completed_assignments: number | null
          latest_assignment: string | null
          total_assignments: number | null
        }
        Relationships: []
      }
      cp_calendar_view: {
        Row: {
          all_day: boolean | null
          calendar_event_id: number | null
          campaign_id: number | null
          campaign_name: string | null
          color: string | null
          content_type_icon: string | null
          content_type_name: string | null
          end_date: string | null
          end_time: string | null
          item_id: number | null
          item_type: string | null
          priority: string | null
          start_date: string | null
          start_time: string | null
          status_name: string | null
          title: string | null
        }
        Relationships: []
      }
      cp_campaign_summary: {
        Row: {
          approved_ideas: number | null
          calendar_events: number | null
          campaign_id: number | null
          color: string | null
          completion_percentage: number | null
          description: string | null
          draft_items: number | null
          end_date: string | null
          in_progress_items: number | null
          name: string | null
          published_items: number | null
          release_name: string | null
          scheduled_items: number | null
          slug: string | null
          start_date: string | null
          status: string | null
          total_briefs: number | null
          total_content_items: number | null
          total_ideas: number | null
        }
        Relationships: []
      }
      cp_content_pipeline: {
        Row: {
          content_types: string[] | null
          display_order: number | null
          high_priority_count: number | null
          is_initial: boolean | null
          is_terminal: boolean | null
          item_count: number | null
          overdue_count: number | null
          status_color: string | null
          status_id: number | null
          status_name: string | null
          status_slug: string | null
          urgent_count: number | null
        }
        Relationships: []
      }
      registered_users: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cp_user_has_any_role: {
        Args: { required_roles: string[] }
        Returns: boolean
      }
      cp_user_has_role: { Args: { required_role: string }; Returns: boolean }
      cp_user_is_admin: { Args: never; Returns: boolean }
      cp_user_is_editor_or_above: { Args: never; Returns: boolean }
      cp_user_is_team_member: { Args: never; Returns: boolean }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      get_auth_users: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

