# Hydrogen + Oxygen — como o portal foi preparado

## O ponto que decide a arquitetura

O Oxygen roda em **runtime de Workers (V8 isolates)**, não em Node. Isso significa que
**o driver do MongoDB não roda lá** — ele abre socket TCP, e Workers só têm `fetch`.
Qualquer tentativa de importar `mongoose` no bundle do Hydrogen falha no deploy.

Por isso o sistema é dividido assim:

```
apps/portal   →  Hydrogen / Oxygen (SSR, edge)     ── fetch HTTP ──▶  apps/api
apps/admin    →  SPA estática (Vite)               ── fetch HTTP ──▶  apps/api
apps/api      →  Node + Apollo Server + Mongoose ──▶ MongoDB
```

`apps/api` é um serviço Node comum e vai para Render / Fly / Railway / EC2 — **não** para o Oxygen.
O portal só fala GraphQL por HTTP, que é o que o runtime de Workers suporta nativamente.

## O que já está no formato Hydrogen

O Hydrogen 2025+ é construído sobre **React Router 7 em framework mode**. O portal já usa
exatamente essa base, então a migração é aditiva, não uma reescrita:

| Peça | Estado atual | Por que já serve ao Oxygen |
| --- | --- | --- |
| `react-router.config.ts` | `hydrogenPreset()` | Preset oficial do Hydrogen para RR7 |
| `app/routes.ts` | rotas declaradas explicitamente | Formato do RR7 |
| `app/entry.server.tsx` | `renderToReadableStream` | Web Streams — o `renderToPipeableStream` do Node **não** roda em Workers |
| `app/lib/graphql.server.ts` | cliente sobre `fetch` | Sem dependência de Node |
| `app/lib/session.server.ts` | `createCookieSessionStorage` | API Web, roda igual nos dois runtimes |
| `app/lib/env.server.ts` | lê de `globalThis.__NTV_ENV` | No Oxygen as vars chegam por request, não em `process.env` |
| `server.ts` | `export default { fetch(request, env, ctx) }` | É a assinatura que o Oxygen invoca |

Nada no bundle de servidor importa `fs`, `path`, `crypto` de Node ou `mongoose`.

## Migração aplicada

O portal **já é** um projeto Hydrogen: `shopify hydrogen build` gera `dist/server/oxygen.json`
e `shopify hydrogen dev` roda o app no mini-oxygen. O que foi feito:

### 1. Dependências (`apps/portal/package.json`)

`@shopify/hydrogen`, `@shopify/mini-oxygen`, `@shopify/cli` — e três alinhamentos de versão
que o Hydrogen 2026.4 exige:

| Pacote | De | Para | Motivo |
| --- | --- | --- | --- |
| `react-router` / `@react-router/*` | `^7.0.2` | `~7.16.0` | peer exato do Hydrogen |
| `react` / `react-dom` | `^18.3.1` | `^19.2.8` | React 18 quebra no pré-bundle do worker |
| `vite` | `^5.4.11` | `^7.3.6` | `mini-oxygen` usa a Environment API (Vite ≥ 6.2) |

**Uma só cópia de Vite no monorepo.** O `mini-oxygen` é hasteado para a raiz e resolve o
`vite` de lá; se a raiz tiver uma versão diferente da do portal, o dev server sobe mas toda
request morre com `TypeError: require_react is not a function` — dois runtimes de Vite no
mesmo processo. Por isso a raiz declara `vite` em `devDependencies` **e** em `overrides`.
Ao mexer em versões de Vite, confira com `npm ls vite --all` que só existe uma.

### 2. Plugins no `vite.config.ts`

```ts
plugins: [hydrogen(), oxygen(), reactRouter(), tsconfigPaths()]
```

A ordem importa: `hydrogen()` e `oxygen()` vêm antes do `reactRouter()`.

O `ssr.optimizeDeps.include: ["react-dom/server"]` não é opcional — sem ele o workerd
falha com `require is not defined`.

### 3. `react-router.config.ts` usa o preset oficial

`hydrogenPreset()` define `appDirectory`, `ssr: true`, `buildDirectory: "dist"` (não mais
`build/`) e as flags `v8_middleware` / `v8_splitRouteModules`. Ele **bloqueia** `basename`,
`prerender`, `serverBundles`, `buildEnd` e `subResourceIntegrity` — o CLI do Hydrogen não
suporta nenhum deles.

### 4. Scripts

```json
"dev": "shopify hydrogen dev --port 3001",
"dev:node": "react-router dev --port 3001",
"build": "shopify hydrogen build",
"deploy": "shopify hydrogen deploy"
```

`dev` roda no runtime de Workers (é o que vale); `dev:node` fica como escape hatch para
depurar algo fora do worker.

### 5. Storefront client

`app/lib/context.ts` monta o contexto por request com `createHydrogenContext`, e
`server.ts` o injeta via `getLoadContext`. Nos loaders, `context.storefront.query(...)`
convive com o `gql()` da API própria.

A sessão da Shopify fica em `app/lib/hydrogen-session.server.ts`, num cookie
`ntv_shopify_session` **separado** do `ntv_session` de `session.server.ts` — aquele guarda o
login do portal, este o estado da Shopify; se compartilhassem cookie, um sobrescreveria o outro.

`entry.server.tsx` importa de `react-dom/server`, não de `react-dom/server.browser`: sob a
condição `workerd` isso resolve para o build edge, sem o scheduler que depende de
`MessageChannel` (API ausente no Oxygen).

