import { useState } from "react";
import {
  chamarIA,
  criarCaso,
  registrarQuadrante,
  registrarPlano,
  registrarResultado,
} from "../lib/db.js";
import {
  Group,
  Row,
  Pill,
  Campo,
  Titulo,
  Aviso,
  BarraAcao,
  QUADRANTES,
} from "../components/ui.jsx";

const PASSOS = ["Relatar", "Entender", "Agir", "Concluir"];

export default function Jornada({ perfil, clientes, onConcluir, casoPai = null }) {
  const [etapa, setEtapa] = useState(1);
  const [sub, setSub] = useState("escrever");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const [relatoBruto, setRelatoBruto] = useState(
    casoPai
      ? `${casoPai.relato_confirmado}\n\n— O que foi tentado e não resolveu —\n${(casoPai.acoes || [])
          .map((a) => `• ${a.descricao}`)
          .join("\n")}\n\n— O que aconteceu depois —\n`
      : ""
  );
  const [r1, setR1] = useState(null);
  const [relatoEditavel, setRelatoEditavel] = useState("");
  const [r2, setR2] = useState(null);
  const [quadrante, setQuadrante] = useState(null);
  const [r3, setR3] = useState(null);
  const [caso, setCaso] = useState(null);
  const [registrado, setRegistrado] = useState(false);

  const run = async (fn, contexto) => {
    setLoading(true);
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(`${contexto}. Toque no botão novamente${e?.message ? ` (${e.message})` : ""}.`);
    } finally {
      setLoading(false);
    }
  };

  // ——— Passo 1 ———
  const passo1 = () =>
    run(async () => {
      const res = await chamarIA("relato", {
        relato: relatoBruto,
        clientes: clientes.map((c) => c.nome),
        reabertura: !!casoPai,
      });
      setR1(res);
      setRelatoEditavel(res.relato_estruturado || relatoBruto);
      setSub("revisar");
    }, "Não foi possível organizar o relato");

  const confirmarRelato = () =>
    run(async () => {
      const cli = clientes.find((c) => c.nome === r1.contexto);
      const { data, error } = await criarCaso({
        relatoOriginal: relatoBruto,
        relatoConfirmado: relatoEditavel,
        interpretacao: r1.interpretacao,
        problemaReal: r1.problema_real,
        interesses: r1.interesses,
        clienteId: cli?.id || null,
        contextoLivre: cli ? null : r1.contexto,
        equipeId: perfil.equipeId,
        casoPaiId: casoPai?.id || null,
        origemAdmin: perfil.papel !== "decisor",
      });
      if (error) throw error;
      setCaso(data);

      const res = await chamarIA("prioridade", { relato: relatoEditavel });
      setR2(res);
      setQuadrante(res.quadrante);
      setEtapa(2);
    }, "Não foi possível analisar a urgência");

  // ——— Passo 2 ———
  const confirmarQuadrante = () =>
    run(async () => {
      const { error } = await registrarQuadrante(caso.id, r2.quadrante, quadrante, r2.explicacao);
      if (error) throw error;

      const res = await chamarIA("plano", {
        relato: relatoEditavel,
        quadrante,
        reabertura: !!casoPai,
        tentativaAnterior: casoPai ? (casoPai.acoes || []).map((a) => a.descricao).join("; ") : null,
      });
      setR3(res);
      await registrarPlano(caso.id, {
        principioId: res.principio_id,
        leitura: res.leitura,
        erroProvavel: res.erro_provavel,
        aprendizado: res.aprendizado,
        acoes: res.plano,
      });
      setEtapa(3);
    }, "Não foi possível montar o plano");

  // ——— Passo 4 ———
  const desfecho = (estado) =>
    run(async () => {
      await registrarResultado(caso.id, estado);
      setRegistrado(true);
    }, "Não foi possível registrar o desfecho");

  return (
    <>
      {/* Progresso */}
      <nav style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 12px", display: "flex", gap: 6 }}>
        {PASSOS.map((p, i) => (
          <div key={p} style={{ flex: 1 }}>
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background:
                  etapa > i + 1 ? "var(--green)" : etapa === i + 1 ? "var(--blue)" : "#D1D1D6",
                marginBottom: 5,
              }}
            />
            <div
              style={{
                fontSize: 11,
                textAlign: "center",
                fontWeight: etapa === i + 1 ? 600 : 400,
                color: etapa === i + 1 ? "var(--label)" : "var(--label3)",
                opacity: etapa >= i + 1 ? 1 : 0.5,
              }}
            >
              {p}
            </div>
          </div>
        ))}
      </nav>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 130px" }}>
        {erro && <Aviso>{erro}</Aviso>}

        {/* PASSO 1 — escrever */}
        {etapa === 1 && sub === "escrever" && (
          <>
            <Titulo sub="Condomínio, fornecedor, equipe, contrato ou uma decisão sua. Escreva com suas palavras — a ferramenta organiza e identifica o contexto sozinha.">
              Qual é o problema?
            </Titulo>
            {casoPai && (
              <Aviso tipo="alerta">
                <strong>Segunda tentativa.</strong> Complete o que aconteceu depois do primeiro plano.
              </Aviso>
            )}
            <Group footer="Ajuda muito contar: quem está envolvido, como é feito hoje, que equipamento ou material entra nisso, e números — datas, valores, quantas vezes aconteceu.">
              <Campo
                value={relatoBruto}
                onChange={setRelatoBruto}
                placeholder="Ex.: a bomba d'água do bloco B parou de novo, terceira vez em dois meses…"
              />
            </Group>
          </>
        )}

        {/* PASSO 1 — revisar */}
        {etapa === 1 && sub === "revisar" && r1 && (
          <>
            <Titulo>Confira o relato</Titulo>
            <Group header="O que entendemos" footer={`Contexto identificado: ${r1.contexto}`}>
              <Row last={!r1.problema_real && !r1.interesses}>
                <div style={{ fontSize: 16, lineHeight: 1.5, color: "var(--label2)" }}>
                  {r1.interpretacao}
                </div>
              </Row>
              {r1.problema_real && (
                <Row last={!r1.interesses}>
                  <div style={{ fontSize: 13, color: "var(--label3)", marginBottom: 3 }}>
                    O problema por trás
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.45, fontWeight: 500 }}>
                    {r1.problema_real}
                  </div>
                </Row>
              )}
              {r1.interesses && (
                <Row last>
                  <div style={{ fontSize: 13, color: "var(--label3)", marginBottom: 3 }}>
                    Interesses em jogo
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.45, color: "var(--label2)" }}>
                    {r1.interesses}
                  </div>
                </Row>
              )}
            </Group>

            {r1.precisa_ficar_claro?.length > 0 && (
              <Group header="Precisa ficar claro" footer="Complete no campo abaixo.">
                {r1.precisa_ficar_claro.map((f, i) => (
                  <Row key={i} last={i === r1.precisa_ficar_claro.length - 1}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: "var(--orange)", fontSize: 17 }}>•</span>
                      <span style={{ fontSize: 16, lineHeight: 1.45 }}>{f}</span>
                    </div>
                  </Row>
                ))}
              </Group>
            )}

            <Group header="Seu relato organizado" footer="Edite à vontade.">
              <Campo value={relatoEditavel} onChange={setRelatoEditavel} rows={9} />
            </Group>
          </>
        )}

        {/* PASSO 2 */}
        {etapa === 2 && r2 && (
          <>
            <Titulo>Urgente ou importante?</Titulo>
            <Group header="Por quê">
              <Row last>
                <div style={{ fontSize: 16, lineHeight: 1.5, color: "var(--label2)" }}>
                  {r2.explicacao}
                </div>
              </Row>
            </Group>
            <Group header="Escolha a classificação" footer={r2.resumo_quadrante}>
              {Object.entries(QUADRANTES).map(([q, info], i) => (
                <Row key={q} last={i === 3} onClick={() => setQuadrante(q)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 17 }}>{info.t}</div>
                      <div style={{ fontSize: 14, color: "var(--label3)", marginTop: 1 }}>{info.a}</div>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        border: quadrante === q ? "none" : "1.5px solid #C7C7CC",
                        background: quadrante === q ? "var(--blue)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {quadrante === q && (
                        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>
                      )}
                    </div>
                  </div>
                </Row>
              ))}
            </Group>
          </>
        )}

        {/* PASSO 3 */}
        {etapa === 3 && r3 && (
          <>
            <Titulo sub="O prazo de decisão começou a contar.">O plano</Titulo>
            <Group header="Princípio estratégico">
              <Row last={!r3.leitura && !r3.erro_provavel}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>
                  {caso?.principio_id ? "" : ""}
                  {r3.principio_nome || ""}
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.5, color: "var(--label2)" }}>
                  {r3.leitura}
                </div>
              </Row>
              {r3.erro_provavel && (
                <Row last>
                  <div style={{ fontSize: 13, color: "var(--orange)", marginBottom: 3 }}>
                    Erro provável agora
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 500 }}>
                    {r3.erro_provavel}
                  </div>
                </Row>
              )}
            </Group>

            <Group header="Ações">
              {(r3.plano || []).map((p, i) => (
                <Row key={i} last={i === r3.plano.length - 1}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "var(--blue)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, lineHeight: 1.35, marginBottom: 5 }}>{p.acao}</div>
                      <div style={{ fontSize: 14, color: "var(--label3)", lineHeight: 1.5 }}>
                        {p.responsavel} · {p.prazo_dias} dia(s)
                        <br />
                        Evidência: {p.evidencia}
                      </div>
                    </div>
                  </div>
                </Row>
              ))}
            </Group>

            {r3.aprendizado && (
              <Group header="Aprendizado">
                <Row last>
                  <div style={{ fontSize: 16, lineHeight: 1.5, color: "var(--label2)" }}>
                    {r3.aprendizado}
                  </div>
                </Row>
              </Group>
            )}
          </>
        )}

        {/* PASSO 4 */}
        {etapa === 4 && (
          <>
            <Titulo>Concluir</Titulo>
            <Group
              header="Qual é o desfecho?"
              footer={
                registrado
                  ? "Registrado."
                  : "Resolvido ou não resolvido encerram o caso. Salvar como decisão aberta suspende o prazo. Sem nenhuma ação, o caso expira ao fim do prazo."
              }
            >
              {registrado ? (
                <Row last>
                  <span style={{ fontSize: 17, color: "var(--green)" }}>Registrado</span>
                </Row>
              ) : (
                <>
                  <Row onClick={() => desfecho("resolvido")}>
                    <span style={{ fontSize: 17, color: "var(--blue)" }}>Sim, resolvido</span>
                  </Row>
                  <Row onClick={() => desfecho("nao_resolvido")}>
                    <span style={{ fontSize: 17, color: "var(--blue)" }}>Não resolvido</span>
                  </Row>
                  <Row last onClick={() => desfecho("aberto")}>
                    <span style={{ fontSize: 17, color: "var(--blue)" }}>
                      Salvar como decisão aberta
                    </span>
                  </Row>
                </>
              )}
            </Group>
          </>
        )}
      </main>

      <BarraAcao>
        {etapa === 1 && sub === "escrever" && (
          <Pill onClick={passo1} disabled={loading || relatoBruto.trim().length < 15}>
            {loading ? "Lendo seu relato…" : "Organizar relato"}
          </Pill>
        )}
        {etapa === 1 && sub === "revisar" && (
          <Pill onClick={confirmarRelato} disabled={loading || !relatoEditavel.trim()}>
            {loading ? "Analisando…" : "Confirmar relato"}
          </Pill>
        )}
        {etapa === 2 && (
          <Pill onClick={confirmarQuadrante} disabled={loading || !quadrante}>
            {loading ? "Montando o plano…" : "Confirmar classificação"}
          </Pill>
        )}
        {etapa === 3 && <Pill onClick={() => setEtapa(4)}>Recebi o plano</Pill>}
        {etapa === 4 && (
          <Pill variant="plain" onClick={onConcluir}>
            {registrado ? "Novo problema" : "Responder depois"}
          </Pill>
        )}
      </BarraAcao>
    </>
  );
}
