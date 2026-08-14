# NTV News — desenvolvimento local

Monorepo com três aplicações e um pacote compartilhado.

```
apps/api       Node + Apollo Server 5 + Mongoose  →  MongoDB       :4010
apps/admin     React + TS + Vite + Apollo Client (SPA)             :5174
apps/portal    React Router 7 (framework mode) — pronto p/ Oxygen  :3001
packages/shared  design tokens, tipos de domínio, formatadores
```

Por que a API é separada do portal: o **Oxygen roda em runtime de Workers e não abre socket TCP**,
então o driver do MongoDB não funciona lá. O portal (Hydrogen) fala com a API por HTTP.
Detalhes e o passo a passo da migração em [docs/shopify-oxygen.md](docs/shopify-oxygen.md).

## Requisitos

- Node 20+
- Docker (para o MongoDB)

## Subir tudo

```bash
cp .env.example .env      # já vem com as portas locais
npm install
npm run db:up             # MongoDB em localhost:27021
npm run seed              # dados de demonstração
npm run dev               # api + admin + portal em paralelo
```

| App | URL |
| --- | --- |
| Portal | http://localhost:3001 |
| Admin | http://localhost:5174 |
| GraphQL | http://localhost:4010/graphql |

> As portas fogem do padrão (27021/4010/5174/3001) porque o stack antigo em
> `../NTV-NEWS` já ocupa 27017 e 4000 nesta máquina. Para mudar, edite o `.env`
> e os `--port` nos `package.json` dos apps.

## Contas do seed

| Papel | E-mail | Senha |
| --- | --- | --- |
| Admin | leo@ntvnews.com.br | ntv123456 |
| Editor | marina@ntvnews.com.br | ntv123456 |
| Leitor | torcedor@exemplo.com | ntv123456 |

O admin recusa login de `reader` — é o comportamento esperado.

**Trocar a própria senha:** no admin, clique no seu nome no rodapé da barra lateral →
**Minha conta**. A página fica **fora de Configurações** de propósito: aquela exige
`settings:manage`, e trocar a própria senha é direito de qualquer pessoa logada — a
mutation `changePassword` age sobre `ctx.user`, nunca sobre outra conta.

A senha do seed é pública neste documento; **troque a do admin antes de publicar**.

Alterar a senha não derruba a sessão em curso: o JWT que já está no navegador vale até
expirar. Para cortar todas as sessões de uma vez, o caminho é trocar o `JWT_SECRET`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe api + admin + portal |
| `npm run seed` | recria as coleções com dados de demo (**apaga o banco**) |
| `npm run reset:content` | apaga o conteúdo de demo, **preserva usuários e configurações** |
| `npm run reset:content -- --rss` | idem, apagando também as fontes RSS |
| `npm run reset:content -- --users` | idem, apagando também os usuários não-admin |
| `npm run admin:create -- "Nome" email@dominio.com senha` | cria (ou promove) um admin real |
| `npm run rss:renormalize` | reaplica a formatação de corpo nos posts de RSS já importados |
| `npm run mod:check` | roda os casos de referência do filtro de comentários |
| `npm run rss:dedupe` | agrupa notícias duplicadas já importadas (use `-- --apply`) |
| `npm run dedupe:check` | casos de referência do agrupamento de duplicatas |
| `npm run rss` | roda a ingestão RSS uma vez (em produção: cron a cada 10–15 min) |
| `npm run sync` | sincroniza vídeos do YouTube e jogos (em produção: cron horário) |
| `npm run build` | build de produção dos três apps |
| `npm run typecheck` | typecheck de todos os workspaces |
| `npm run db:down` | derruba o MongoDB |

## Modelo de dados

Coleções conforme o handoff: `posts`, `users`, `products`, `polls`, `rssSources`,
`settings` (singleton), mais `matches`/`clubstats` (tabela e jogos) e `events`
(visitas e cliques da Loja, que alimentam os stat-cards do dashboard).

## Regras de negócio já implementadas

- **Destaques 1–3 com exclusividade por posição** — `setFeatured` / `reorderFeatured` liberam
  automaticamente o ocupante anterior. Reordenação por arraste no dashboard.
