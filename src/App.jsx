import { useEffect, useState } from "react";
import {
  supabase,
  entrar,
  sair,
  meuPerfil,
  listarClientes,
  meusCasos,
  casosDoPainel,
  calcularMetricas,
  classificarCaso,
  chamarIA,
} from "./lib/db.js";
import {
  Group,
  Row,
  Pill,
  Campo,
  Badge,
  Metrica,
  Titulo,
  Aviso,
  BarraAcao,
  ESTADOS,
  QUADRANTES,
  fmtData,
  horasRestantes,
} from "./components/ui.jsx";
import Jornada from "./decisor/Jornada.jsx";

export default function App() {
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [tela, setTela] = useState("casos"); // casos | jornada | painel
  const [erro, setErro] = useState(null);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [lista, setLista] = useState([]);
  const [casoPai, setCasoPai] = useState(null);
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [leitura, setLeitura] = useState(null);
  const [lendo, setLendo] = useState(false);

  // ——— Sessão ———
  useEffect(() => {
    (async () => {
      const p = await meuPerfil();
      setPerfil(p);
      if (p) {
        const { data } = await listarClientes();
        setClientes(data || []);
      }
      setCarregando(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!s) {
        setPerfil(null);
        return;
      }
      setPerfil(await meuPerfil());
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const carregarCasos = async () => {
    const { data, error } =
      tela === "painel" ? await casosDoPainel(filtroCliente) : await meusCasos();
    if (error) setErro(error.message);
    setLista(data || []);
  };

  useEffect(() => {
    if (perfil && tela !== "jornada") carregarCasos();
  }, [perfil, tela, filtroCliente]);

  const fazerLogin = async () => {
    setErro(null);
    const { error } = await entrar(email.trim().toLowerCase(), senha);
    if (error) setErro("E-mail ou senha incorretos. Verifique com o administrador.");
  };

  const lerPainel = async () => {
    setLendo(true);
    try {
      const m = calcularMetricas(lista.filter((c) => !c.origem_admin));
      const res = await chamarIA("dashboard", { metricas: m });
      setLeitura(res);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLendo(false);
    }
  };

  const acaoAdmin = async (casoId, acao) => {
    const { error } = await classificarCaso(casoId, acao);
    if (error) setErro(error.message);
    else carregarCasos();
  };

  // ——— Carregando ———
  if (carregando) return <div style={{ padding: 40, color: "var(--label3)" }}>Carregando…</div>;

  // ——— Login ———
  if (!perfil)
    return (
      <div style={{ padding: "60px 16px", maxWidth: 420, margin: "0 auto" }}>
        <Titulo sub="Transforma problema em decisão. Entre com o acesso criado pelo administrador.">
          O Decisor
        </Titulo>
        {erro && <Aviso>{erro}</Aviso>}
        <Group>
          <Row>
            <Campo tipo="email" value={email} onChange={setEmail} placeholder="E-mail" />
          </Row>
          <Row last>
            <Campo tipo="password" value={senha} onChange={setSenha} placeholder="Senha" />
          </Row>
        </Group>
        <Pill onClick={fazerLogin} disabled={!email.includes("@") || senha.length < 4}>
          Entrar
        </Pill>
        <div style={{ fontSize: 13, color: "var(--label3)", textAlign: "center", marginTop: 14 }}>
          Esqueceu a senha? Peça ao administrador para redefinir.
        </div>
      </div>
    );

  const ehGestao = perfil.papel !== "decisor";
  const metricas = calcularMetricas(lista.filter((c) => !c.origem_admin));

  return (
    <div style={{ minHeight: "100vh", paddingBottom: tela === "jornada" ? 0 : 40 }}>
      {/* Barra de navegação */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(242,242,247,0.82)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "0.5px solid var(--sep)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "10px 16px 9px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            onClick={() => {
              setCasoPai(null);
              setTela("casos");
            }}
            style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 17, padding: 0, cursor: "pointer" }}
          >
            {tela === "casos" ? "Meus casos" : "‹ Voltar"}
          </button>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {tela === "painel" ? "Painel" : tela === "jornada" ? "Novo caso" : "O Decisor"}
          </div>
          <button
            onClick={() => (ehGestao ? setTela(tela === "painel" ? "casos" : "painel") : sair())}
            style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 17, padding: 0, cursor: "pointer" }}
          >
            {ehGestao ? (tela === "painel" ? "Casos" : "Painel") : "Sair"}
          </button>
        </div>
      </div>

      {tela === "jornada" ? (
        <Jornada
          perfil={perfil}
          clientes={clientes}
          casoPai={casoPai}
          onConcluir={() => {
            setCasoPai(null);
            setTela("casos");
          }}
        />
      ) : (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 120px" }}>
          {erro && <Aviso onClick={() => setErro(null)}>{erro}</Aviso>}

          {/* ——— PAINEL ——— */}
          {tela === "painel" && (
            <>
              {perfil.papel === "admin" && clientes.length > 0 && (
                <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 20 }}>
                  {[null, ...clientes].map((c) => (
                    <button
                      key={c?.id || "todos"}
                      onClick={() => setFiltroCliente(c?.id || null)}
                      style={{
                        padding: "7px 14px",
                        fontSize: 14,
                        fontWeight: filtroCliente === (c?.id || null) ? 600 : 400,
                        color: filtroCliente === (c?.id || null) ? "#fff" : "var(--label2)",
                        background: filtroCliente === (c?.id || null) ? "var(--blue)" : "var(--card)",
                        border: "none",
                        borderRadius: 20,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {c?.nome || "Todos"}
                    </button>
                  ))}
                </div>
              )}

              <Group header="Leitura do painel" footer="A IA traduz os números e aponta a ação prioritária.">
                <Row last={!leitura} onClick={lendo ? undefined : lerPainel}>
                  <span style={{ fontSize: 17, color: lendo ? "var(--label3)" : "var(--blue)" }}>
                    {lendo ? "Lendo o painel…" : leitura ? "Atualizar leitura" : "Ler o painel para mim"}
                  </span>
                </Row>
                {leitura && (
                  <Row last>
                    <div style={{ fontSize: 15, lineHeight: 1.55, color: "var(--label2)", whiteSpace: "pre-wrap" }}>
                      {leitura.leitura}
                    </div>
                    {leitura.acao && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 13, color: "var(--label3)" }}>Ação prioritária</div>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{leitura.acao}</div>
                      </div>
                    )}
                  </Row>
                )}
              </Group>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 26 }}>
                <Metrica rotulo="Casos" valor={metricas.total} cor="var(--label)" />
                <Metrica rotulo="Resolvidos" valor={`${metricas.taxaResolucao}%`} cor="var(--green)" />
                <Metrica rotulo="Responderam" valor={`${metricas.taxaResposta}%`} cor="var(--blue)" />
                <Metrica rotulo="Não resolvidos" valor={metricas.naoResolvidos} cor="var(--red)" />
                <Metrica rotulo="Abertas" valor={metricas.abertas} cor="var(--blue)" />
                <Metrica rotulo="Expirados" valor={metricas.expirados} cor="var(--label3)" />
              </div>

              <Group
                header={`Fila de decisão · ${lista.filter((c) => c.estado === "nao_resolvido").length}`}
                footer="Casos não resolvidos aguardam sua decisão: retentar devolve ao decisor, descartar encerra e impede nova tentativa."
              >
                {lista.filter((c) => c.estado === "nao_resolvido").length === 0 ? (
                  <Row last>
                    <span style={{ fontSize: 15, color: "var(--label3)" }}>Nenhum caso na fila.</span>
                  </Row>
                ) : (
                  lista
                    .filter((c) => c.estado === "nao_resolvido")
                    .map((c, i, arr) => (
                      <Row key={c.id} last={i === arr.length - 1}>
                        <div style={{ fontSize: 13, color: "var(--label3)", marginBottom: 5 }}>
                          {c.perfis?.nome} · {c.clientes?.nome || c.contexto_livre} · {fmtData(c.criado_em)}
                        </div>
                        <div style={{ fontSize: 15, lineHeight: 1.42, marginBottom: 10 }}>
                          {(c.relato_confirmado || "").slice(0, 150)}
                        </div>
                        <div style={{ display: "flex", gap: 18 }}>
                          <button
                            onClick={() => acaoAdmin(c.id, "retentar")}
                            style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 15, fontWeight: 500, padding: 0, cursor: "pointer" }}
                          >
                            Retentar
                          </button>
                          <button
                            onClick={() => acaoAdmin(c.id, "descartar")}
                            style={{ background: "none", border: "none", color: "var(--red)", fontSize: 15, fontWeight: 500, padding: 0, cursor: "pointer" }}
                          >
                            Descartar
                          </button>
                        </div>
                      </Row>
                    ))
                )}
              </Group>
            </>
          )}

          {/* ——— MEUS CASOS ——— */}
          {tela === "casos" && (
            <>
              <Titulo sub={`${perfil.nome} · ${perfil.equipe || "sem equipe"}`}>Meus casos</Titulo>
              {lista.length === 0 ? (
                <Group>
                  <Row last>
                    <span style={{ fontSize: 15, color: "var(--label3)" }}>
                      Nenhum caso ainda. Relate um problema para começar.
                    </span>
                  </Row>
                </Group>
              ) : (
                <Group header={`${lista.length} casos`}>
                  {lista.map((c, i) => {
                    const e = ESTADOS[c.estado] || { t: c.estado, c: "var(--label3)" };
                    const h = c.deadline_at && c.estado === "aguardando_resultado" ? horasRestantes(c.deadline_at) : null;
                    return (
                      <Row key={c.id} last={i === lista.length - 1}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: "var(--label3)" }}>
                            {c.clientes?.nome || c.contexto_livre} · {fmtData(c.criado_em)}
                            {c.caso_pai_id ? " · Reaberto" : ""}
                          </span>
                          <Badge cor={e.c}>{h !== null ? `${h}h para decidir` : e.t}</Badge>
                        </div>
                        <div style={{ fontSize: 15, lineHeight: 1.42 }}>
                          {(c.relato_confirmado || "").slice(0, 130)}
                        </div>
                      </Row>
                    );
                  })}
                </Group>
              )}
            </>
          )}
        </main>
      )}

      {tela !== "jornada" && (
        <BarraAcao>
          <Pill onClick={() => setTela("jornada")}>Relatar um problema</Pill>
        </BarraAcao>
      )}
    </div>
  );
}
