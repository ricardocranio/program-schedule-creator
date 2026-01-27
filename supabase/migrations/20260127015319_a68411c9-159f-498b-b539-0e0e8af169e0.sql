-- Tabela para armazenar histórico de músicas captadas das rádios
CREATE TABLE public.radio_historico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    radio_id TEXT NOT NULL,
    radio_nome TEXT NOT NULL,
    musica TEXT NOT NULL,
    artista TEXT,
    titulo TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    encontrado_no_acervo BOOLEAN DEFAULT false,
    arquivo_correspondente TEXT,
    notificacao_enviada BOOLEAN DEFAULT false,
    download_iniciado BOOLEAN DEFAULT false,
    download_concluido BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_radio_historico_radio_id ON public.radio_historico(radio_id);
CREATE INDEX idx_radio_historico_timestamp ON public.radio_historico(timestamp DESC);
CREATE INDEX idx_radio_historico_encontrado ON public.radio_historico(encontrado_no_acervo);
CREATE INDEX idx_radio_historico_notificacao ON public.radio_historico(notificacao_enviada) WHERE NOT notificacao_enviada;

-- Tabela para configurações de rádios monitoradas
CREATE TABLE public.radios_monitoradas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    radio_id TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    url TEXT,
    habilitada BOOLEAN DEFAULT true,
    tocando_agora TEXT,
    ultimas_tocadas TEXT[],
    ultima_atualizacao TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para notificações de músicas não encontradas
CREATE TABLE public.notificacoes_musicas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    artista TEXT NOT NULL,
    titulo TEXT NOT NULL,
    radio_origem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente', -- pendente, baixando, concluido, ignorado
    prioridade INTEGER DEFAULT 0,
    tentativas_download INTEGER DEFAULT 0,
    arquivo_baixado TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar notificações pendentes
CREATE INDEX idx_notificacoes_status ON public.notificacoes_musicas(status) WHERE status = 'pendente';
CREATE INDEX idx_notificacoes_unique ON public.notificacoes_musicas(artista, titulo);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_radios_monitoradas_updated_at
    BEFORE UPDATE ON public.radios_monitoradas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notificacoes_updated_at
    BEFORE UPDATE ON public.notificacoes_musicas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS (políticas públicas para uso local)
ALTER TABLE public.radio_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radios_monitoradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_musicas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS públicas (aplicação local, sem autenticação)
CREATE POLICY "Allow all access to radio_historico" ON public.radio_historico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to radios_monitoradas" ON public.radios_monitoradas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to notificacoes_musicas" ON public.notificacoes_musicas FOR ALL USING (true) WITH CHECK (true);

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_musicas;