export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          slug: string
          content: string
          author_id: string
          summary: string
          cover_image: string | null
          is_published: boolean
          published_at: string
          enable_comments: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          slug: string
          content: string
          author_id: string
          summary: string
          cover_image?: string | null
          is_published?: boolean
          published_at?: string
          enable_comments?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          slug?: string
          content?: string
          author_id?: string
          summary?: string
          cover_image?: string | null
          is_published?: boolean
          published_at?: string
          enable_comments?: boolean
        }
      }
      post_versions: {
        Row: {
          id: string
          post_id: string
          version_number: number
          title: string
          content: string
          summary: string
          created_at: string
          created_by: string
          change_description: string | null
        }
        Insert: {
          id?: string
          post_id: string
          version_number: number
          title: string
          content: string
          summary: string
          created_at?: string
          created_by: string
          change_description?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          version_number?: number
          title?: string
          content?: string
          summary?: string
          created_at?: string
          created_by?: string
          change_description?: string | null
        }
      }
      post_tags: {
        Row: {
          id: string
          post_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          post_id: string
          tag_id: string
        }
        Update: {
          id?: string
          post_id?: string
          tag_id?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
      }
      post_images: {
        Row: {
          id: string
          post_id: string
          url: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          url: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          url?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string
          avatar_url: string | null
        }
        Insert: {
          id: string
          username: string
          full_name?: string
          avatar_url?: string | null
        }
        Update: {
          id?: string
          username?: string
          full_name?: string
          avatar_url?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
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

export type Tag = {
  id: string
  name: string
  slug: string
}