### 6. Variáveis de ambiente no Oxygen

Configurar em **Hydrogen → Storefront → Environments** (não em arquivo):

| Variável | Valor |
| --- | --- |
| `PUBLIC_GRAPHQL_URL` | URL pública da `apps/api` (ex.: `https://api.ntvnews.com.br/graphql`) |
| `SESSION_SECRET` | segredo longo e aleatório |
| `PUBLIC_STORE_DOMAIN` | `sua-loja.myshopify.com` |
| `PUBLIC_STOREFRONT_API_TOKEN` | token público da Storefront API |
| `PUBLIC_STOREFRONT_ID` | id do storefront |

O `server.ts` já publica esse objeto via `setEnv(env)`, então todo `*.server.ts` continua lendo do mesmo lugar.
Em dev os valores saem de `apps/portal/.env` (não versionado; veja `.env.example`) e o mini-oxygen
lista no boot quais injetou.

### 7. Linkar a loja

Falta rodar, e exige login interativo no navegador:

```bash
npm run link -w @ntv/portal        # shopify hydrogen link
npx shopify hydrogen env pull      # preenche o .env a partir do storefront
```

Enquanto `PUBLIC_STORE_DOMAIN` estiver vazio, o Hydrogen loga
`storeDomain missing, defaulting to mock.shop` e a Storefront API responde da loja de exemplo.

### 8. Deploy

```bash
npm run deploy -w @ntv/portal      # shopify hydrogen deploy
```

Cada branch vira um preview; `main` vai para produção.

### 9. CORS na API

Acrescentar o domínio do Oxygen em `CORS_ORIGINS` da `apps/api`. Requests de SSR (server-to-server)
não mandam `Origin` e já passam; o CORS só importa para o upload de avatar, que é feito do browser.

## Loja NTV × Shopify checkout

Hoje a Loja NTV é uma **página de collection de afiliados**: cada produto tem `externalUrl` e
o botão "Comprar" abre o marketplace (`rel="noopener sponsored"`). Não há página de produto
nem carrinho — é o que o handoff especifica.

Se um dia a loja passar a vender direto pela Shopify, o caminho é:

1. Manter `apps/api` como fonte dos produtos de afiliado.
2. Ler os produtos próprios via `context.storefront.query(PRODUCT_QUERY)`.
3. Mesclar os dois no loader de `app/routes/loja.tsx` — o componente `ProductCard` já recebe
   `externalUrl`; para produto Shopify ele passaria a apontar para `/produto/:handle` e o
   botão viraria "Adicionar ao carrinho" com o `CartForm` do Hydrogen.

Nada disso muda o admin nem o modelo do Mongo.

## O que **não** migrar para o Oxygen

- `apps/api` — precisa de Node e de conexão TCP com o Mongo.
- O cron de RSS (`npm run rss`) — roda no mesmo serviço da API, como Cron Job.
- Uploads (`/upload`) — hoje gravam em disco. Em produção, trocar por S3/R2/Cloudinary e
  devolver a URL pública; o front já só consome a URL retornada.

---

## Login com conta Shopify (comentários e enquetes)

Hoje o portal autentica com e-mail/senha contra `apps/api` (JWT em cookie `httpOnly`).
Isso é o **simulado de localhost** pedido: os comentários já exigem sessão e o fluxo de
entrar/criar conta funciona ponta a ponta. A troca para a conta da loja é uma substituição
de provedor de identidade, não uma reescrita do recurso.

### Como fica

```
Hoje:      /entrar (form) → apps/api login → JWT → cookie ntv_session
Com loja:  /entrar → OAuth Customer Account API → customerAccessToken
                   → apps/api loginWithShopify(token) → JWT → cookie ntv_session
```

O comentário continua ligado a um `users._id` do Mongo. O que muda é **como esse usuário
nasce**: em vez do formulário de senha, ele é criado/reencontrado a partir do cliente Shopify.

### Passos

1. Ativar **Customer Accounts** (versão nova) no admin da loja e liberar o domínio do
   Hydrogen em *Customer Account API → Application setup*.

2. No portal, trocar a rota `/entrar` pelo fluxo OAuth do Hydrogen:

```ts
// app/routes/entrar.tsx
export async function loader({ context }: LoaderFunctionArgs) {
  return context.customerAccount.login();
}
```

E adicionar as rotas de callback e logout (`/account/authorize`, `/sair`), como no
template do Hydrogen.

3. Criar na API a mutation que troca o token da Shopify por sessão do portal:

```graphql
loginWithShopify(customerAccessToken: String!): AuthPayload!
```

O resolver consulta a Customer Account API (`{ customer { id emailAddress firstName } }`),
e faz upsert em `users` casando por `shopifyCustomerId` — o campo **já existe no model**,
justamente para essa hora. O restante (JWT, cookie, permissões) não muda.

4. O papel do usuário vindo da loja é sempre `reader`. Quem escreve no portal continua
   sendo criado por `npm run admin:create` ou pelo convite no admin — a conta da loja não
   dá acesso ao painel.

### O que **não** muda

- O model `Comment` aponta para `users`, não para o cliente Shopify.
- O filtro de moderação roda na API, independente de quem autenticou.
- O admin (`apps/admin`) segue com login próprio: é equipe, não cliente da loja.
