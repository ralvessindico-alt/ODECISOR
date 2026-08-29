# Estrategista — Arquitetura

## 1. Stack e responsabilidades

```
NAVEGADOR → VERCEL (frontend + API) → SUPABASE (Auth, Postgres+RLS, Storage) 
                        └→ API de IA (chave só no servidor; nunca no browser)
```

- **Supabase**: identidade (Auth), dados (Postgres), permissão (RLS por organização e papel), evidências futuras (Storage), operações sensíveis (Functions se necessário).
- **Vercel**: frontend React + rotas de API. Toda transição de estado e todo cálculo de prazo passam pela API — o cliente nunca grava estado diretamente.
- **IA**: chamada exclusivamente server-side.

## 2. Hierarquia de tenant (correção de Ciclo 0)

```
ORGANIZAÇÃO (administradora — tenant)
 ├── CONDOMÍNIOS (o que o decisor seleciona no Passo 1)
 ├── EQUIPES
 ├── USUÁRIOS (decisores)
 └── ADMINISTRADORES (adm | master)
```

Piloto: uma organização (A3 Condomínios). O schema já nasce multi-tenant; RLS filtra tudo por `organizacao_id`.

## 3. Entidades (domínio, ainda não SQL final)

```
organizacoes
condominios          (organizacao_id)
equipes              (organizacao_id)
usuarios             (organizacao_id, equipe_id, ativo)
administradores      (organizacao_id, papel: adm|master, codigo, ativo)

casos                (organizacao_id, condominio_id, usuario_id, equipe_id,
                      estado, caso_pai_id,
                      relato_original, relato_confirmado, interpretacao_ia,
                      quadrante_sugerido_ia, quadrante_escolhido, explicacao_ia,
                      principio_id, aplicacao_principio, aprendizado_ia,
                      started_at, deadline_at, resultado_em)

acoes                (caso_id, ordem, descricao, responsavel, data_limite,
                      evidencia_esperada, status)
                      -- entidade própria: amanhã comporta comentário, anexo,
                      -- medição de atraso, mais de 4 ações

classificacoes_admin (caso_id, tipo: descartar|retentar|reverter_descarte,
                      admin_id, criado_em)   -- domínio separado da jornada

principios_estrategicos (principio, descricao, situacoes, fonte)

auditoria            (quem, o quê, quando — toda escrita administrativa)

aprendizado
 ├── padroes_detectados (tema, hipotese: procedimento|treinamento|gestao|controle,
 │                       casos_relacionados, sugestao, gerado_em)
 └── (reincidência deriva de caso_pai_id + análise temática; não é tabela própria)
```

Regra estrutural: tabelas de jornada são append-only na prática (ver regras-negocio.md §2).

## 4. Serviços de IA (separados desde o início)

| Serviço | Função | Prompt |
|---|---|---|
| AI_RELATO | Ishikawa + reorganização + lacunas | prompts/relato/ |
| AI_PRIORIDADE | Eisenhower + explicação didática | prompts/prioridade/ |
| AI_PLANO | seleção de princípio da base + ações | prompts/plano/ |
| AI_RETRY | análise da falha da tentativa anterior | prompts/retry/ |
| AI_DASHBOARD | leitura do painel + ação prioritária | prompts/dashboard/ |
| AI_REINCIDENCIA | padrões em descartados/não resolvidos | prompts/reincidencia/ |
| AI_RELATORIO | diagnóstico dos decisores | prompts/relatorio/ |

Cada serviço: prompt versionado no repositório, saída JSON com schema validado, testável isoladamente. Um prompt gigante fazendo tudo é proibido.

## 5. Repositório

```
estrategista/
├── src/            (decisor/ admin/ auth/ components/ services/)
├── api/            (ia/ casos/ admin/)
├── supabase/       (migrations/)
├── prompts/        (relato/ prioridade/ plano/ retry/ dashboard/ reincidencia/ relatorio/)
├── tests/
├── docs/           (produto.md arquitetura.md regras-negocio.md)
└── README.md
```

## 6. Ordem de desenvolvimento

- **Ciclo 0 — Especificação** ✔ (estes três documentos)
- **Ciclo 1 — Caso mínimo**: login → escolher condomínio → relatar → IA reorganiza → confirmar. Nada além.
- **Ciclo 2 — Decisão completa**: entender → agir → concluir. Primeiro ciclo funcional.
- **Ciclo 3 — Relógio**: deadline server-side, expiração, resultado.
- **Ciclo 4 — Administração**: fila, manter/descartar com motivo, leitura da jornada, auditoria.
- **Ciclo 5 — Indicadores**: taxas reais (só agora há dado).
- **Ciclo 6 — Aprendizado**: reincidência, procedimentos, treinamentos, pontos de atenção.
- **Ciclo 7 — Automação**: calendário (.ics), CSV, integrações (n8n apenas periférico).

Regra de entrada de tecnologia: só entra o que resolve um problema real do Estrategista.

## 7. Uso do Claude Code

Tarefas pequenas sobre especificação, nunca "crie o Estrategista". Modelo de tarefa:

```
Leia docs/produto.md e docs/regras-negocio.md.
Não implemente ainda.
[objetivo específico do ciclo atual]
A jornada é sequencial e o administrador não edita dados do decisor.
Aponte riscos de modelagem antes de propor código/SQL.
```

## 8. Débitos herdados do protótipo (v11) que morrem na migração

1. Senha em texto puro → Supabase Auth (hash).
2. Código de admin no código-fonte → tabela + verificação server-side.
3. Estado validado só no cliente → API valida toda transição.
4. Relógio calculado no cliente → deadline server-side.
5. Análises de IA limitadas a ~20 casos por chamada → processamento em lote.
6. Armazenamento do artifact → Postgres com RLS e backup.
7. Retentativa pelo decisor (v11 "Tentar de novo") → removida; retentativa é ação exclusiva do admin.
8. Sem estado ABERTO no protótipo → incluído na máquina de estados.
