// Placeholder types — regenerate after connecting to Supabase:
//   npx supabase gen types typescript --linked > lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          color: string
          role: 'admin' | 'member' | 'guest'
          family_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          color?: string
          role?: 'admin' | 'member' | 'guest'
          family_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          color?: string
          role?: 'admin' | 'member' | 'guest'
          family_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          family_id: string
          user_id: string
          title: string
          description: string | null
          location: string | null
          start_at: string
          end_at: string
          all_day: boolean
          recurring: Json | null
          source: 'manual' | 'aula'
          aula_uid: string | null
          transport: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          title: string
          description?: string | null
          location?: string | null
          start_at: string
          end_at: string
          all_day?: boolean
          recurring?: Json | null
          source?: 'manual' | 'aula'
          aula_uid?: string | null
          transport?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          title?: string
          description?: string | null
          location?: string | null
          start_at?: string
          end_at?: string
          all_day?: boolean
          recurring?: Json | null
          source?: 'manual' | 'aula'
          aula_uid?: string | null
          transport?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      aula_feeds: {
        Row: {
          id: string
          family_id: string
          user_id: string
          child_name: string
          ics_url: string
          last_synced_at: string | null
          last_event_count: number | null
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          child_name: string
          ics_url: string
          last_synced_at?: string | null
          last_event_count?: number | null
          last_error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          child_name?: string
          ics_url?: string
          last_synced_at?: string | null
          last_event_count?: number | null
          last_error?: string | null
          created_at?: string
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          id: string
          family_id: string
          token: string
          created_by: string | null
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          token?: string
          created_by?: string | null
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          token?: string
          created_by?: string | null
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          family_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          family_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          family_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_family_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never
