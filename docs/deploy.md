# Deploy — do admin ao site publicado

O objetivo: você publica no admin e aparece no portal. Este documento é o caminho
inteiro, marcando o que já está pronto no repositório e o que só você pode fazer
(porque envolve conta, cartão ou DNS).

## O mapa

```
admin.ntvascainosnews.com.br    apps/admin    SPA estática        HostGator (ou qualquer host estático)
api.ntvascainosnews.com.br      apps/api      Node + Express      Render / Fly / VPS  ──▶ MongoDB Atlas
ntvascainosnews.com.br          apps/portal   Hydrogen            Oxygen (Shopify)
```

A regra que organiza tudo: **o Oxygen roda em runtime de Workers e não abre socket TCP**,
então o Mongo não pode ser falado de lá. O portal só faz `fetch` HTTPS na API — é assim que
o conteúdo do admin chega no site. Detalhes em [shopify-oxygen.md](shopify-oxygen.md).

> **A HostGator serve o admin, mas não a API.** Os planos Shared/Cloud/WordPress não
> suportam Node.js nem MongoDB — só VPS e dedicado. Por isso a API vai para outro lugar.

## 1. Banco: MongoDB Atlas

1. Crie um cluster (o M0 gratuito atende o começo).
2. Em **Network Access**, libere o IP de saída do host da API — no Render, `0.0.0.0/0`,
   já que o IP não é fixo nos planos menores. A proteção real é a senha da connection string.
3. Copie a connection string (`mongodb+srv://...`) — ela vira `MONGODB_URI`.
4. Popular o banco: `MONGODB_URI="mongodb+srv://..." npm run seed` **apaga tudo e recria com
   dados de demonstração**. Se já houver conteúdo real, não rode. Para criar só o seu acesso:
   `MONGODB_URI="..." npm run admin:create -- "Seu Nome" voce@ntvascainosnews.com.br suasenha`.

## 2. API no Render

O repositório já traz [`render.yaml`](../render.yaml) e [`apps/api/Dockerfile`](../apps/api/Dockerfile).
Em **Render → New → Blueprint**, aponte para este repositório: ele cria o serviço web e os
dois crons já configurados, e pergunta o `MONGODB_URI`.

O que o blueprint define, e por quê:

| Item | Valor | Por quê |
| --- | --- | --- |
| Plano | `starter` | O free hiberna, não tem disco e não permite cron |
| Disco | `/data`, 1 GB | Onde ficam avatares, capas e fotos de produto |
| Health check | `/health` | O Render espera 200 aqui antes de mandar tráfego |
| `JWT_SECRET` | gerado | Assina os logins; trocar derruba as sessões |

### Por que não o plano free

O free existe e serve para validar o circuito, mas cobra em funcionalidade —
nada disso é limitação do código:

1. **Sem disco persistente.** O filesystem é efêmero: toda imagem enviada pelo admin
   desaparece no próximo redeploy, restart ou hibernação, e o post continua apontando
   para uma URL morta.
2. **Sem cron.** O Render não tem cron job gratuito — só web services, Postgres e
   Key Value. A ingestão de RSS não roda sozinha.
3. **Hiberna após 15 min sem tráfego.** A visita seguinte espera ~1 min para acordar,
   e como o SSR do portal depende da API, quem paga essa espera é o visitante.

**O upgrade exige cartão cadastrado antes.** A API do Render recusa a troca de plano
com `Plan requires payment information on file` enquanto não houver forma de pagamento
em Workspace Settings → Billing.

### Rodar os jobs à mão

Independente do plano, dá para disparar da sua máquina apontando para o Atlas:

```bash
MONGODB_URI="mongodb+srv://..." npm run rss -w @ntv/api    # notícias novas
MONGODB_URI="mongodb+srv://..." npm run sync -w @ntv/api   # vídeos, jogos, mercado
```

### Onde fica o banco

O cluster do Atlas está em **AWS us-west-2 (Oregon)**, no mesmo lugar da API, e não
em São Paulo. Parece contraintuitivo para um site brasileiro, mas o visitante não
fala com o banco: ele fala com a borda do Oxygen, que fala com a API, que fala com o
banco. Co-locar API e banco eliminou uma travessia de continente por consulta e
derrubou a home de 1,29s para ~0,4s.

Depois de subir, ajuste `PUBLIC_API_URL` e `CORS_ORIGINS` para os domínios reais
(o blueprint vem com os de exemplo). `PUBLIC_API_URL` entra na URL das imagens enviadas,
então precisa ser o domínio final — se mudar depois, as imagens antigas apontam para o antigo.

