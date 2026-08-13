# Handoff: NTV News — Portal + Admin

## Overview
NTV News é um portal de notícias do Vasco da Gama, liderado por Leo Lacerda (canal Na Torcida Vascaínos). Objetivo: tornar-se o maior portal do Vasco (concorrente de referência: netvasco.com.br). O pacote cobre:
- **Portal público**: home, página do post, inscrição, perfil do usuário, Loja NTV (afiliados)
- **Admin** (estilo WordPress): dashboard, criar/editar notícia, listagem com filtros, usuários e perfis, configurações, cadastro de produtos

**Mobile-first** em todo o produto — as telas mobile são a referência primária; desktop é a expansão.

## About the Design Files
Os arquivos deste pacote são **referências de design criadas em HTML** — protótipos que mostram aparência e comportamento pretendidos, NÃO código de produção. A tarefa é **recriar estes designs no ambiente do projeto**: **React JS + TypeScript**, dados via **GraphQL**, persistência em **MongoDB**, deploy no **Render**. Use os padrões e bibliotecas que o time estabelecer (ex.: Apollo Client/Server, componentes próprios); não copie o HTML diretamente.

## Fidelity
**High-fidelity (hifi)**: cores, tipografia, espaçamento e copy são finais. Recriar pixel-perfect. As imagens são placeholders (blocos cinza "FOTO") — substituir por mídia real.

## Arquivo de referência
`NTV News - Mockups.dc.html` — canvas com todas as telas, identificadas por badges:
- Turn 3: `3a` Loja desktop · `3b` Loja mobile
- Turn 2: `2a/2b` Inscrição · `2c/2d` Perfil · `2e/2f` Página do post
- Turn 1: `1a/1b` Home · `1c/1d` Admin dashboard · `1e/1f` Editor de notícia · `1g` Listagem · `1h` Usuários · `1i` Configurações · `1j/1k` Produtos · `1l` Popup enquete

## Design Tokens
Cores (escala neutra — NUNCA usar vermelho, cor do rival):
- `ink` #101014 (preto principal: headers, botões primários, badges)
- `ink-soft` #2b2b30 (texto de corpo), #3a3a40 (avatares, texto secundário escuro)
- `gray-600` #5a5a62 · `gray-500` #8a887f / #8a8a92 (meta, labels) · `gray-400` #b9b7af
- Superfícies: página #f4f4f2 · cartão #fff · campo #f8f7f4 · cinza-claro #eceae5
- Bordas: #e6e4de (cartões) · #d8d6d0 (inputs) · #efede8 (divisores internos) · #e2e0da (divisores de lista)
- Dark surfaces: #1c1c22 (card sobre preto) · #26262c (ticker, bordas no dark) · texto no dark #c9c9cf / #8a8a92
- Semânticas: sucesso #0e8a3e sobre #e7f5ec · atenção #946200 sobre #fdf3dd · alerta #c9a10a · link externo #2a6fc0

Tipografia: **Archivo** (Google Fonts), pesos 400–900.
- Manchete hero: 800, 34–36px desktop / 24px mobile, line-height 1.1, letter-spacing −0.015em
- Títulos de card: 700, 13–15px · Corpo do post: 400, 16.5px/1.7 · Meta: 500, 10.5–12px
- Labels de seção: 800, 10–13px, letter-spacing .1–.12em, CAIXA ALTA

Espaçamento: base 4px (gaps 8/10/12/14/16; padding de cartão 14–18px; página 16px mobile / 28–32px desktop).
Raios: 0 em quase tudo (estética editorial quadrada). Exceções: avatares/toggles circulares (50% / 11px). Toggle: 40×22px, knob 18px.
Sombras: quase nenhuma; popup usa `0 24px 60px rgba(0,0,0,.45)`.

## Screens / Views

