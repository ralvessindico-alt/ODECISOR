import { useEffect, useState } from "react";
import { supabase, listarClientes, listarEquipes } from "../lib/db.js";
import { Group, Row, Pill, Campo, Badge, Titulo, Aviso } from "../components/ui.jsx";

const PAPEIS = [
  { v: "decisor", t: "Decisor", d: "Cria e resolve os próprios casos." },
  { v: "gestor", t: "Gestor", d: "Vê os casos dos clientes atribuídos. Sem números." },
  { v: "admin", t: "Administrador", d: "Vê tudo, incluindo indicadores." },
];

export default function Usuarios({ onVoltar }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [equipes, setEquipes] = useState([]);

  const [editando, setEditando] = useState(null); // { id, email, nome, papel, equipe_id, clientes: [] }

  const carregar = async () => {
    setCarregando(true);
    const [u, p, c, e] = await Promise.all([
      supabase.rpc("usuarios_da_organizacao"),
      supabase.rpc("usuarios_pendentes"),
      listarClientes(),
      listarEquipes(),
    ]);
    if (u.error) setErro(u.error.message);
    setUsuarios(u.data || []);
    setPendentes(p.data || []);
    setClientes(c.data || []);
    setEquipes(e.data || []);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = (pend) =>
    setEditando({
      id: pend.id,
      email: pend.email,
      nome: pend.email.split("@")[0],
      papel: "decisor",
      equipe_id: null,
      clientes: [],
      novo: true,
    });

  const abrirEdicao = (u) =>
    setEditando({
      id: u.id,
      email: u.email,
      nome: u.nome,
      papel: u.papel,
      equipe_id: equipes.find((e) => e.nome === u.equipe)?.id || null,
      clientes: clientes.filter((c) => (u.clientes || []).includes(c.nome)).map((c) => c.id),
      novo: false,
    });

  const salvar = async () => {
    setErro(null);
    const { error } = await supabase.rpc("salvar_usuario", {
      p_id: editando.id,
      p_nome: editando.nome.trim(),
      p_papel: editando.papel,
      p_equipe_id: editando.equipe_id,
      p_clientes: editando.clientes,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    setAviso(`${editando.nome} salvo. Ele já consegue entrar.`);
    setEditando(null);
    carregar();
  };

  const alternar = async (u) => {
    const { error } = await supabase.rpc("alternar_usuario", { p_id: u.id });
    if (error) setErro(error.message);
    else carregar();
  };

  const toggleCliente = (id) =>
    setEditando((e) => ({
      ...e,
      clientes: e.clientes.includes(id)
        ? e.clientes.filter((x) => x !== id)
        : [...e.clientes, id],
    }));

  // ——— Edição ———
  if (editando)
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 120px" }}>
        <Titulo sub={editando.email}>{editando.novo ? "Liberar acesso" : "Editar usuário"}</Titulo>
        {erro && <Aviso>{erro}</Aviso>}

        <Group header="Nome">
          <Row last>
            <Campo
              tipo="text"
              value={editando.nome}
              onChange={(v) => setEditando({ ...editando, nome: v })}
              placeholder="Nome e sobrenome"
            />
          </Row>
        </Group>

        <Group header="Papel">
          {PAPEIS.map((p, i) => (
            <Row
              key={p.v}
              last={i === PAPEIS.length - 1}
              onClick={() => setEditando({ ...editando, papel: p.v })}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 17 }}>{p.t}</div>
                  <div style={{ fontSize: 14, color: "var(--label3)", marginTop: 1 }}>{p.d}</div>
                </div>
                {editando.papel === p.v && (
                  <span style={{ color: "var(--blue)", fontSize: 17, fontWeight: 700 }}>✓</span>
                )}
              </div>
            </Row>
          ))}
        </Group>

        <Group header="Equipe">
          <Row onClick={() => setEditando({ ...editando, equipe_id: null })}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 17, color: "var(--label3)" }}>Sem equipe</span>
              {!editando.equipe_id && (
                <span style={{ color: "var(--blue)", fontSize: 17, fontWeight: 700 }}>✓</span>
              )}
            </div>
          </Row>
          {equipes.map((e, i) => (
            <Row
              key={e.id}
              last={i === equipes.length - 1}
              onClick={() => setEditando({ ...editando, equipe_id: e.id })}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 17 }}>{e.nome}</span>
                {editando.equipe_id === e.id && (
                  <span style={{ color: "var(--blue)", fontSize: 17, fontWeight: 700 }}>✓</span>
                )}
              </div>
            </Row>
          ))}
        </Group>

        <Group
          header="Condomínios"
          footer="Deixe nenhum marcado se a pessoa não atende condomínio específico — os casos dela ficam como Interno ou Externo."
        >
          {clientes.map((c, i) => (
            <Row key={c.id} last={i === clientes.length - 1} onClick={() => toggleCliente(c.id)}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 17 }}>{c.nome}</span>
                {editando.clientes.includes(c.id) && (
                  <span style={{ color: "var(--blue)", fontSize: 17, fontWeight: 700 }}>✓</span>
                )}
              </div>
            </Row>
          ))}
        </Group>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Pill variant="plain" onClick={() => setEditando(null)}>
              Cancelar
            </Pill>
          </div>
          <div style={{ flex: 2 }}>
            <Pill onClick={salvar} disabled={editando.nome.trim().length < 2}>
              Salvar
            </Pill>
          </div>
        </div>
      </main>
    );

  // ——— Lista ———
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 120px" }}>
      <Titulo sub="Crie a conta em Supabase → Authentication e libere o acesso aqui.">
        Usuários
      </Titulo>

      {erro && <Aviso onClick={() => setErro(null)}>{erro}</Aviso>}
      {aviso && (
        <Aviso tipo="ok" onClick={() => setAviso(null)}>
          {aviso}
        </Aviso>
      )}

      {carregando ? (
        <div style={{ color: "var(--label3)", fontSize: 15 }}>Carregando…</div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <Group
              header={`Aguardando liberação · ${pendentes.length}`}
              footer="Estas contas já existem na autenticação, mas não conseguem entrar até você definir papel e acesso."
            >
              {pendentes.map((p, i) => (
                <Row key={p.id} last={i === pendentes.length - 1} onClick={() => abrirNovo(p)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 16 }}>{p.email}</span>
                    <span style={{ color: "var(--blue)", fontSize: 15, fontWeight: 500 }}>
                      Liberar
                    </span>
                  </div>
                </Row>
              ))}
            </Group>
          )}

          <Group header={`Com acesso · ${usuarios.length}`}>
            {usuarios.length === 0 ? (
              <Row last>
                <span style={{ fontSize: 15, color: "var(--label3)" }}>Nenhum usuário ainda.</span>
              </Row>
            ) : (
              usuarios.map((u, i) => (
                <Row key={u.id} last={i === usuarios.length - 1}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 17, opacity: u.ativo ? 1 : 0.45 }}>{u.nome}</span>
                    <Badge
                      cor={
                        u.papel === "admin"
                          ? "var(--purple)"
                          : u.papel === "gestor"
                          ? "var(--orange)"
                          : "var(--blue)"
                      }
                    >
                      {u.papel === "admin" ? "Administrador" : u.papel === "gestor" ? "Gestor" : "Decisor"}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--label3)", marginBottom: 8 }}>
                    {u.email}
                    {u.equipe ? ` · ${u.equipe}` : ""}
                    <br />
                    {u.clientes?.length ? u.clientes.join(" · ") : "independente (sem condomínio)"}
                    {!u.ativo && " · DESATIVADO"}
                  </div>
                  <div style={{ display: "flex", gap: 18 }}>
                    <button
                      onClick={() => abrirEdicao(u)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--blue)",
                        fontSize: 15,
                        fontWeight: 500,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternar(u)}
                      style={{
                        background: "none",
                        border: "none",
                        color: u.ativo ? "var(--red)" : "var(--green)",
                        fontSize: 15,
                        fontWeight: 500,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      {u.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                </Row>
              ))
            )}
          </Group>

          <Pill variant="plain" onClick={onVoltar}>
            Voltar ao painel
          </Pill>
        </>
      )}
    </main>
  );
}