- **RSS** — itens entram publicados, com crédito "via ge.globo · RSS" no campo `credit`;
  dedupe por `guid`; erro de leitura fica em `lastError` e aparece em âmbar no admin.
- **Enquete** — 1 voto por usuário autenticado (`users.pollVotes`); o popup só revela o
  resultado depois do voto, enquanto o widget da home mostra o agregado.
- **Permissões** — `admin` faz tudo; `editor` escreve posts, destaques e produtos, mas não
  acessa usuários/configurações e não exclui post de terceiro. A matriz vive em
  `packages/shared/src/types.ts` e é usada tanto na API quanto na navegação do admin.
- **Loja** — filtros combináveis (categoria + preço + marketplace), ordenação, carregar mais,
  e "Comprar ↗" que registra o clique e abre o marketplace com `rel="noopener sponsored"`.

## Entrando com dados reais

```bash
npm run admin:create -- "Seu Nome" voce@ntvnews.com.br suaSenhaForte
npm run reset:content -- --users     # remove conteúdo de demo e os usuários fake
```

O `reset:content` **nunca** apaga admins nem as configurações do site — apagá-los tiraria
seu acesso ao painel. Crie o seu admin real **antes** de rodar com `--users`.

## Fontes RSS

Feed confirmado e em uso:

| Fonte | URL |
| --- | --- |
| ge.globo — Vasco | `https://pox.globo.com/rss/ge/futebol/times/vasco` |

Este feed traz `media:content` em todos os itens, então a imagem de destaque vem junto.
Novas fontes entram em **Admin → Configurações → Fontes RSS**. Feed inválido não trava o
cron: o erro fica em `lastError` e aparece em âmbar no dashboard.

> As URLs de `Lance!` e `UOL` que estavam no seed inicial foram removidas — nenhuma
> respondia RSS válido (410 / 400).

### Notícias duplicadas

O dedupe por `guid` só pega o mesmo item do **mesmo** feed. Quando duas fontes publicam a
mesma matéria, os guids diferem e o título varia um pouco. Por isso cada post guarda uma
**impressão digital do título** (`dedupeKey`): o conjunto de palavras significativas,
ordenado — sobrevive a mudança de ordem, acento, pontuação e palavras de ligação.

Na ingestão, se já existe uma notícia **ativa** com a mesma digital publicada dentro de
**7 dias**, a nova entra com `duplicateOf` apontando para ela. A duplicata:

- **não aparece** no portal (home, listagens, busca, relacionadas, categorias);
- **continua no banco**, visível no admin com o selo "Duplicada" — nada é apagado;
- aponta sempre para a original (a publicada primeiro, que deu a notícia).

A janela de 7 dias existe para pauta recorrente não virar duplicata: "Vasco x Fluminense:
onde assistir" volta a cada confronto e é notícia nova a cada vez.

No admin, o seletor de duplicatas na listagem alterna entre **sem duplicatas** (padrão),
**só duplicatas** e **incluir duplicatas**.

| Comando | O que faz |
| --- | --- |
| `npm run rss:dedupe` | varre o que já foi importado e mostra o que agruparia (não grava) |
| `npm run rss:dedupe -- --apply` | grava o agrupamento |
| `npm run dedupe:check` | casos de referência do algoritmo (deve dar 6/6) |

> Testado com uma fonte replicando manchete do ge.globo: a cópia entrou suprimida e a
> original seguiu ativa. Rodando as duas fontes reais hoje cadastradas (ge.globo e
> SuperVasco), nenhum par passou de 0,40 de similaridade — a SuperVasco escreve manchetes
> próprias, então na prática não há sobreposição entre elas.

`apps/api/src/jobs/ingest.ts` procura a capa nesta ordem, parando no primeiro acerto:

1. `<enclosure>` — só quando o `type` é imagem ou a extensão bate;
2. `media:content` / `media:thumbnail`, inclusive dentro de `media:group` — entre vários,
   fica com o de maior `width` declarada e ignora os de `medium="video"`;
3. `itunes:image` e `<image>`;
4. primeiro `<img>` do corpo do item;
5. **fallback**: lê o `og:image` (ou `twitter:image`) da página original da matéria.