### Portal
**Home (1a mobile 390px, 1b desktop 1240px)**
- Header preto #101014 (64px desktop): logo (SVG branco via invert, 28–32px de altura), nav (Início, NTV Exclusivo, Notícias, Vídeos, Tabela, Loja NTV — ativo: texto branco + border-bottom 3px branco), busca, avatar/inscreva-se.
- Ticker "AGORA" (#26262c) com manchete corrente.
- Hero: destaque 1 grande (2fr) + destaques 2 e 3 empilhados (1fr); overlay `linear-gradient(transparent, rgba(10,10,12,.94))`; badge "NTV EXCLUSIVO" branco com texto preto.
- Seção **LEO LACERDA & EQUIPE** (barra de 4–5px preta + título 800): 3 cards com selo — sempre acima das demais notícias.
- **ÚLTIMAS NOTÍCIAS**: 12 itens (thumb 100×62 + título 14.5px + meta com crédito "via <fonte> · RSS") + botão outline "Ver mais notícias" (paginação/infinite scroll).
- Sidebar desktop (340px), nesta ordem: Estatísticas do clube (posição, pts, grid J/V/E/D, barra de aproveitamento) · Últimos 5 jogos (círculos V=preto, E=#b9b7af, D=contorno; placar abaixo) · Próximos 5 jogos (data · adversário · CASA/FORA · competição) · Mercado da Bola (fundo preto; por jogador: barra branca proporcional ao % "Bom reforço" + legenda; botão branco "Votar na enquete") · No YouTube · Loja NTV.
- Rodapé preto: logo, botões sociais outline (Twitter/X, YouTube, Instagram), linha © + "Desenvolvido por" + logo Bunch (`assets/bunch.png`, verde). **Sem menção a tecnologia.**

**Página do post (2e desktop, 2f mobile)**
- Breadcrumb, badge de categoria, H1 36px, subtítulo 16px #5a5a62.
- Linha do autor: avatar 40px, nome + selo "EQUIPE", data de publicação/atualização, botões Compartilhar/Copiar link.
- Foto principal (400px desktop / 220px mobile) + crédito.
- Conteúdo (max-width 720px): parágrafos 16.5px/1.7, H2 22px, citação com barra esquerda 4px preta.
- Tags outline, box do autor (fundo preto, bio, botão Seguir).
- Sidebar: **ÚLTIMAS POSTAGENS (6 itens, thumb 64×44) em primeiro**, depois os mesmos widgets da home.

**Inscrição (2a mobile, 2b desktop split-screen)**
- Upload de foto de perfil: círculo 88px tracejado + botão câmera sobreposto; "JPG ou PNG, até 2 MB".
- Campos: nome, e-mail, senha (mostrar/ocultar); opt-in newsletter; CTA preto "Criar conta"; link "Entrar".

**Perfil do usuário (2c mobile, 2d desktop)**
- Hero/cartão com avatar 96–110px + botão de troca de foto (upload).
- Dados da conta (nome, e-mail, alterar senha), Preferências (3 toggles), Minhas enquetes (voto registrado por jogador). CTA "Salvar alterações".

**Loja NTV (3a desktop, 3b mobile)**
- Página de collection: NÃO há página de produto — o botão "Comprar ↗" abre o link externo do marketplace em nova aba (`rel="noopener sponsored"`).
- Desktop: filtros laterais 240px (Categoria com contagens, Preço range 2 knobs, Marketplace) + "Limpar filtros"; toolbar com contagem e "Ordenar"; grid 4 colunas; card = foto 170px, título, preço 800 15px, marketplace, botão preto; estados DESTAQUE e ESGOTADO (opacity .6, botão "Indisponível"); "Carregar mais produtos".
- Mobile: chips de filtro horizontais + botão "☰ Filtrar" (abre drawer); grid 2 colunas.

### Admin (sidebar preta 220px desktop; bottom-tab mobile)
Navegação: Dashboard, Notícias, Nova notícia, Produtos, Usuários, Configurações. Item ativo: fundo branco, texto preto. Rodapé da sidebar: usuário logado + papel. Mobile: bottom bar de 5 itens com FAB central branco "+".

**Dashboard (1c/1d)**: 4 stat-cards (visitas, posts hoje com split equipe/RSS, importadas do RSS, cliques na Loja); gestor de **Destaques da Home** — lista ordenável por arraste, posições 1–3 (badge numérico) + slot vazio tracejado; painel Fontes RSS com status (verde ok / âmbar erro + timestamp).

**Criar/editar notícia (1e/1f)**: título como textarea grande sem borda; editor rich-text (B, I, U, H2, citação, imagem, link, embed); tags. Painel lateral:
- Publicação: status (RASCUNHO/PUBLICADO/AGENDADO), categoria, autor (selo EQUIPE); botões Salvar/Publicar.
- **Destaque**: toggle on/off + seletor de posição 1/2/3; aviso de que o ocupante atual da posição volta à lista comum.
- **Duplicar em outras redes**: toggles por conta conectada (Instagram, X) — ao publicar, dispara postagem com card + link.
- Imagem de capa (dropzone).

**Listagem (1g)**: busca + filtros (Status, Categoria, Origem original/RSS, Autor, Período); tabela com checkbox, título (badges DESTAQUE n), autor/origem (badge RSS), categoria, status (PUBLICADO verde / RASCUNHO âmbar / AGENDADO cinza), data, ações; paginação.

**Usuários (1h)**: lista (avatar, nome, e-mail, badge ADMIN/EDITOR, último acesso, ações), convite pendente (opacidade reduzida + "reenviar"); painel de permissões por papel:
- ADMIN: tudo (posts, destaques, usuários, produtos, configurações, RSS/redes).
- EDITOR: criar/editar/publicar posts e destaques; sem usuários/configurações; não exclui posts de terceiros.

**Configurações (1i)**: abas Geral / Fontes RSS / Redes sociais / SEO. Geral: nome do site, logo (upload), URL, modo manutenção. Fontes RSS: lista com toggle por fonte, política "publica direto · crédito automático", estado de erro. Contas conectadas: Instagram e X com status CONECTADO.

**Produtos (1j/1k)**: grid de cards (foto 70px, título, preço, link truncado azul, badge VISÍVEL/OCULTO) + formulário (foto 800×800, título, preço, link do marketplace, toggle "Visível na Loja NTV"). Campos são exatamente: foto, título, preço, link.

**Enquete popup (1l)**: modal 350px sobre backdrop `rgba(16,16,20,.6)`; header preto "MERCADO DA BOLA · ENQUETE" + ✕; foto/nome/posição do jogador; pergunta 16px 700; botões "Bom reforço" (preto) e "Péssimo negócio" (outline); "resultado aparece após votar". Disparado pelo CTA "Votar na enquete".

## Interactions & Behavior
- Destaques: exclusividade por posição (definir pos. 1 remove o ocupante anterior). Reordenação por drag-and-drop no dashboard.
- RSS: itens entram **publicados automaticamente** com crédito da fonte ("via ge.globo · RSS"); toggle por fonte no admin; expor estado de erro de leitura.
- Duplicação em redes: executa no evento de publicação; por post e por rede.
- Enquete: 1 voto por usuário autenticado; resultado (%) só após votar; barras no widget refletem agregado.
- Upload de avatar: crop circular, JPG/PNG ≤ 2 MB, preview imediato.
- Loja: filtros combináveis (categoria + preço + marketplace), ordenar, carregar mais; clique em Comprar → link externo.
- Hovers: botões pretos → #2b2b30; outline → fundo #f0eee9; linhas de tabela → #f8f7f4. Links: #101014, hover #5a5a62.
- Estados de lista: PUBLICADO/RASCUNHO/AGENDADO; produto VISÍVEL/OCULTO/ESGOTADO.

## State Management & Data (GraphQL / MongoDB)
Coleções sugeridas:
- `posts`: title, slug, subtitle, coverImage, body (rich text/blocos), category, tags[], author→users, source {type: 'team'|'rss', name, url}, status, publishedAt, featured {active, position 1–3}, crosspost {instagram, x}, stats
- `users`: name, email, passwordHash, avatarUrl, role 'admin'|'editor'|'reader', preferences {newsletter, matchAlerts, shopNews}, pollVotes[]
- `products`: title, price, imageUrl, externalUrl, marketplace, visible, soldOut
- `polls`: player {name, position, club, photo}, question, votes {good, bad}, status
- `rssSources`: name, url, enabled, lastFetchAt, lastError
- `settings`: singleton (siteName, logoUrl, url, maintenance, socialAccounts)
Queries principais: `home` (featured 1–3, teamPosts, latest paginado, clubStats, lastMatches, nextMatches, activePolls), `post(slug)`, `products(filter)`, admin CRUD + `reorderFeatured`, `votePoll(pollId, choice)`. Placar/estatísticas podem vir de API externa cacheada no Mongo.
Deploy: Render (web service para o app/SSR + serviço GraphQL; cron job para ingestão RSS).

## Assets
- `assets/logo.svg` — logotipo NTV News (paths pretos; nos fundos escuros renderizar em branco)
- `assets/bunch.png` — logo Bunch (verde), rodapé "Desenvolvido por"
- Fonte: Archivo via Google Fonts
- Fotos de notícias/produtos: placeholders — solicitar mídia real

## Files
- `NTV News - Mockups.dc.html` — todas as telas (abrir no navegador)
- `assets/logo.svg`, `assets/bunch.png`
