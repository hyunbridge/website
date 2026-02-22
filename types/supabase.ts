export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      content_items: {
        Row: {
          id: string
          type: "post" | "project" | "page" | string
          owner_id: string | null
          slug: string | null
          title: string
          summary: string | null
          cover_image: string | null
          status: "draft" | "published" | "archived" | string
          published_at: string | null
          current_version_id: string | null
          published_version_id: string | null
          source: string
          source_ref: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: "post" | "project" | "page" | string
          owner_id?: string | null
          slug?: string | null
          title: string
          summary?: string | null
          cover_image?: string | null
          status?: "draft" | "published" | "archived" | string
          published_at?: string | null
          current_version_id?: string | null
          published_version_id?: string | null
          source?: string
          source_ref?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: "post" | "project" | "page" | string
          owner_id?: string | null
          slug?: string | null
          title?: string
          summary?: string | null
          cover_image?: string | null
          status?: "draft" | "published" | "archived" | string
          published_at?: string | null
          current_version_id?: string | null
          published_version_id?: string | null
          source?: string
          source_ref?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      content_versions: {
        Row: {
          id: string
          content_item_id: string
          version_number: number
          snapshot_status: "draft" | "published" | "archived" | string
          body_format: "html" | "markdown" | "json" | string
          title: string
          summary: string | null
          body_text: string | null
          body_json: Json | null
          rendered_html: string | null
          created_by: string | null
          change_description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          content_item_id: string
          version_number: number
          snapshot_status?: "draft" | "published" | "archived" | string
          body_format?: "html" | "markdown" | "json" | string
          title: string
          summary?: string | null
          body_text?: string | null
          body_json?: Json | null
          rendered_html?: string | null
          created_by?: string | null
          change_description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          content_item_id?: string
          version_number?: number
          snapshot_status?: "draft" | "published" | "archived" | string
          body_format?: "html" | "markdown" | "json" | string
          title?: string
          summary?: string | null
          body_text?: string | null
          body_json?: Json | null
          rendered_html?: string | null
          created_by?: string | null
          change_description?: string | null
          created_at?: string
        }
      }
      content_tags: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      content_item_tags: {
        Row: {
          content_item_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          content_item_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          content_item_id?: string
          tag_id?: string
          created_at?: string
        }
      }
      content_links: {
        Row: {
          id: string
          content_item_id: string
          label: string
          url: string
          link_type: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          content_item_id: string
          label: string
          url: string
          link_type?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          content_item_id?: string
          label?: string
          url?: string
          link_type?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          owner_id: string | null
          asset_type: string
          storage_provider: string
          bucket: string | null
          object_key: string
          public_url: string
          mime_type: string | null
          size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          asset_type?: string
          storage_provider?: string
          bucket?: string | null
          object_key: string
          public_url: string
          mime_type?: string | null
          size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          asset_type?: string
          storage_provider?: string
          bucket?: string | null
          object_key?: string
          public_url?: string
          mime_type?: string | null
          size_bytes?: number | null
          created_at?: string
        }
      }
      content_version_assets: {
        Row: {
          content_version_id: string
          asset_id: string
          usage_type: string
          created_at: string
        }
        Insert: {
          content_version_id: string
          asset_id: string
          usage_type?: string
          created_at?: string
        }
        Update: {
          content_version_id?: string
          asset_id?: string
          usage_type?: string
          created_at?: string
        }
      }
      asset_deletion_queue: {
        Row: {
          id: string
          asset_id: string
          object_key: string
          status: string
          attempt_count: number
          next_attempt_at: string
          locked_at: string | null
          last_error: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          object_key: string
          status?: string
          attempt_count?: number
          next_attempt_at?: string
          locked_at?: string | null
          last_error?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          object_key?: string
          status?: string
          attempt_count?: number
          next_attempt_at?: string
          locked_at?: string | null
          last_error?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      post_contents: {
        Row: {
          content_item_id: string
          enable_comments: boolean
          canonical_url: string | null
        }
        Insert: {
          content_item_id: string
          enable_comments?: boolean
          canonical_url?: string | null
        }
        Update: {
          content_item_id?: string
          enable_comments?: boolean
          canonical_url?: string | null
        }
      }
      project_contents: {
        Row: {
          content_item_id: string
          featured: boolean
          sort_order: number
          start_date: string | null
          end_date: string | null
          is_ongoing: boolean
          role: string | null
          organization: string | null
        }
        Insert: {
          content_item_id: string
          featured?: boolean
          sort_order?: number
          start_date?: string | null
          end_date?: string | null
          is_ongoing?: boolean
          role?: string | null
          organization?: string | null
        }
        Update: {
          content_item_id?: string
          featured?: boolean
          sort_order?: number
          start_date?: string | null
          end_date?: string | null
          is_ongoing?: boolean
          role?: string | null
          organization?: string | null
        }
      }
      page_contents: {
        Row: {
          content_item_id: string
          page_key: string
          route_path: string
          is_singleton: boolean
        }
        Insert: {
          content_item_id: string
          page_key: string
          route_path: string
          is_singleton?: boolean
        }
        Update: {
          content_item_id?: string
          page_key?: string
          route_path?: string
          is_singleton?: boolean
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      secure_profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
        }
        Insert: never
        Update: never
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tag = Database["public"]["Tables"]["content_tags"]["Row"]
