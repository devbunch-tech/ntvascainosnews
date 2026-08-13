/** Fragmentos e queries do portal. Mantidos em um arquivo só para ficar
 *  trivial trocar por documentos .graphql + codegen quando o time quiser. */

export const AD_FIELDS = /* GraphQL */ `
  fragment AdFields on Ad {
    id
    title
    advertiser
    imageUrl
    targetUrl
    placement
  }
`;

export const SITE_QUERY = /* GraphQL */ `
  ${AD_FIELDS}
  query Site {
    settings {
      siteName
      logoUrl
      faviconUrl
      url
      seo {
        title
        description
        keywords
        googleVerification
        organizationName
        foundingDate
        ogImage
      }
      socialAccounts {
        instagram {
          url
        }
        youtube {
          url
        }
        x {
          url
        }
        facebook {
          url
        }
        tiktok {
          url
        }
      }
    }
    footerAds: ads(placement: footer) {
      ...AdFields
    }
  }
`;


export const POST_CARD_FIELDS = /* GraphQL */ `
  fragment PostCard on Post {
    id
    title
    slug
    subtitle
    coverImage
    category
    publishedAt
    credit
    source {
      type
      name
    }
    author {
      id
      name
      role
      avatarUrl
    }
  }
`;

export const SIDEBAR_FIELDS = /* GraphQL */ `
  ${AD_FIELDS}
  fragment SidebarData on Home {
    clubStats {
      position
      points
      played
      wins
      draws
      losses
      efficiency
    }
    lastMatches {
      id
      opponent
      result
      scoreFor
      scoreAgainst
      date
    }
    nextMatches {
      id
      opponent
      date
      venue
      competition
      ticketUrl
    }
    activePolls {
      id
      question
      goodPercent
      totalVotes
      myVote
      fee
      probability
      player {
        name
        position
        club
        photo
      }
    }
    shopHighlights {
      id
      title
      price
      imageUrl
      externalUrl
      marketplace
    }
    signings {
      id
      playerName
      position
      club
      fee
      photo
      date
    }
    latestVideos {
      id
      videoId
      title
      thumbnail
      url
      publishedAt
    }
    ads {
      ...AdFields
    }
  }
`;

export const HOME_QUERY = /* GraphQL */ `
  ${POST_CARD_FIELDS}
  ${SIDEBAR_FIELDS}
  query Home($latestLimit: Int!) {
    home(latestLimit: $latestLimit) {
      ticker
      featured {
        ...PostCard
        featured {
          position
        }
      }
      teamPosts {
        ...PostCard
      }
      latest {
        total
        hasMore
        items {
          ...PostCard
        }
      }
      ...SidebarData
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const LATEST_PAGE_QUERY = /* GraphQL */ `
  ${POST_CARD_FIELDS}
  query Latest($limit: Int!, $offset: Int!) {
    posts(limit: $limit, offset: $offset) {
      total
      hasMore
      items {
        ...PostCard
      }
    }
  }
`;

export const COMMENT_FIELDS = /* GraphQL */ `
  fragment CommentBase on Comment {
    id
    body
    createdAt
    status
    mine
    parentId
    replyingTo
    author {
      id
      name
      avatarUrl
    }
  }

  fragment CommentFields on Comment {
    ...CommentBase
    replies {
      ...CommentBase
    }
  }
