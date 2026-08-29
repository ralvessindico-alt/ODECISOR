import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ————— Autenticação —————
export const entrar = (email, senha) =>
  supabase.auth.signInWithPassword({ email, password: senha });

export const sair = () => supabase.auth.signOut();

export const sessaoAtual = () => supabase.auth.getSession();

/**
 * Perfil do usuário logado + clientes vinculados. RLS garante o escopo.
 * Retorna:
 *   { ...perfil }        → acesso liberado
 *   { semPerfil: true }  → autenticado, mas sem cadastro liberado pelo admin
 *   null                 → sem sessão
 *
 * maybeSingle() em vez de single(): sem perfil o PostgREST devolveria 406,
 * que o app tratava como falha genérica e deixava o usuário sem explicação.
 */
export async function meuPerfil() {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) return null;

  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, papel, ativo, equipe_id, equipes(nome), perfis_clientes(cliente_id, clientes(id, nome))")
    .eq("id", sess.session.user.id)
    .maybeSingle();

  if (error) return { semPerfil: true, motivo: error.message };
  if (!data) return { semPerfil: true, email: sess.session.user.email };
  if (!data.ativo) return { semPerfil: true, desativado: true, email: sess.session.user.email };

  return {
    id: data.id,
    nome: data.nome,
    papel: data.papel, // decisor | gestor | admin
    equipe: data.equipes?.nome || null,
    equipeId: data.equipe_id,
    clientes: (data.perfis_clientes || []).map((pc) => pc.clientes).filter(Boolean),
  };
}

// ————— Estrutura —————
export const listarClientes = () =>
  supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome");

export const listarEquipes = () => supabase.from("equipes").select("id, nome").order("nome");

export const listarPrincipios = () => supabase.from("principios").select("*").order("id");

// ————— IA (sempre via API; a chave nunca chega ao navegador) —————
export async function chamarIA(servico, dados) {
  const r = await fetch("/api/ia/analisar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servico, dados }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.erro || "Falha na análise");
  return json;
}

// ————— Casos: jornada do decisor —————

/** Passo 1 — cria o caso já com relato original e confirmado (nunca sobrescreve o original). */
export async function criarCaso({
  relatoOriginal,
  relatoConfirmado,
  interpretacao,
  problemaReal,
  interesses,
  clienteId,
  contextoLivre,
  equipeId,
  casoPaiId = null,
  origemAdmin = false,
}) {
  const { data: sess } = await supabase.auth.getSession();
  return supabase
    .from("casos")
    .insert({
      autor_id: sess.session.user.id,
      cliente_id: clienteId || null,
      contexto_livre: clienteId ? null : contextoLivre || "Externo",
      equipe_id: equipeId || null,
      caso_pai_id: casoPaiId,
      origem_admin: origemAdmin,
      estado: "entendimento",
      relato_original: relatoOriginal,
      relato_confirmado: relatoConfirmado,
      interpretacao_ia: interpretacao,
      problema_real: problemaReal,
      interesses,
    })
    .select()
    .single();
}

/** Passo 2 — grava sugerido E escolhido; a divergência é métrica de gestão. */
export const registrarQuadrante = (casoId, sugerido, escolhido, explicacao) =>
  supabase
    .from("casos")
    .update({
      quadrante_sugerido: sugerido,
      quadrante_escolhido: escolhido,
      explicacao_ia: explicacao,
      estado: "plano",
    })
    .eq("id", casoId)
    .select()
    .single();

/** Passo 3 — salva plano e ações, depois confirma no servidor (dispara o relógio). */
export async function registrarPlano(casoId, { principioId, leitura, erroProvavel, aprendizado, acoes }) {
  const { error: e1 } = await supabase
    .from("casos")
    .update({
      principio_id: principioId,
      leitura_principio: leitura,
      erro_provavel: erroProvavel,
      aprendizado_ia: aprendizado,
    })
    .eq("id", casoId);
  if (e1) throw e1;

  if (acoes?.length) {
    const hoje = new Date();
    const linhas = acoes.map((a, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + (a.prazo_dias || 1));
      return {
        caso_id: casoId,
        ordem: i + 1,
        descricao: a.acao,
        responsavel: a.responsavel,
        data_limite: d.toISOString().slice(0, 10),
        evidencia_esperada: a.evidencia,
      };
    });
    const { error: e2 } = await supabase.from("acoes").insert(linhas);
    if (e2) throw e2;
  }

  // started_at e deadline_at são gravados pelo servidor — o cliente não controla o prazo.
  const { data, error } = await supabase.rpc("confirmar_plano", { p_caso: casoId });
  if (error) throw error;
  return data;
}

