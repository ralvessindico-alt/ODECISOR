import { PROMPTS } from "../../prompts/index.js";

/**
 * POST /api/ia/analisar
 * body: { servico: "relato" | "prioridade" | "plano" | "dashboard" | "reincidencia" | "relatorio", dados: {...} }
 *
 * A chave da Anthropic vive apenas aqui. O navegador nunca a vê.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const { servico, dados } = req.body || {};
  const prompt = PROMPTS[servico];
  if (!prompt) {
    return res.status(400).json({ erro: `Serviço de IA desconhecido: ${servico}` });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return res.status(500).json({ erro: "ANTHROPIC_API_KEY não configurada no ambiente." });
  }

  const conteudo = prompt.montarEntrada(dados || {});

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const reforco =
        tentativa > 0
          ? "\n\nIMPORTANTE: responda somente o JSON pedido, o mais curto possível, sem texto fora dele."
          : "";

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": chave,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: prompt.system,
          messages: [{ role: "user", content: conteudo + reforco }],
        }),
      });

      const d = await r.json();
      if (d?.error) throw new Error(d.error.message || d.error.type);

      const texto = (d.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      const limpo = texto.replace(/```json|```/g, "").trim();
      const ini = limpo.indexOf("{");
      const fim = limpo.lastIndexOf("}");
      if (ini === -1 || fim === -1) {
        throw new Error(
          d.stop_reason === "max_tokens" ? "resposta muito longa" : "formato inesperado"
        );
      }

      return res.status(200).json(JSON.parse(limpo.slice(ini, fim + 1)));
    } catch (e) {
      if (tentativa === 2) {
        return res.status(502).json({ erro: e.message || "Falha ao consultar a IA" });
      }
    }
  }
}
