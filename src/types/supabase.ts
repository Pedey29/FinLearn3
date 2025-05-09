export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          xp: number
          streak: number
          last_streak_date: string | null
          exam_date: string | null
          current_exam: string | null
          daily_goal: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          xp?: number
          streak?: number
          last_streak_date?: string | null
          exam_date?: string | null
          current_exam?: string | null
          daily_goal?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          xp?: number
          streak?: number
          last_streak_date?: string | null
          exam_date?: string | null
          current_exam?: string | null
          daily_goal?: number
          created_at?: string
          updated_at?: string
        }
      }
      blueprints: {
        Row: {
          id: string
          exam: string
          domain: string
          section: string
          learning_outcome: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam: string
          domain: string
          section: string
          learning_outcome: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam?: string
          domain?: string
          section?: string
          learning_outcome?: string
          created_at?: string
          updated_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          blueprint_id: string | null
          title: string
          content: string
          bullet_points: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          blueprint_id?: string | null
          title: string
          content: string
          bullet_points?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          blueprint_id?: string | null
          title?: string
          content?: string
          bullet_points?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          blueprint_id: string | null
          question: string
          choices: Json
          correct_index: number
          explanation: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          blueprint_id?: string | null
          question: string
          choices: Json
          correct_index: number
          explanation: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          blueprint_id?: string | null
          question?: string
          choices?: Json
          correct_index?: number
          explanation?: string
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          card_type: string
          card_id: string
          ease_factor: number
          interval: number
          repetitions: number
          consecutive_correct_answers: number
          next_review: string
          last_review: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_type: string
          card_id: string
          ease_factor?: number
          interval?: number
          repetitions?: number
          consecutive_correct_answers?: number
          next_review?: string
          last_review?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_type?: string
          card_id?: string
          ease_factor?: number
          interval?: number
          repetitions?: number
          consecutive_correct_answers?: number
          next_review?: string
          last_review?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 