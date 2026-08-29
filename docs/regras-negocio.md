# Estrategista — Regras de Negócio

## 1. Máquina de estados do caso

```
NOVO → RELATO → ENTENDIMENTO → PLANO → AGUARDANDO_RESULTADO → {RESOLVIDO | NAO_RESOLVIDO | ABERTO | EXPIRADO}
                                                                              ABERTO → {RESOLVIDO | NAO_RESOLVIDO}
```

- ABERTO: escolha explícita do decisor no Concluir ("salvar como decisão aberta"). Suspende o relógio; sem novo prazo automático; respondível a qualquer momento. Único estado de desfecho não terminal.

- Estados EM_EXECUÇÃO e AGUARDANDO_RESULTADO foram fundidos: não há gatilho observável entre eles (decisão de Ciclo 0).
- Transições são **unidirecionais**. Não existe transição de volta em nenhuma circunstância.
- A validação é dupla: frontend impede visualmente; **backend impede de verdade**. Requisição que tente uma transição inválida (ex.: concluir um caso em RELATO) retorna 409 e é logada.
- EXPIRADO é aplicado pelo servidor quando `now() > deadline_at` e não há resultado. Nunca calculado no cliente para fins de gravação (o cliente pode exibir, o servidor decide).
- Resposta após expiração: **não permitida**. Expirado é terminal. Quem previu que não conseguiria responder no prazo tinha a saída legítima: salvar como aberta.

## 2. Imutabilidade e processo decisório

- `relato_original` e `relato_confirmado` coexistem para sempre. Sobrescrever é bug.
- `quadrante_sugerido_ia` e `quadrante_escolhido` coexistem para sempre. A divergência é métrica de primeira classe.
- Toda saída de IA relevante à jornada é persistida (interpretação, explicação de urgência, princípio, aplicação, aprendizado).
- Nenhuma entidade de jornada aceita UPDATE após confirmação da etapa, exceto os campos de resultado dentro do prazo.

## 3. Relógio

- `started_at` = confirmação do plano (server timestamp). `deadline_at` = started_at + SLA vigente da organização.
- SLA configurável (24/48/72h) por organização; mudança de SLA **não** retroage sobre casos abertos.
- Proibido: lembrete, notificação, e-mail, push sobre prazo. O silêncio é parte do experimento de medição.

## 4. Retentativa

- **Somente o administrador dispara.** O decisor não possui a ação de retentar.
- Pré-condição: caso pai em NAO_RESOLVIDO e **não descartado** (descarte impede retentativa).
- Efeito: novo caso com `caso_pai_id`, atribuído ao mesmo decisor, que percorre a jornada normalmente; herda relato + plano + resultado do pai.
- Contexto da IA na retentativa: relato do pai + plano do pai + resultado + complemento do decisor ("o que aconteceu depois").
- Cadeia reconstruída por recursão em `caso_pai_id`. Reincidência = cadeia com 2+ casos, ou similaridade temática detectada pela IA de aprendizado.

## 5. Classificação administrativa (domínio separado da jornada)

- Admin: **READ** sobre jornada. Nunca UPDATE/DELETE.
- Escritas administrativas sobre um caso: `descartar` (não resolvidos e abertas) e `retentar` (não resolvidos não descartados). Sem ação = mantido.
- Descarte registra: `descartado_por`, `descartado_em`. Sem campo de motivo (decisão de produto; custo assumido: a IA de reincidência trabalha só com o conteúdo dos casos).
- Descarte é irreversível por adm comum; master pode reverter (reversão também auditada). Descarte bloqueia retentativa de forma definitiva enquanto vigente.
- DESCARTAR ≠ DELETE. Não existe DELETE de caso no sistema. Arquivar (uso: testes) = flag, também auditada.

## 6. Indicadores — definições exatas

- **Taxa de resposta** = (resolvidos + não resolvidos) / casos que atingiram AGUARDANDO_RESULTADO.
- **Taxa de resolução** = resolvidos / (resolvidos + não resolvidos). Descartados saem do denominador.
- **Não resolvidos (indicador real)** = NAO_RESOLVIDO e não descartado.
- **Abertas** = ABERTO e não descartado. Adiamento consciente — indicador próprio, nunca somado a expirados.
- **Expirado** = terminal sem resposta. Adiamento silencioso; cruzar com reincidência.
- **Taxa de resposta** considera abertas como não respondidas até que recebam resultado.
- Métricas por usuário nunca incluem casos descartados contra a pessoa.

## 7. Permissões (base para RLS)

| Ação | Decisor | Adm | Master |
|---|---|---|---|
| Criar caso | ✔ (próprio) | ✖ | ✖ |
| Ver caso | próprios | todos da org | todos da org |
| Avançar jornada | próprios, sequencial | ✖ | ✖ |
| Responder resultado | próprios (no prazo, ou a qualquer momento se ABERTO) | ✖ | ✖ |
| Salvar como decisão aberta | próprios, no prazo | ✖ | ✖ |
| Descartar | ✖ | ✔ | ✔ |
| Retentar (devolver ao decisor) | ✖ | ✔ | ✔ |
| Configurar estrutura (condomínios, equipes, SLA, usuários) | ✖ | ✔ | ✔ |
| Gerenciar administradores | ✖ | ✖ | ✔ |
| Exportar dados | ✖ | ✔ | ✔ |

## 8. Autenticação

- Decisor: e-mail + senha via Supabase Auth (hash; a senha em texto puro do protótipo morre aqui). Criado somente pelo admin. Reset de senha: gerado pelo admin, sem fluxo de e-mail.
- Adm/Master: código de acesso individual, gerado pelo master, revogável. Todo descarte e configuração gravam o autor.
- Desativar usuário: bloqueia login, preserva todo o histórico.

## 9. Princípios estratégicos

- Base controlada `principios_estrategicos` (id, princípio, descrição, situações aplicáveis, fonte). Seed inicial: 12–15 princípios da Arte da Guerra com aplicação operacional.
- A IA **seleciona** da base e explica a aplicação ao caso. Não inventa princípio. Evolução futura (RAG/embeddings) fora do escopo inicial.

## 10. Aprendizado

- Insumo: todos os casos, incluindo descartados e expirados.
- Saída classificada em quatro hipóteses: falta de padrão → PROCEDIMENTO; falta de domínio → TREINAMENTO; falta de decisão → GESTÃO; falta de execução → CONTROLE.
- Recomendações são sugestões registradas, nunca ações automáticas.