Verifique: `curl https://sua-api/health` deve responder `{"ok":true,...}`.

Em outro host (Fly, Railway, VPS), o mesmo Dockerfile serve. Ele lê `$PORT` e expõe `/health`;
monte um volume em `/data`.

## 3. DNS

O `ntvascainosnews.com.br` usa os **nameservers da HostGator** (`dns3`/`dns4.hostgator.com.br`),
então os registros se criam no **cPanel → Zone Editor**, não em outro painel.

| Nome | Tipo | Aponta para |
| --- | --- | --- |
| `api` | CNAME | host do Render (ex.: `ntv-api.onrender.com`) |
| `admin` | — | criado automaticamente ao adicionar o subdomínio no cPanel |
| `@` e `www` | o que a Shopify mandar | Oxygen |

O `admin` não precisa de registro manual: em **cPanel → Domains → Create A New Domain**,
criar `admin.ntvascainosnews.com.br` já cria o DNS e a pasta de arquivos de uma vez.

Um alerta: **o domínio principal não serve os dois**. Se `ntvascainosnews.com.br` for para o
Oxygen, ele deixa de responder pela HostGator — inclusive qualquer site que esteja lá hoje.
Por isso admin e API ficam em subdomínios, e vale deixar o apontamento do domínio raiz por último.

## 4. Admin na HostGator

O admin lê a URL da API **no momento do build** — o valor fica embutido no JS, então
apontar para produção é um rebuild, não uma configuração no servidor:

```bash
VITE_GRAPHQL_URL=https://api.ntvascainosnews.com.br/graphql npm run build -w @ntv/admin
```

Suba **o conteúdo** de `apps/admin/dist/` para a pasta do subdomínio no cPanel
(`public_html/admin/` ou o document root de `admin.ntvascainosnews.com.br`). Inclua o
[`.htaccess`](../apps/admin/public/.htaccess) — o Vite já o copia para o `dist/`. Sem ele,
recarregar uma rota interna dá 404, porque o Apache procura um arquivo que não existe.

Ative o SSL do subdomínio no cPanel. Sem HTTPS o browser bloqueia as chamadas para a API,
que é HTTPS.

## 5. Portal no Oxygen

O storefront **1000169141** já existe (é o `ntvnews-257bb87c3fcb6c7a9f5f.o2.myshopify.dev`),
e o repositório tem a Action que faz o deploy a cada push.

Uma vez, na sua máquina:

```bash
npm run link -w @ntv/portal        # abre o navegador, escolhe loja e storefront
npx shopify hydrogen env pull      # traz os valores para o .env local
```

Em **Hydrogen → Storefront → Environments**, configure:

| Variável | Valor |
| --- | --- |
| `PUBLIC_GRAPHQL_URL` | `https://api.ntvascainosnews.com.br/graphql` |
| `PUBLIC_SITE_URL` | `https://ntvascainosnews.com.br` |
| `SESSION_SECRET` | segredo longo e aleatório |
| `PUBLIC_STORE_DOMAIN` | `sua-loja.myshopify.com` |
| `PUBLIC_STOREFRONT_API_TOKEN` | token público da Storefront API |

Deploy manual: `npm run deploy -w @ntv/portal`. Automático: a Action
[`oxygen-deployment-1000169141.yml`](../.github/workflows/oxygen-deployment-1000169141.yml)
roda a cada push, desde que o secret `OXYGEN_DEPLOYMENT_TOKEN_1000169141` exista em
**Settings → Secrets and variables → Actions** no GitHub.

## 6. Fechar o circuito

Com tudo no ar, o `CORS_ORIGINS` da API precisa listar os domínios de **browser**:

```
https://admin.ntvascainosnews.com.br,https://ntvascainosnews.com.br,https://www.ntvascainosnews.com.br
```

O SSR do portal é server-to-server, não manda `Origin` e passa de qualquer forma; o CORS
importa para o admin e para o upload de imagem, que saem do navegador.

Teste de ponta a ponta: publique um post no admin e recarregue a home do portal. Se aparecer,
o circuito está fechado.

## Cuidados

- **`npm run seed` apaga o banco.** Em produção use `admin:create` e `reset:content`.
- **Uploads dependem do disco.** Sem volume persistente, toda imagem enviada some no deploy
  seguinte — e o post continua apontando para uma URL que não existe mais. Se preferir não
  manter disco, o caminho é trocar o `/upload` por um bucket S3/R2.
- **Trocar `JWT_SECRET` desloga todo mundo**, inclusive você.
- **Trocar `PUBLIC_API_URL` não reescreve as imagens já enviadas** — elas guardam a URL
  absoluta gravada no momento do upload.
