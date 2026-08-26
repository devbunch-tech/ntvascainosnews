export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum Role {
    admin
    editor
    reader
  }
  enum PostStatus {
    draft
    published
    scheduled
  }
  enum SourceType {
    team
    rss
    x
  }
  enum PollChoice {
    good
    bad
  }
  enum Venue {
    home
    away
  }
  enum ProductSort {
    recent
    price_asc
    price_desc
    title
  }

  type Author {
    id: ID!
    name: String!
    avatarUrl: String
    role: Role!
    bio: String
  }

  type PostSource {
    type: SourceType!
    name: String
    url: String
  }

  type Featured {
    active: Boolean!
    position: Int
  }

  type Crosspost {
    instagram: Boolean!
    x: Boolean!
  }

  type Post {
    id: ID!
    title: String!
    slug: String!
    subtitle: String
    coverImage: String
    coverCredit: String
    body: String!
    excerpt: String
    category: String!
    tags: [String!]!
    author: Author
    source: PostSource!
    status: PostStatus!
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    featured: Featured!
    crosspost: Crosspost!
    views: Int!
    """
    Crédito pronto para a meta do card: "via ge.globo · RSS".
    """
    credit: String
    """
    Preenchido quando a notícia foi suprimida por já existir igual de outra fonte.
    """
    duplicateOf: ID
    duplicateSource: String
    seo: PostSeo!
    geo: PostGeo
  }

  type PostSeo {
    description: String
    keywords: [String!]!
    """
    true enquanto a descrição for gerada automaticamente. Editar no admin desliga.
    """
    auto: Boolean!
    noindex: Boolean!
  }

  type PostGeo {
    placename: String
    region: String
    position: String
  }

  type CommentAuthor {
    id: ID!
    name: String!
    avatarUrl: String
  }

  type Comment {
    id: ID!
    body: String!
    author: CommentAuthor!
    createdAt: DateTime!
    status: String!
    """
    Só é true para o próprio autor — permite mostrar "removido pela moderação".
    """
    mine: Boolean!
    """
    Comentário-raiz ao qual este responde. Nulo quando é raiz.
    """
    parentId: ID
    """
    Nome de quem foi respondido, para o "respondendo a @fulano" da UI.
    """
    replyingTo: String
    """
    Respostas diretas. Sempre vazio dentro de uma resposta (árvore de um nível).
    """
    replies: [Comment!]!
  }

  type CommentPage {
    """
    Só os comentários-raiz. As respostas vêm dentro de cada um, em replies.
    """
    items: [Comment!]!
    """
    Total geral, contando respostas — é o número exibido no cabeçalho.
    """
    total: Int!
    hasMore: Boolean!
  }

  type CommentResult {
    """
    Nulo quando a moderação barrou — nesse caso o campo error explica o motivo.
    """
    comment: Comment
    ok: Boolean!
    error: String
    category: String
  }

  type BulkResult {
    affected: Int!
    """
    Itens ignorados por falta de permissão (editor não exclui post de terceiro).
    """
    skipped: Int!
    message: String
  }

  type PostPage {
    items: [Post!]!
    total: Int!
    hasMore: Boolean!
  }

  type SitemapPost {
    slug: String!
    title: String!
    updatedAt: DateTime!
    publishedAt: DateTime
    coverImage: String
    category: String!
    excerpt: String
    keywords: [String!]!
  }

  type SearchResult {
    items: [Post!]!
    total: Int!
    hasMore: Boolean!
    """
    true quando o índice de texto não achou nada e caiu na busca por trecho.
    """
    fallback: Boolean!
  }

  type StandingRow {
    position: Int!
    team: String!
    played: Int!
    wins: Int!
    draws: Int!
    losses: Int!
    goalsFor: Int!
    goalsAgainst: Int!
    goalDiff: Int!
    points: Int!
    highlight: Boolean!
  }

  type Standing {
    key: String!
    competition: String!
    season: String
    sourceUrl: String
    lastSyncAt: DateTime
    rows: [StandingRow!]!
  }

  type BracketTie {
    home: String!
    away: String!
    score: String
    date: DateTime
    highlight: Boolean!
  }

  type BracketRound {
    name: String!
    order: Int!
    ties: [BracketTie!]!
  }

  """
  Chaveamento de copa: as fases do mata-mata com todos os confrontos.
  """
  type Bracket {
    key: String!
    competition: String!
    sourceUrl: String
    lastSyncAt: DateTime
    rounds: [BracketRound!]!
  }

  type Signing {
    id: ID!
    playerName: String!
    position: String
    age: Int
    club: String
    fee: String
    photo: String
    direction: String!
    date: DateTime
  }

  type UserPreferences {
    newsletter: Boolean!
    matchAlerts: Boolean!
    shopNews: Boolean!
  }

  type PollVote {
    pollId: ID!
    playerName: String!
    choice: PollChoice!
    votedAt: DateTime!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    avatarUrl: String
    bio: String
    role: Role!
    preferences: UserPreferences!
    pollVotes: [PollVote!]!
    lastLoginAt: DateTime
    invitePending: Boolean!
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Product {
    id: ID!
    title: String!
    price: Float!
    imageUrl: String
    externalUrl: String!
    marketplace: String!
    category: String
    visible: Boolean!
    soldOut: Boolean!
    highlighted: Boolean!
    clicks: Int!
  }

  type FacetCount {
    value: String!
    count: Int!
  }

  type ProductPage {
    items: [Product!]!
    total: Int!
    hasMore: Boolean!
    categories: [FacetCount!]!
    """
    Payload enxuto para sitemap e feed: sem corpo, com data de atualização.
    """
    sitemapPosts(limit: Int = 5000): [SitemapPost!]!
    marketplaces: [FacetCount!]!
    priceRange: PriceRange!
  }

  type PriceRange {
    min: Float!
    max: Float!
  }

  type Player {
    name: String!
    position: String!
    club: String!
    photo: String
  }

  type Poll {
    id: ID!
    player: Player!
    question: String!
    status: String!
    totalVotes: Int!
    """
    % de "bom reforço". Só é revelado depois do voto (README §Enquete).
    """
    goodPercent: Int
    myVote: PollChoice
    fee: String
    probability: Int
    rumouredAt: DateTime
  }

  type RssSource {
    id: ID!
    name: String!
    url: String!
    enabled: Boolean!
    autoPublish: Boolean!
    category: String!
    lastFetchAt: DateTime
    lastError: String
    importedCount: Int!
  }

  """
  Perfil do X monitorado pela ingestão automática. Sem API de leitura
  gratuita oficial — usa o endpoint de sindicação da timeline (README §X).
  """
  type XSource {
    id: ID!
    handle: String!
    name: String!
    enabled: Boolean!
    autoPublish: Boolean!
    category: String!
    lastFetchAt: DateTime
    lastError: String
    importedCount: Int!
  }

  type SocialAccount {
    connected: Boolean!
    handle: String
    url: String
  }
  type SocialAccounts {
    instagram: SocialAccount!
    x: SocialAccount!
    youtube: SocialAccount!
    facebook: SocialAccount!
    tiktok: SocialAccount!
  }
  type MatchesSource {
    transfermarktUrl: String
    lastSyncAt: DateTime
    lastError: String
    lastCount: Int
  }

  type YoutubeChannel {
    channelUrl: String
    channelId: String
    channelTitle: String
    lastSyncAt: DateTime
    lastError: String
  }

  type Video {
    id: ID!
    videoId: String!
    title: String!
    thumbnail: String
    url: String!
    publishedAt: DateTime!
    channelTitle: String
  }

  enum AdPlacement {
    sidebar
    in_article
    footer
    shop
  }

  type Ad {
    id: ID!
    title: String!
    advertiser: String
    imageUrl: String
    targetUrl: String!
    placement: AdPlacement!
    active: Boolean!
    startsAt: DateTime
    endsAt: DateTime
    weight: Int!
    impressions: Int!
    clicks: Int!
  }
  type Seo {
    title: String!
    description: String!
    ogImage: String
    keywords: [String!]!
    googleVerification: String
    organizationName: String
    foundingDate: String
  }
  type Settings {
    siteName: String!
    logoUrl: String
    url: String!
    maintenance: Boolean!
    faviconUrl: String
    seo: Seo!
    socialAccounts: SocialAccounts!
    youtube: YoutubeChannel!
    matches: MatchesSource!
    sidebar: SidebarConfig!
  }

  """
  Ordem e visibilidade dos widgets da sidebar. A posição na lista é a ordem.
  """
  type SidebarConfig {
    widgets: [SidebarWidget!]!
    """
    Quantas campanhas a sidebar exibe. 0 esconde o espaço publicitário.
    """
    adLimit: Int!
  }

  type SidebarWidget {
    key: String!
    label: String!
    visible: Boolean!
  }

  input SidebarWidgetInput {
    key: String!
    visible: Boolean!
  }

  type ClubStats {
    position: Int!
    points: Int!
    played: Int!
    wins: Int!
    draws: Int!
    losses: Int!
    efficiency: Int!
  }

  type Match {
    id: ID!
    opponent: String!
    date: DateTime!
    competition: String!
    venue: Venue!
    scoreFor: Int
    scoreAgainst: Int
    result: String
    ticketUrl: String
  }

  """
  Payload único da home — evita waterfall de requests no SSR do Hydrogen.
  """
  type Home {
    featured: [Post!]!
    teamPosts: [Post!]!
    latest: PostPage!
    clubStats: ClubStats
    lastMatches: [Match!]!
    nextMatches: [Match!]!
    activePolls: [Poll!]!
    signings: [Signing!]!
    shopHighlights: [Product!]!
    latestVideos: [Video!]!
    ads: [Ad!]!
    ticker: String
  }

  type StatSplit {
    team: Int!
    rss: Int!
  }

  type DashboardStats {
    visitsToday: Int!
    postsToday: Int!
    postsTodaySplit: StatSplit!
    rssImportedToday: Int!
    shopClicksToday: Int!
  }

  type Dashboard {
    stats: DashboardStats!
    featuredSlots: [Post]!
    rssSources: [RssSource!]!
    recentPosts: [Post!]!
  }

  # ----------------- Inputs -----------------

  input PostFilter {
    search: String
    status: PostStatus
    category: String
    sourceType: SourceType
    authorId: ID
    from: DateTime
    to: DateTime
    tag: String
    """
    Admin: lista só as notícias suprimidas por duplicidade.
    """
    onlyDuplicates: Boolean
    """
    Admin: por padrão as duplicatas ficam fora; passe false para vê-las junto.
    """
    hideDuplicates: Boolean
  }

  input PostInput {
    title: String!
    """
    Descrição do Google. Vazio = gerada do subtítulo/resumo automaticamente.
    """
    seoDescription: String
    seoKeywords: [String!]
    noindex: Boolean
    slug: String
    subtitle: String
    coverImage: String
    coverCredit: String
    body: String
    excerpt: String
    category: String
    tags: [String!]
    status: PostStatus
    publishedAt: DateTime
    featured: FeaturedInput
    crosspost: CrosspostInput
    authorId: ID
  }

  input FeaturedInput {
    active: Boolean!
    position: Int
  }

  input CrosspostInput {
    instagram: Boolean!
    x: Boolean!
  }

  input ProductFilter {
    category: String
    marketplace: String
    minPrice: Float
    maxPrice: Float
    search: String
    includeHidden: Boolean
  }

  input ProductInput {
    title: String!
    price: Float!
    imageUrl: String
    externalUrl: String!
    marketplace: String
    category: String
    visible: Boolean
    soldOut: Boolean
    highlighted: Boolean
  }

  input PreferencesInput {
    newsletter: Boolean!
    matchAlerts: Boolean!
    shopNews: Boolean!
  }

  input ProfileInput {
    name: String
    email: String
    avatarUrl: String
    bio: String
    preferences: PreferencesInput
  }

  input RssSourceInput {
    name: String!
    url: String!
    enabled: Boolean
    autoPublish: Boolean
    category: String
  }

  input XSourceInput {
    handle: String!
    name: String!
    enabled: Boolean
    autoPublish: Boolean
    category: String
  }

  input MatchInput {
    opponent: String!
    date: DateTime!
    competition: String
    venue: Venue!
    scoreFor: Int
    scoreAgainst: Int
    ticketUrl: String
  }

  input AdInput {
    title: String!
    advertiser: String
    imageUrl: String
    targetUrl: String!
    placement: AdPlacement!
    active: Boolean
    startsAt: DateTime
    endsAt: DateTime
    weight: Int
  }

  input SocialLinkInput {
    network: String!
    url: String!
  }

  input SettingsInput {
    siteName: String
    logoUrl: String
    faviconUrl: String
    url: String
    maintenance: Boolean
    seoKeywords: [String!]
    googleVerification: String
    seoTitle: String
    seoDescription: String
    seoOgImage: String
  }

  input FeaturedSlotInput {
    postId: ID!
    position: Int!
  }

  # ----------------- Query -----------------

  type Query {
    home(latestLimit: Int = 12): Home!
    post(slug: String!): Post
    posts(filter: PostFilter, limit: Int = 12, offset: Int = 0): PostPage!
    relatedPosts(slug: String!, limit: Int = 6): [Post!]!

    products(
      filter: ProductFilter
      sort: ProductSort = recent
      limit: Int = 12
      offset: Int = 0
    ): ProductPage!

    polls(status: String, limit: Int = 50): [Poll!]!
    me: User
    users(search: String, role: Role): [User!]!
    settings: Settings!
    rssSources: [RssSource!]!
    xSources: [XSource!]!
    dashboard: Dashboard!
    categories: [FacetCount!]!
    """
    Tags publicadas, da mais usada para a menos. O minCount evita gerar página
    de arquivo para tag de uso único — arquivo com uma matéria só é conteúdo
    raso e o Google penaliza.
    """
    postTags(limit: Int = 200, minCount: Int = 2): [FacetCount!]!
    """
    Payload enxuto para sitemap e feed: sem corpo, com data de atualização.
    """
    sitemapPosts(limit: Int = 5000): [SitemapPost!]!
    videos(limit: Int = 6): [Video!]!
    ads(placement: AdPlacement, includeInactive: Boolean): [Ad!]!
    matches(past: Boolean): [Match!]!
    comments(postSlug: String!, limit: Int = 20, offset: Int = 0): CommentPage!
    searchPosts(q: String!, limit: Int = 20, offset: Int = 0): SearchResult!
    standings: [Standing!]!
    standing(key: String!): Standing
    brackets: [Bracket!]!
    signings(direction: String, limit: Int = 5): [Signing!]!
  }

  # ----------------- Mutation -----------------

  type Mutation {
    signup(name: String!, email: String!, password: String!, newsletter: Boolean): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(input: ProfileInput!): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    createPost(input: PostInput!): Post!
    updatePost(id: ID!, input: PostInput!): Post!
    deletePost(id: ID!): Boolean!
    """
    Ação em massa na listagem do admin. Informe apenas o que deve mudar.
    """
    bulkUpdatePosts(ids: [ID!]!, status: PostStatus, category: String): BulkResult!
    bulkDeletePosts(ids: [ID!]!): BulkResult!
    publishPost(id: ID!): Post!
    """
    Define destaques 1–3 com exclusividade por posição (README §Interactions).
    """
    reorderFeatured(slots: [FeaturedSlotInput!]!): [Post!]!
    setFeatured(postId: ID!, position: Int): Post!

    createProduct(input: ProductInput!): Product!
    updateProduct(id: ID!, input: ProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
    trackProductClick(id: ID!): Boolean!

    votePoll(pollId: ID!, choice: PollChoice!): Poll!
    createPoll(playerName: String!, position: String, club: String, photo: String, question: String): Poll!
    closePoll(id: ID!): Poll!

    inviteUser(name: String!, email: String!, role: Role!): User!
    updateUserRole(id: ID!, role: Role!): User!
    deleteUser(id: ID!): Boolean!

    saveSettings(input: SettingsInput!): Settings!
    saveSocialLinks(links: [SocialLinkInput!]!): Settings!
    saveYoutubeChannel(channelUrl: String!): Settings!
    """
    Grava a sidebar inteira de uma vez: a ordem da lista é a ordem na tela.
    """
    saveSidebar(widgets: [SidebarWidgetInput!]!, adLimit: Int!): Settings!
    saveTransfermarktUrl(url: String!): Settings!
    syncYoutube: Int!
    syncMatches: BulkResult!
    syncMarket: BulkResult!

    createMatch(input: MatchInput!): Match!
    updateMatch(id: ID!, input: MatchInput!): Match!
    deleteMatch(id: ID!): Boolean!

    createAd(input: AdInput!): Ad!
    updateAd(id: ID!, input: AdInput!): Ad!
    deleteAd(id: ID!): Boolean!
    trackAdClick(id: ID!): Boolean!
    connectSocial(network: String!, handle: String!): Settings!
    disconnectSocial(network: String!): Settings!

    createRssSource(input: RssSourceInput!): RssSource!
    updateRssSource(id: ID!, input: RssSourceInput!): RssSource!
    toggleRssSource(id: ID!, enabled: Boolean!): RssSource!
    deleteRssSource(id: ID!): Boolean!
    """
    Roda a ingestão sob demanda; retorna quantos posts entraram.
    """
    runRssIngest: Int!

    createXSource(input: XSourceInput!): XSource!
    updateXSource(id: ID!, input: XSourceInput!): XSource!
    toggleXSource(id: ID!, enabled: Boolean!): XSource!
    deleteXSource(id: ID!): Boolean!
    """
    Roda a ingestão sob demanda; retorna quantos posts entraram.
    """
    runXIngest: Int!

    """
    Publica um comentário. Exige sessão e passa pelo filtro de moderação.
    """
    addComment(postSlug: String!, body: String!, parentId: ID): CommentResult!
    """
    Autor remove o próprio comentário; admin/editor removem qualquer um.
    """
    removeComment(id: ID!): Boolean!

    trackVisit(path: String): Boolean!
  }
`;