URLs relativas são resolvidas contra o link do item, e `data:` URIs são descartadas.
O crédito da foto é preenchido como "Foto: <nome da fonte>".

### Formatação do corpo (`normalizeBody`)

O `description` do ge.globo vem como `<img>` em CDATA seguido de **texto puro** com `\n` —
sem tratamento, o post vira um parágrafo único gigante com a capa repetida. A normalização:

1. **remove do corpo a imagem que já é a capa** (compara ignorando querystring e protocolo),
   para ela não aparecer duas vezes no post;
2. quebra o texto corrido em `<p>` por linha, tratando `<br>` como quebra;
3. descarta a primeira linha quando ela só repete o título;
4. se o feed já mandar HTML estruturado (`<p>`, `<h2>`…), preserva como está.

O `subtitle` vem do `atom:subtitle` do feed e alimenta a linha fina do post.

Mexeu na função? Rode `npm run rss:renormalize` para reprocessar o que já está no banco,
sem precisar reimportar.

> Uma ressalva: o ge.globo coloca a legenda do vídeo do topo como primeira linha do texto,
> e ela não é o título — então entra como primeiro parágrafo. Créditos de foto no meio da
> matéria ("Alexandre Durão / ge") também chegam como parágrafos soltos. Separá-los exigiria
> heurística frágil, que erraria em matéria de texto legítimo.

## Ações em massa nas notícias

Na listagem do admin: checkbox no cabeçalho seleciona a página inteira, e o botão
**"Selecionar todas as N"** varre todas as páginas do filtro atual. Com itens selecionados
aparece a barra preta de ações — trocar status, trocar categoria ou excluir em lote.
Editor só exclui o que é dele; o retorno informa quantos foram mantidos por isso.

## Comentários

Cada post tem área de comentários no fim da matéria. **Exige login** — sem sessão, aparece
o CTA "Entre na sua conta para comentar" apontando para `/entrar` e `/inscricao`.

