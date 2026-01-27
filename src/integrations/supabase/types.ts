export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      notificacoes_musicas: {
        Row: {
          arquivo_baixado: string | null
          artista: string
          created_at: string
          id: string
          prioridade: number | null
          radio_origem: string
          status: string
          tentativas_download: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_baixado?: string | null
          artista: string
          created_at?: string
          id?: string
          prioridade?: number | null
          radio_origem: string
          status?: string
          tentativas_download?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_baixado?: string | null
          artista?: string
          created_at?: string
          id?: string
          prioridade?: number | null
          radio_origem?: string
          status?: string
          tentativas_download?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      radio_historico: {
        Row: {
          arquivo_correspondente: string | null
          artista: string | null
          created_at: string
          download_concluido: boolean | null
          download_iniciado: boolean | null
          encontrado_no_acervo: boolean | null
          id: string
          musica: string
          notificacao_enviada: boolean | null
          radio_id: string
          radio_nome: string
          timestamp: string
          titulo: string | null
        }
        Insert: {
          arquivo_correspondente?: string | null
          artista?: string | null
          created_at?: string
          download_concluido?: boolean | null
          download_iniciado?: boolean | null
          encontrado_no_acervo?: boolean | null
          id?: string
          musica: string
          notificacao_enviada?: boolean | null
          radio_id: string
          radio_nome: string
          timestamp?: string
          titulo?: string | null
        }
        Update: {
          arquivo_correspondente?: string | null
          artista?: string | null
          created_at?: string
          download_concluido?: boolean | null
          download_iniciado?: boolean | null
          encontrado_no_acervo?: boolean | null
          id?: string
          musica?: string
          notificacao_enviada?: boolean | null
          radio_id?: string
          radio_nome?: string
          timestamp?: string
          titulo?: string | null
        }
        Relationships: []
      }
      radios_monitoradas: {
        Row: {
          created_at: string
          habilitada: boolean | null
          id: string
          nome: string
          radio_id: string
          tocando_agora: string | null
          ultima_atualizacao: string | null
          ultimas_tocadas: string[] | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          habilitada?: boolean | null
          id?: string
          nome: string
          radio_id: string
          tocando_agora?: string | null
          ultima_atualizacao?: string | null
          ultimas_tocadas?: string[] | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          habilitada?: boolean | null
          id?: string
          nome?: string
          radio_id?: string
          tocando_agora?: string | null
          ultima_atualizacao?: string | null
          ultimas_tocadas?: string[] | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
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
  public: {
    Enums: {},
  },
} as const
