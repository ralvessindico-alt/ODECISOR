# Estrategista — Produto

## Tese

O Estrategista transforma problema mal relatado em decisão registrada dentro de um prazo, e decisões acumuladas em inteligência de gestão. O coração do produto não é uma tela, uma IA ou um banco: é o **histórico imutável da jornada de cada caso**.

## Três motores (mantidos separados)

1. **Motor de Decisão** — relato → entendimento → prioridade → ação (operado pelo decisor)
2. **Motor de Controle** — prazo → resolução → falha → expiração (operado por ninguém: relógio server-side)
3. **Motor de Aprendizado** — decisões acumuladas → padrões → recomendações de gestão (operado pelo administrador com apoio de IA)

## Ciclo conceitual oficial

REALIDADE → INTELIGÊNCIA → PRIORIDADE → DECISÃO → EXECUÇÃO → CONTROLE → APRENDIZADO → NOVA REALIDADE

## Papéis

| Papel | Entra com | Faz | Não faz |
|---|---|---|---|
| **Decisor** | e-mail + senha (criados pelo admin) | cria casos, percorre a jornada, responde resultado, retenta | não vê casos alheios, não vê painel, não altera prazo |
| **Administrador (adm)** | código de acesso | lê tudo da sua organização, classifica (manter/descartar com motivo), configura estrutura, consome análises de IA | não edita jornada de caso, não cria/gerencia administradores |
| **Admin Master** | código de acesso | tudo do adm + gerencia administradores | não edita jornada de caso |

Não existe autocadastro. Sem lembrete de prazo — o silêncio é instrumento de medição.

## Jornada do decisor (sequencial, sem voltar, sem pular)

1. **Relatar** — escolhe condomínio, escreve livre. IA (Ishikawa) devolve: o que entendeu, o que falta, relato reorganizado. Usuário edita e confirma. Guardam-se `relato_original` E `relato_confirmado` — nunca sobrescrever.
2. **Entender** — IA (Eisenhower) explica urgência × importância e sugere quadrante. Usuário confirma ou troca. Guardam-se `quadrante_sugerido_ia` E `quadrante_escolhido` — a divergência é dado de gestão.
3. **Agir** — IA seleciona um princípio da base controlada (Arte da Guerra) e gera plano de até 4 ações (descrição, responsável, data, evidência). Confirmação do plano dispara o relógio.
4. **Concluir** — exportação opcional ao calendário + três saídas: **Resolvido**, **Não resolvido**, ou **Salvar como decisão aberta** (adiamento consciente). Silêncio até o prazo = expira.

## O relógio

- Prazo padrão 48h (configurável pelo admin: 24/48/72), gravado no servidor no momento da confirmação do plano (`started_at`, `deadline_at`).
- Desfechos: **Resolvido** | **Não resolvido** (sobe à fila do admin) | **Aberta** (decisor optou por salvar: adiamento consciente, sem novo prazo, respondível a qualquer momento) | **Expirado** (silêncio até o prazo).
- Expirado é ambíguo por design: problema que morreu sozinho OU adiamento silencioso. Aberta é adiamento às claras. A reincidência posterior distingue os casos.
- Nenhum lembrete, nenhuma notificação. Regra de produto, não limitação.

## Retentativa

Exclusiva do administrador. O decisor não retenta por conta própria. Na fila, o admin decide sobre um não resolvido: **retentar** (cria novo caso com `caso_pai_id`, devolvido ao mesmo decisor, herdando relato + plano anterior + resultado — a IA ataca o que falhou, não repete a análise) ou **descartar** (encerra; descarte impede retentativa). Sem ação do admin, o caso permanece como indicador real de não resolvido.

## Administração

- **Fila de decisão**: casos não resolvidos aguardam o admin — **retentar** (devolve ao decisor como nova tentativa vinculada), **descartar** (sai do indicador; entra no aprendizado; impede retentativa) ou nenhuma ação (permanece como indicador real). Decisões abertas antigas também podem ser descartadas.
- **Leitura da jornada**: admin vê o caso exatamente como o decisor viveu (read-only, atualizado por abertura, não em tempo real).
- **Descartar ≠ deletar.** Nada é apagado. Descarte registra quem, quando e por quê.
- **IA no painel**: leitura em linguagem simples da visão geral + ação prioritária; análise de decisores no relatório; análise de reincidência sobre descartados + não resolvidos, classificando cada padrão em: falta de padrão → PROCEDIMENTO; falta de domínio → TREINAMENTO; falta de decisão → GESTÃO; falta de execução → CONTROLE.

## Indicadores centrais

Taxa de resposta (decidiram dentro do prazo), taxa de resolução (das respondidas), não resolvidos mantidos (indicador real), **abertas** (adiamento consciente), expirados (adiamento silencioso), retentativas, descartados — fatiados por organização, condomínio, equipe e usuário.

## O que o produto NÃO é

- Não é sistema de tarefas nem de chamados.
- Não cobra ninguém. Não notifica prazo.
- Não permite ao admin interferir na jornada.
- Não apaga histórico, nunca.
