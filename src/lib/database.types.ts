/**
 * TypeScript types that describe the database, so queries get autocomplete
 * and type checking.
 *
 * This file follows the exact format Supabase generates. Once your project
 * is linked you can regenerate it from the real database with:
 *   npm run db:types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          location: string | null;
          rating_avg: number | null;
          rating_count: number;
          trades_completed: number;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          location?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          trades_completed?: number;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          location?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          trades_completed?: number;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      username_available: {
        Args: { name: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---- Handy shortcuts used around the app -------------------------------
type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];

export type Profile = Tables<"profiles">;
