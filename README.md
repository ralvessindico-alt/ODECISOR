# O Decisor

Transforma problema mal relatado em decisão registrada dentro de um prazo, e decisões acumuladas em inteligência de gestão.

O coração do produto é o **histórico imutável da jornada de cada caso** — não a tela, não a IA, não o banco.

## Estado atual

Ciclos 1–4 da arquitetura (jornada completa, relógio server-side, administração básica). Piloto interno A3.

## Passo a passo do deploy

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. SQL Editor → cole `supabase/001_schema_inicial.sql` → **Run**.
   Antes de rodar, ajuste os nomes dos condomínios e equipes na seção 9 do arquivo.
3. Authentication → Users → **Add user** com seu e-mail e senha. Copie o UUID gerado.
4. SQL Editor → crie seu perfil de administrador:
   ```sql
   insert into perfis (id, nome, papel)
   values ('<UUID-COPIADO>', 'Rodrigo', 'admin');
   ```
5. Vincule seus clientes (repita por condomínio):
   ```sql
   insert into perfis_clientes (perfil_id, cliente_id)
   select '<UUID-COPIADO>', id from clientes;
   ```
6. Agende a expiração automática (Database → Extensions → habilite `pg_cron`):
   ```sql
   select cron.schedule('expirar-casos', '*/15 * * * *', 'select expirar_casos()');
   ```
7. Settings → API: copie **Project URL** e a chave **anon/publishable**.

### 2. GitHub

```bash
git init
git add .
git commit -m "O Decisor — fundação"
git branch -M main
git remote add origin https://github.com/<voce>/odecisor.git
git push -u origin main
```

### 3. Vercel

1. **Add New → Project** → importe o repositório. O Vite é detectado automaticamente.
2. **Environment Variables** — as três:

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL do Supabase |
   | `VITE_SUPABASE_ANON_KEY` | chave anon/publishable |
   | `ANTHROPIC_API_KEY` | sua chave da Anthropic |

   `ANTHROPIC_API_KEY` **não** leva prefixo `VITE_`. Com o prefixo ela iria para o navegador e ficaria exposta.
3. Deploy.
4. Settings → Domains → adicione `odecisor.com.br` e aponte o DNS conforme as instruções.

### 4. Cadastrar a equipe

Cada pessoa: crie em Authentication → Users, depois insira o perfil e o vínculo de clientes (mesmos comandos do passo 1.4 e 1.5, com `papel` = `decisor` ou `gestor`).

Automatizar isso pela interface é a primeira tarefa do próximo ciclo.

## Como rodar local

```bash
npm install
cp .env.example .env.local   # preencha as três variáveis
npx vercel dev               # necessário para as rotas /api funcionarem
```

`npm run dev` sozinho sobe o front, mas as chamadas de IA falham — elas dependem da função serverless.

## Papéis

| Papel | Vê | Faz |
|---|---|---|
| `decisor` | os próprios casos, nos clientes vinculados | percorre a jornada, responde o desfecho |
| `gestor` | casos dos clientes vinculados | retentar, descartar |
| `admin` | toda a organização, com filtro por cliente | tudo acima + estrutura |

O isolamento é garantido por RLS no Postgres, não por filtro de tela.

## Regras que não podem ser quebradas

1. **Nada é apagado.** Não existe `delete` em `casos`. Descarte é registro em `classificacoes_admin`.
2. **Sem lembrete de prazo.** O silêncio é instrumento de medição — caso expirado é dado, não falha do sistema.
3. **Original e confirmado coexistem.** `relato_original` nunca é sobrescrito; `quadrante_sugerido` e `quadrante_escolhido` também não. A divergência é métrica de gestão.
4. **O admin não edita a jornada.** Só classifica.
5. **O relógio é do servidor.** `confirmar_plano()` e `registrar_resultado()` validam prazo e transição no Postgres.

Detalhes em `docs/regras-negocio.md`.

## Estrutura

```
odecisor/
├── src/
│   ├── lib/db.js            cliente Supabase + regras de dados
│   ├── components/ui.jsx    componentes visuais
│   ├── decisor/Jornada.jsx  os 4 passos
│   └── App.jsx              login, roteamento por papel, painel
├── api/ia/analisar.js       serverless: única porta para a IA
├── prompts/index.js         7 serviços de IA versionados
├── supabase/                migração SQL com RLS
└── docs/                    produto · regras-negocio · arquitetura
```

## Próximos ciclos

- **5** — indicadores completos (por cliente, equipe, usuário; pontos de atenção automáticos)
- **6** — aprendizado (reincidência, procedimentos e treinamentos sugeridos)
- **7** — exportação para calendário e CSV
- **Produto** — autocadastro de síndico, cobrança, multi-organização ativa

## Trabalhando com Claude Code

Uma tarefa por vez, sempre sobre a especificação:

```
Leia docs/produto.md e docs/regras-negocio.md.
Não implemente ainda.
[objetivo do ciclo atual]
A jornada é sequencial e o administrador não edita dados do decisor.
Aponte riscos de modelagem antes de propor código.
```