`;

export const POST_QUERY = /* GraphQL */ `
  ${POST_CARD_FIELDS}
  ${SIDEBAR_FIELDS}
  ${COMMENT_FIELDS}
  query PostPage($slug: String!) {
    post(slug: $slug) {
      id
      title
      slug
      subtitle
      coverImage
      coverCredit
      excerpt
      body
      category
      tags
      publishedAt
      updatedAt
      credit
      views
      seo {
        description
        keywords
        noindex
      }
      geo {
        placename
        region
        position
      }
      source {
        type
        name
        url
      }
      author {
        id
        name
        role
        avatarUrl
        bio
      }
    }
    comments(postSlug: $slug, limit: 20) {
      total
      hasMore
      items {
        ...CommentFields
      }
    }
    articleAds: ads(placement: in_article) {
      ...AdFields
    }
    latestPosts: posts(limit: 6) {
      items {
        ...PostCard
      }
    }
    home(latestLimit: 1) {
      ...SidebarData
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const SHOP_QUERY = /* GraphQL */ `
  query Shop($filter: ProductFilter, $sort: ProductSort, $limit: Int!, $offset: Int!) {
    products(filter: $filter, sort: $sort, limit: $limit, offset: $offset) {
      total
      hasMore
      priceRange {
        min
        max
      }
      categories {
        value
        count
      }
      marketplaces {
        value
        count
      }
      items {
        id
        title
        price
        imageUrl
        externalUrl
        marketplace
        category
        soldOut
        highlighted
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const ADD_COMMENT_MUTATION = /* GraphQL */ `
  ${COMMENT_FIELDS}
  mutation AddComment($postSlug: String!, $body: String!, $parentId: ID) {
    addComment(postSlug: $postSlug, body: $body, parentId: $parentId) {
      ok
      error
      category
      comment {
        ...CommentBase
      }
    }
  }
`;

export const REMOVE_COMMENT_MUTATION = /* GraphQL */ `
  mutation RemoveComment($id: ID!) {
    removeComment(id: $id)
  }
`;

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      name
      email
      avatarUrl
      bio
      role
      preferences {
        newsletter
        matchAlerts
        shopNews
      }
      pollVotes {
        pollId
        playerName
        choice
        votedAt
      }
    }
  }
`;

export const SIGNUP_MUTATION = /* GraphQL */ `
  mutation Signup($name: String!, $email: String!, $password: String!, $newsletter: Boolean) {
    signup(name: $name, email: $email, password: $password, newsletter: $newsletter) {
      token
    }
  }
`;

export const LOGIN_MUTATION = /* GraphQL */ `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`;

export const UPDATE_PROFILE_MUTATION = /* GraphQL */ `
  mutation UpdateProfile($input: ProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      email
      avatarUrl
      preferences {
        newsletter
        matchAlerts
        shopNews
      }
    }
  }
`;

export const VOTE_MUTATION = /* GraphQL */ `
  mutation Vote($pollId: ID!, $choice: PollChoice!) {
    votePoll(pollId: $pollId, choice: $choice) {
      id
      goodPercent
      totalVotes
      myVote
    }
  }
`;

export const TRACK_CLICK_MUTATION = /* GraphQL */ `
  mutation TrackClick($id: ID!) {
    trackProductClick(id: $id)
  }
`;

export const NEWS_LIST_QUERY = /* GraphQL */ `
  ${POST_CARD_FIELDS}
  query NewsList($filter: PostFilter, $limit: Int!, $offset: Int!) {
    posts(filter: $filter, limit: $limit, offset: $offset) {
      total
      hasMore
      items {
        ...PostCard
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const SEARCH_QUERY = /* GraphQL */ `
  ${POST_CARD_FIELDS}
  query Search($q: String!, $limit: Int!, $offset: Int!) {
    searchPosts(q: $q, limit: $limit, offset: $offset) {
      total
      hasMore
      fallback
      items {
        ...PostCard
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const STANDINGS_QUERY = /* GraphQL */ `
  query Standings {
    standings {
      key
      competition
      season
      sourceUrl
      lastSyncAt
      rows {
        position
        team
        played
        wins
        draws
        losses
        goalsFor
        goalsAgainst
        goalDiff
        points
        highlight
      }
    }
    brackets {
      key
      competition
      sourceUrl
      lastSyncAt
      rounds {
        name
        order
        ties {
          home
          away
          score
          date
          highlight
        }
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const MARKET_QUERY = /* GraphQL */ `
  query Market {
    polls(status: "open", limit: 60) {
      id
      question
      goodPercent
      totalVotes
      myVote
      fee
      probability
      rumouredAt
      player {
        name
        position
        club
        photo
      }
    }
    signings(direction: "in", limit: 12) {
      id
      playerName
      position
      club
      fee
      photo
    }
    settings {
      matches {
        lastSyncAt
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

export const SITEMAP_QUERY = /* GraphQL */ `
  query Sitemap($limit: Int!) {
    sitemapPosts(limit: $limit) {
      slug
      title
      updatedAt
      publishedAt
      coverImage
      category
      excerpt
      keywords
    }
  }
`;