Em localhost a identidade é a própria conta do portal (e-mail/senha). Quando a loja Shopify
entrar, o provedor de identidade vira o Customer Account API e o comentário continua ligado
ao mesmo `users._id` — o campo `shopifyCustomerId` já existe no model para o casamento.
Passo a passo em [docs/shopify-oxygen.md](docs/shopify-oxygen.md#login-com-conta-shopify-comentários-e-enquetes).

Regras aplicadas no servidor (`addComment`):

- **palavrão** e **política brasileira** são barrados;
- 2 a 1500 caracteres;
- um comentário a cada 20 s por usuário (anti-flood);
- comentário barrado é gravado com status `rejected`: **o autor vê o próprio**, marcado como
  "Não publicado"; o público não vê. Nada é apagado silenciosamente;
- autor remove o próprio comentário; admin e editor removem qualquer um — remover a raiz
  leva junto as respostas dela.

### Respostas

Cada comentário tem "Responder". A árvore é **achatada em um nível**: responder a uma
resposta prende no mesmo comentário-raiz, e nesse caso fica gravado o "respondendo a Fulano"
para o contexto não se perder ao recarregar. Threads profundas viram sanfona ilegível no
mobile, que é a referência do projeto.

O contador do cabeçalho soma raízes **e** respostas; a paginação conta só as raízes, com as
respostas vindo junto de cada uma (uma consulta só para a página inteira, sem N+1).

### O filtro (`packages/shared/src/moderation.ts`)

Fica no pacote compartilhado para a API validar (autoridade) e o portal avisar enquanto a
pessoa digita. A normalização derruba acento, leet (`0TARI0`), letra repetida (`caraaalho`) e
pontuação no meio da palavra (`c.a.r.a.l.h.o`).

Na lista de política entram **entidades e termos inequívocos** — partidos, instituições, pautas.
Ficaram deliberadamente de fora "direita", "esquerda", "presidente" e "eleição": num portal de
futebol elas aparecem em contexto legítimo o tempo todo ("lateral-direita", "pé esquerdo",
"presidente do clube", "eleição no Vasco"), e bloqueá-las causaria mais falso positivo do que
proteção. `npm run mod:check` guarda esses casos de referência.

> O filtro é por lista de termos, não por IA: pega o óbvio e a evasão simples, mas não entende
> ironia nem gíria nova. Para moderação mais fina, o caminho é uma fila de revisão no admin —
> os comentários rejeitados já ficam gravados com categoria e termo, prontos para isso.

## Compartilhamento

Facebook, Instagram e WhatsApp na linha do autor.

**Facebook e WhatsApp** usam o endpoint de share de cada plataforma. O card do Facebook é
montado a partir das meta tags Open Graph, que a página do post emite completas:
`og:url`, `og:title`, `og:description`, `og:image` (+ `width`/`height`), `og:site_name`,
`og:type`, `article:published_time` e `twitter:card`, mais o `<link rel="canonical">`.

> **Em localhost o preview do Facebook fica vazio** — o rastreador da Meta precisa alcançar a
> URL pela internet e não enxerga `localhost:3001`. Não é bug: assim que o portal estiver no ar,
> valide em [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/).
> Defina `PUBLIC_SITE_URL` no `.env` com o domínio público para o `og:url` sair correto.

**Instagram** não tem endpoint para publicar link de terceiro — é limitação da plataforma.
O botão entrega os dois caminhos que existem de fato:

1. **No celular**, abre a folha nativa (`navigator.share`), que lista o Instagram entre os
   destinos — compartilhamento de um toque.
2. **No desktop**, abre um modal que gera um **card 1080×1920 pronto para story** (foto da
   matéria, chapéu da categoria, manchete e a marca), com botão de baixar e o link copiado
   para colar no sticker.

O card é desenhado em canvas. Como o CDN do ge.globo não manda `access-control-allow-origin`,
a foto passa por `GET /image-proxy?url=` da API — um proxy restrito: só http(s), só resposta
de imagem, teto de 8 MB, timeout de 10 s e bloqueio de IP privado/loopback (SSRF).

## Páginas do portal

| Rota | O que faz |
| --- | --- |
| `/` | home com destaques, equipe, últimas e sidebar |
| `/noticias` | todas as notícias, **25 por página**, com paginador numerado |
| `/ntv-exclusivo` | só a categoria "NTV Exclusivo" (apuração própria) |
| `/tabela` | classificação por competição, em abas |
| `/mercado` | todas as especulações da janela, com votação e ordenação |
| `/busca?q=` | busca das notícias |
| `/loja` | Loja NTV (afiliados) |
| `/anuncie` | página comercial |
| `/noticia/:slug` | matéria, com compartilhamento e comentários |

"Vídeos" no menu **não é rota**: é link externo para o canal do YouTube configurado
em Configurações → Redes sociais.

## Busca

`searchPosts` usa o índice de texto do Mongo em **português** (stemming e stopwords), com
peso por campo — título 10, subtítulo 5, resumo/tags 4, corpo 1 — e ordena por relevância.
Quando o termo não casa com nada no índice (nome próprio, palavra muito curta), cai
automaticamente para busca por trecho em título/subtítulo/resumo/tags, e a página avisa que
o resultado é aproximado.

## Especulações e contratações

Dois blocos na sidebar, alimentados pelo Transfermarkt (`npm run sync`):

- **Mercado da Bola · Especulações** — as 5 últimas especulações viram enquetes com botões
  **Aprovo / Reprovo** na própria linha e o percentual agregado sempre visível. O botão do
  rodapé do bloco leva para `/mercado`.

### Voto sem login

A enquete **não exige cadastro** — a ideia é medir o clique da torcida. A dedupe funciona em
dois níveis:

| Quem vota | Identidade | Onde fica |
| --- | --- | --- |
| Logado | a conta | `users.pollVotes` |
| Visitante | id anônimo em cookie de 1 ano (`ntv_voter`) | coleção `pollvotes`, índice único `(poll, voter)` |

Sem cookie ainda, a API cai em IP + user-agent. O portal só cria o id **na hora de votar** —
se as leituras também criassem, cada request sem cookie geraria um id novo e o voto acabaria
gravado com id diferente do que o navegador guardou, liberando voto repetido. Foi exatamente
esse bug no primeiro corte.

> Isto segura o clique repetido do mesmo navegador, mas **não é à prova de fraude**: limpar o
> cookie ou abrir uma janela anônima permite votar de novo. É a troca consciente por não pedir
> cadastro. Se um dia a votação precisar valer como número oficial, o caminho é exigir login
> de novo — a estrutura para isso continua no lugar.
- **Últimas contratações** — os 5 reforços confirmados da temporada.

> A página de transferências **não expõe a data** de cada negócio, então a ordenação usa a
> ordem da própria fonte, que lista os reforços relevantes primeiro. O clube de origem também
> não sai do HTML atual — nome, posição e valor saem; o clube fica vazio.

### Página `/mercado`

A janela inteira, não só as 5 da sidebar — hoje 25 nomes. Cada card traz foto, posição,
clube, valor especulado, a probabilidade estimada pela fonte (quando existe), a barra de
aprovação da torcida e os botões de voto. Tem ordenação por **ordem do mercado**, **mais
aprovados**, **mais votados** e **maior valor**, um resumo no topo (nomes na janela, votos,
confirmados, quantos você já votou) e a lista de contratações já fechadas no fim.

O sync guarda até 40 boatos — a sidebar mostra 5, a página mostra todos.

> A % da barra é **o que a torcida acha**, não a chance de o negócio sair. A probabilidade da
> fonte, quando disponível, aparece separada no canto do card, para os dois números não se
> confundirem.

## Tabela e chaveamento (`/tabela`)

A página tem uma aba por competição do Vasco na temporada. A aba fica na **URL**
(`/tabela?competicao=copa-do-brasil`), então o SSR já entrega a competição certa e o link é
compartilhável.

**Liga** → tabela de classificação. Uma requisição por competição que tenha
`/tabelle/wettbewerb/<CODE>`: hoje rende o Brasileirão completo, 20 times, Vasco destacado.

**Copa** → chaveamento com **todos os confrontos**, de `/gesamtspielplan/pokalwettbewerb/<CODE>`:

| Competição | Fases | Confrontos |
| --- | --- | --- |
| Copa do Brasil | 10 | 150 |
| Copa Sul-Americana | 5 | 48 |
| Campeonato Carioca | 4 | 9 |

Cada fase vira um bloco com os confrontos em duas colunas; os jogos do Vasco saem destacados.
O quadro do meio mostra o placar quando o jogo aconteceu e a data quando ainda não.
As fases aparecem da mais recente para a mais antiga — quem abre a página quer a fase atual.

Duas armadilhas do parser dessa página, porque custaram a achar:

- a página da Sul-Americana **mistura** as tabelas da fase de grupos com os confrontos do
  mata-mata; o que separa é a quantidade de clubes na linha (confronto tem dois);
- a coluna de **hora** ("19:30") casa com o mesmo formato de um placar — o placar só é
  procurado a partir da terceira célula.

No mobile as colunas V/E/D/GP/GC da classificação são ocultadas e sobram #, time, P, J e SG;
os confrontos passam a uma coluna.

### Cliente do Transfermarkt

Os três jobs leem várias páginas na mesma execução (calendário, tabela por competição, boatos,
transferências e o chaveamento de cada copa). Disparar tudo em sequência apertada fazia o site
estrangular a conexão e cair em timeout — foi o que aconteceu ao ligar o chaveamento.

`apps/api/src/lib/transfermarkt.ts` centraliza isso: **1,2 s de intervalo mínimo** entre
requisições, timeout de 30 s, uma tentativa extra em falha, e os utilitários de parsing que
antes estavam duplicados em três arquivos.

## Mobile

O projeto é mobile-first e a passada de otimização cobre o site todo:

- alvos de toque com no mínimo 44px em botões, chips, paginação e votação;
- campos com fonte 16px, que impede o zoom automático do iOS ao focar;
- header compacto com busca em ícone que abre uma gaveta;
- navegação por seções com rolagem por encaixe (scroll snap);
- cards da equipe em carrossel horizontal em vez de três blocos altos empilhados;
- foto de capa e imagens do corpo sangram até a borda, ganhando área útil;
- modais viram folha inferior (bottom sheet) respeitando `safe-area-inset`;
- tabelas e listas de filtro rolam dentro do próprio container — o body nunca rola na horizontal;
- `prefers-reduced-motion` desliga as animações.

## Redes sociais no rodapé

O rodapé mostra **ícones** (Instagram, YouTube, X, Facebook, TikTok). As URLs são editáveis em
**Admin → Configurações → Redes sociais → Links do rodapé**; rede sem URL simplesmente não
aparece. Facebook e TikTok vêm vazios por padrão.

## Widget "No YouTube"

O último vídeo do canal (com thumb) mais os anteriores em lista. Alimentado pelo **feed público**
do YouTube, sem API key:

```
https://www.youtube.com/feeds/videos.xml?channel_id=UC…
```

O admin cadastra a URL com `@handle`; a primeira sincronização lê a página do canal, extrai o
`channelId` e guarda em `settings.youtube.channelId`. Rode com `npm run sync` (cron de hora em
hora em produção) ou pelo botão **Sincronizar vídeos** no admin.

> **Como resolver o handle.** O HTML da página do canal tem vários `"channelId"`, e o primeiro
> costuma ser de um **vídeo recomendado** — usá-lo traz o canal errado. O id do canal em si está
> no `<link rel="canonical">`, no `<meta itemprop="identifier">` e em `"externalId"`, nessa ordem
> de preferência. `@natorcidavascaino` → `UCtq7-pva03GoIMsHJdoSS5A` ("NA TORCIDA VASCAÍNOS").

## Jogos e classificação

A sidebar mostra os **5 últimos resultados** e os **5 próximos jogos**, com link de compra de
ingresso quando cadastrado.

**Fonte padrão: Transfermarkt** (`apps/api/src/jobs/transfermarkt.ts`). A página de calendário do
clube traz a **temporada inteira** — passados com placar e futuros com `-:-` — agrupada por
competição. Uma sincronização trouxe 62 jogos (Brasileirão, Copa do Brasil, Sul-Americana e
Carioca). A URL é editável em **Admin → Jogos → Origem dos jogos**.

Detalhes do parser, porque são fáceis de errar:

- o placar da tabela é **mandante:visitante**, então o lado do Vasco depende da coluna C/F
  (casa/fora) — as classes `greentext`/`redtext` da linha servem de conferência;
- o adversário vem da âncora `/<slug>/startseite/verein/<id>`; o atributo `title` traz o nome
  completo ("Mirassol FC") e o texto da âncora vem abreviado ("Mirassol");
- horários são de Brasília (`-03:00`);
- a competição é o `<h2>` de cada bloco.

> Não existe API pública: isto é leitura de HTML e **quebra se o Transfermarkt mudar o layout**.
> Quando isso acontece, o erro fica em `settings.matches.lastError`, aparece no admin, e os jogos
> já gravados continuam no ar. Use com parcimônia — uma requisição por sincronização, sem
> paralelizar. Vale checar os termos de uso do site antes de ir para produção.

**Classificação** ainda depende de `FOOTBALL_DATA_TOKEN` (token gratuito em
[football-data.org](https://www.football-data.org/client/register)). Esse adaptador **não foi
testado contra a API real** — o token é pessoal. Sem ele, o widget de estatísticas fica vazio.

**Admin → Jogos** permite cadastro e edição manual a qualquer momento. O link de ingresso
(`ticketUrl`) é preenchido lá e **nunca é sobrescrito** pela sincronização.

## Sidebar configurável

**Configurações → Sidebar** controla a ordem e a visibilidade dos widgets, e quantas
campanhas o espaço de publicidade exibe. Vale para a home e para a página da matéria —
uma configuração só. Em "Últimas postagens" não se mexe: existe apenas na matéria e o
README a fixa no topo.

Reordenar funciona por arraste **e** por setas. As setas não são redundância: o painel é
mobile-first, e arraste não funciona no toque sem biblioteca de gestos.

O catálogo de widgets vive em [`packages/shared/src/sidebar.ts`](packages/shared/src/sidebar.ts),
não no banco. O que se grava é só a ordem e o `visible` de cada chave; a leitura passa por
`resolveSidebarWidgets`, que:

- descarta chave desconhecida — widget removido do código não volta como item fantasma;
- **acrescenta ao fim, visível, a chave conhecida que não está salva** — é isso que faz um
  widget novo aparecer sozinho. Sem essa metade, toda peça nova nasceria invisível para
  quem já tem configuração gravada, e o bug seria silencioso.

Por isso a resolução acontece na **leitura**, não na gravação: acrescentar um widget no
código não pede migração de banco.

`npm run seo:check` cobre esses casos junto com os de SEO.

### Campanhas simultâneas

O modelo de anúncio sempre suportou várias campanhas ativas (`active`, `weight` para a
ordem, `startsAt`/`endsAt` para o período). O que limitava era um `.limit(2)` fixo na
consulta da sidebar — agora o número vem de **Configurações → Sidebar**, com teto de 10.
`0` esconde o espaço inteiro sem precisar pausar campanha por campanha.

A impressão é contada **depois** do corte: peça que não foi entregue não computa.

## Anunciantes

Model `Ad` com quatro posições: `sidebar`, `in_article`, `footer` e `shop`. As peças são
servidas pelo próprio portal — sem rede de terceiros, sem script externo, sem rastreador de
outra empresa nas páginas.

- **Admin → Anunciantes**: cadastro com peça, link, posição, período de veiculação, peso e
  status, mais o relatório de impressões, cliques e CTR.
- **Portal**: `/anuncie` é a página pública com formatos, especificações e contato comercial.
- Impressão é contada quando o anúncio sai na resposta do SSR; o clique passa por
  `/api/clique-anuncio` antes de sair para o anunciante.
- Anúncio só aparece se estiver ativo **e** dentro da janela `startsAt`/`endsAt`.

## SEO

O concorrente de referência (netvasco.com.br) hoje publica **1 tag Open Graph, zero JSON-LD,
sem canonical, sem sitemap de notícias e sem feed**. A lacuna técnica é o que dá para atacar
com código — o resto (frequência, apuração própria, backlinks) é trabalho de redação.

### O que o portal emite

| Recurso | Onde |
| --- | --- |
| `robots.txt` com os dois sitemaps | `/robots.txt` |
| Sitemap geral, com tag de imagem por matéria e os arquivos | `/sitemap-index.xml` |
| **Arquivo de categoria** (paginado) | `/categoria/:slug` |
| **Arquivo de tag** (paginado) | `/tag/:slug` |
| **Sitemap do Google News** (últimas 48 h, com keywords) | `/sitemap-news.xml` |
| Feed RSS | `/feed.xml` |
| `NewsMediaOrganization` + `WebSite` com SearchAction | todas as páginas |
| `NewsArticle` + `BreadcrumbList` | página do post |
| `ItemList` | listagens |
| Canonical, Open Graph (6 tags), Twitter Card (3) | todas as páginas |
| `robots` por página, um só | todas as páginas |
| `geo.placename` / `geo.region` / `geo.position` / `ICBM` | página do post |

O `SearchAction` habilita a caixa de busca do site dentro do resultado do Google. `/busca`
sai como `noindex, follow` — página de busca gera conteúdo duplicado infinito.

### Arquivos de categoria e tag

Não existe coleção de taxonomia: o post guarda o rótulo de exibição
("Mercado da Bola"), e a URL é derivada dele por `categoryPath`/`tagPath`
(`packages/shared/src/seo.ts`). A rota resolve o caminho inverso comparando o slug da URL com
o slug de cada valor publicado, via as facetas `categories` e `postTags` da API; slug que não
casa responde **404**, para não indexar arquivo vazio.

`postTags` tem `minCount: 2` por padrão — tag usada uma vez só não vira página, porque arquivo
com uma matéria é conteúdo raso. A paginação usa canonical auto-referente (`?pagina=2` aponta
para si mesmo), já que o Google aposentou `rel=prev/next`.

O ganho real vem do link interno: a categoria e as tags da matéria agora são âncoras para os
arquivos, e os arquivos entram no `/sitemap-index.xml`.

> O caminho é `/sitemap-index.xml`, não `/sitemap.xml`: o Oxygen reserva o caminho exato
> `/sitemap.xml` e responde 404 antes de a request chegar ao worker. É o que `app/routes.ts`
> já registra, e o `robots.txt` aponta para o caminho certo.

### Rastreadores de IA

`robots.txt` **libera** GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot,
Google-Extended, Applebot-Extended e CCBot. Motor generativo só cita o que rastreou — bloquear
tira o portal das respostas do ChatGPT, do Perplexity e do AI Overview sem impedir que a mesma
notícia seja contada a partir do concorrente. Se a política mudar, é uma edição só em
`apps/portal/app/routes/robots.tsx`.

### SEO automático por post

`packages/shared/src/seo.ts` gera na gravação e na ingestão de RSS:

- **description** — do subtítulo, resumo ou início do corpo, cortada em fronteira de frase,
  no limite de 158 caracteres;
- **keywords** — tags e categoria primeiro, depois nomes próprios do título, palavras
  relevantes e os termos de marca; teto de 12;
- **geo** — São Januário (`-22.890556;-43.227778`), sinal local que pesa para portal de clube.

Escrever a descrição à mão no admin **desliga a geração** para aquele post (`seo.auto`
vira `false`); apagar o campo religa. `npm run seo:check` guarda 15 casos de referência
(geração de SEO e construção dos caminhos de arquivo) e `npm run seo:backfill` preenche o que
já está no banco.

O editor tem painel de SEO com contador de caracteres e um toggle de `noindex`, que tira a
matéria do Google sem despublicar do portal.

### Configurações → Geral

Upload de **favicon** (512×512 PNG ou SVG), imagem OG padrão, palavras-chave do site e o
código de verificação do Search Console.

> Ainda falta o que só você pode fazer: registrar o domínio no Search Console e no Google News
> Publisher Center, e apontar `PUBLIC_SITE_URL` para o domínio real — sem isso o canonical e o
> `og:url` saem com o host da request.

## Armadilha: JS compilado ao lado dos fontes

O script de build inicial do admin era `tsc -b --noEmit false || true && vite build`, que
**emitia `.js` ao lado de cada `.tsx`**. O Vite resolve import sem extensão nesta ordem:

```
.mjs → .js → .mts → .ts → .jsx → .tsx
```

`.js` vem **antes** de `.tsx`. Com `src/App.js` no disco, `import { App } from "./App"` passa a
carregar o JS velho — e o admin serve uma versão congelada, sem erro nenhum no console nem no
build. Foi o que aconteceu: 13 arquivos parados desde as primeiras horas do projeto deixaram
o painel sem as telas de Jogos e Anunciantes, sem o filtro de duplicatas, sem o painel de SEO
e sem o campo de favicon, mesmo com o código correto no repositório.

O script já foi corrigido para `tsc --noEmit && vite build`, os arquivos foram apagados e o
padrão entrou no `.gitignore`. **Sintoma para reconhecer:** mexer no `.tsx`, salvar, e a tela
não mudar — nem no dev, nem depois do build. Confira com:

```bash
find apps/*/src apps/*/app -name "*.js"   # tem que voltar vazio
```

## Uploads

`POST /upload` (multipart, campo `file`, até 2 MB, JPG/PNG/WEBP) grava em `apps/api/uploads`
e devolve `{ url }`. Em produção, trocar por S3/R2/Cloudinary — o front só consome a URL.

## O que ficou de fora (precisa de credencial ou mídia real)

- **Duplicação em Instagram/X**: os toggles e o estado de conexão existem; o disparo real
  no evento de publicação está marcado em `apps/api/src/graphql/resolvers/post.ts`
  (`publishPost`) e precisa das credenciais das APIs.
- **Tabela/estatísticas do clube**: hoje vêm do Mongo (seed). Plugar a API externa e cachear
  nas coleções `matches` / `clubstats`.
- **Imagens**: os mockups usam placeholders cinza; o portal renderiza o mesmo placeholder
  quando `coverImage` é nulo.
- **Envio de e-mail do convite de usuário**: o convite é criado com `invitePending`, mas
  nenhum e-mail é disparado.