/** Passo 4 — desfecho. 'aberto' suspende o prazo; expirado é terminal (validado no servidor). */
export async function registrarResultado(casoId, estado) {
  const { data, error } = await supabase.rpc("registrar_resultado", {
    p_caso: casoId,
    p_estado: estado, // resolvido | nao_resolvido | aberto
  });
  if (error) throw error;
  return data;
}

// ————— Consultas (RLS aplica o escopo automaticamente) —————
const CAMPOS_CASO = `
  id, estado, criado_em, started_at, deadline_at, resultado_em,
  relato_original, relato_confirmado, interpretacao_ia, problema_real, interesses,
  quadrante_sugerido, quadrante_escolhido, explicacao_ia,
  principio_id, leitura_principio, erro_provavel, aprendizado_ia,
  caso_pai_id, origem_admin, arquivado,
  autor_id, perfis!casos_autor_id_fkey(nome),
  cliente_id, clientes(nome), contexto_livre,
  equipe_id, equipes(nome),
  principios(nome, capitulo, mensagem),
  acoes(ordem, descricao, responsavel, data_limite, evidencia_esperada)
`;

/** Junta os casos com a situação administrativa (descartado / retentativa pendente). */
async function comSituacao(query) {
  const { data, error } = await query;
  if (error || !data?.length) return { data: data || [], error };

  const { data: sit } = await supabase
    .from("casos_situacao")
    .select("id, descartado, retentativa_pendente, ultima_acao")
    .in("id", data.map((c) => c.id));

  const mapa = Object.fromEntries((sit || []).map((s) => [s.id, s]));
  return {
    data: data.map((c) => ({
      ...c,
      descartado: mapa[c.id]?.descartado || false,
      retentativaPendente: mapa[c.id]?.retentativa_pendente || false,
    })),
    error: null,
  };
}

export const meusCasos = async () => {
  const { data: sess } = await supabase.auth.getSession();
  return comSituacao(
    supabase
      .from("casos")
      .select(CAMPOS_CASO)
      .eq("autor_id", sess.session.user.id)
      .eq("arquivado", false)
      .order("criado_em", { ascending: false })
  );
};

/** Admin vê a organização; gestor só os clientes vinculados. O filtro real está no RLS. */
export const casosDoPainel = (clienteId = null) => {
  let q = supabase.from("casos").select(CAMPOS_CASO).eq("arquivado", false);
  if (clienteId) q = q.eq("cliente_id", clienteId);
  return comSituacao(q.order("criado_em", { ascending: false }));
};

export const casosMensuraveis = (clienteId = null) => {
  let q = supabase.from("casos_mensuraveis").select(CAMPOS_CASO);
  if (clienteId) q = q.eq("cliente_id", clienteId);
  return q.order("criado_em", { ascending: false });
};

// ————— Ações administrativas (gestor e admin) —————
export async function classificarCaso(casoId, acao) {
  const { data: sess } = await supabase.auth.getSession();
  return supabase.from("classificacoes_admin").insert({
    caso_id: casoId,
    acao, // descartar | retentar | reverter_descarte
    admin_id: sess.session.user.id,
  });
}

export const classificacoesDe = (casoIds) =>
  supabase
    .from("classificacoes_admin")
    .select("caso_id, acao, criado_em, admin_id, perfis(nome)")
    .in("caso_id", casoIds);

// ————— Métricas (regra §6: descartados fora do cálculo) —————
export function calcularMetricas(casosBrutos) {
  // Descartados saem de todos os indicadores (regras-negocio.md §6)
  const casos = casosBrutos.filter((c) => !c.descartado);
  const total = casos.length;
  const por = (e) => casos.filter((c) => c.estado === e).length;
  const resolvidos = por("resolvido");
  const naoResolvidos = por("nao_resolvido");
  const respondidos = resolvidos + naoResolvidos;

  return {
    total,
    resolvidos,
    naoResolvidos,
    abertas: por("aberto"),
    expirados: por("expirado"),
    emPrazo: por("aguardando_resultado"),
    reaberturas: casos.filter((c) => c.caso_pai_id).length,
    taxaResposta: total ? Math.round((respondidos / total) * 100) : 0,
    taxaResolucao: respondidos ? Math.round((resolvidos / respondidos) * 100) : 0,
    // divergência entre o que a IA sugeriu e o que o decisor escolheu
    divergenciaQuadrante: casos.filter(
      (c) => c.quadrante_sugerido && c.quadrante_escolhido && c.quadrante_sugerido !== c.quadrante_escolhido
    ).length,
  };
}
