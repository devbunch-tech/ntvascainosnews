import { gql } from "@apollo/client";

export const ME = gql`
  query Me {
    me {
      id
      name
      email
      role
      avatarUrl
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
        role
      }
    }
  }
`;

/** Só o necessário para o ícone e o título da aba do admin. */
export const SITE_ICON = gql`
  query SiteIcon {
    settings {
      siteName
      faviconUrl
    }
  }
`;

export const DASHBOARD = gql`
  query Dashboard {
    dashboard {
      stats {
        visitsToday
        postsToday
        postsTodaySplit {
          team
          rss
        }
        rssImportedToday
        shopClicksToday
      }
      featuredSlots {
        id
        title
        category
        featured {
          position
        }
      }
      rssSources {
        id
        name
        url
        enabled
        lastFetchAt
        lastError
        importedCount
      }
      recentPosts {
        id
        title
        slug
        status
        updatedAt
      }
    }
    posts(filter: { status: published }, limit: 20) {
      items {
        id
        title
        category
      }
    }
  }
`;

export const POSTS = gql`
  query Posts($filter: PostFilter, $limit: Int!, $offset: Int!) {
    posts(filter: $filter, limit: $limit, offset: $offset) {
      total
      hasMore
      items {
        id
        title
        slug
        category
        status
        publishedAt
        updatedAt
        views
        credit
        duplicateOf
        duplicateSource
        featured {
          active
          position
        }
        source {
          type
          name
        }
        author {
          id
          name
        }
      }
    }
  }
`;

export const POST_BY_SLUG = gql`
  query AdminPost($slug: String!) {
    post(slug: $slug) {
      id
      title
      slug
      subtitle
      coverImage
      coverCredit
      body
      excerpt
      category
      tags
      status
      publishedAt
      featured {
        active
        position
      }
      crosspost {
        instagram
        x
      }
      seo {
        description
        keywords
        auto
        noindex
      }
      author {
        id
        name
        role
      }
    }
  }
`;

export const CREATE_POST = gql`
  mutation CreatePost($input: PostInput!) {
    createPost(input: $input) {
      id
      slug
    }
  }
`;

export const UPDATE_POST = gql`
  mutation UpdatePost($id: ID!, $input: PostInput!) {
    updatePost(id: $id, input: $input) {
      id
      slug
      status
    }
  }
`;

export const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

export const BULK_UPDATE_POSTS = gql`
  mutation BulkUpdatePosts($ids: [ID!]!, $status: PostStatus, $category: String) {
    bulkUpdatePosts(ids: $ids, status: $status, category: $category) {
      affected
      skipped
      message
    }
  }
`;

export const BULK_DELETE_POSTS = gql`
  mutation BulkDeletePosts($ids: [ID!]!) {
    bulkDeletePosts(ids: $ids) {
      affected
      skipped
      message
    }
  }
`;

export const PUBLISH_POST = gql`
  mutation PublishPost($id: ID!) {
    publishPost(id: $id) {
      id
      status
    }
  }
`;

export const REORDER_FEATURED = gql`
  mutation ReorderFeatured($slots: [FeaturedSlotInput!]!) {
    reorderFeatured(slots: $slots) {
      id
      title
      featured {
        position
      }
    }
  }
`;

export const PRODUCTS = gql`
  query AdminProducts($filter: ProductFilter, $limit: Int!) {
    products(filter: $filter, limit: $limit) {
      total
      items {
        id
        title
        price
        imageUrl
        externalUrl
        marketplace
        category
        visible
        soldOut
        highlighted
        clicks
      }
    }
  }
`;

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: ProductInput!) {
    createProduct(input: $input) {
      id
    }
  }
`;

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: ID!, $input: ProductInput!) {
    updateProduct(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id)
  }
`;

export const USERS = gql`
  query Users($search: String) {
    users(search: $search) {
      id
      name
      email
      role
      avatarUrl
      lastLoginAt
      invitePending
      createdAt
    }
  }
`;

export const INVITE_USER = gql`
  mutation InviteUser($name: String!, $email: String!, $role: Role!) {
    inviteUser(name: $name, email: $email, role: $role) {
      id
    }
  }
`;

export const UPDATE_ROLE = gql`
  mutation UpdateUserRole($id: ID!, $role: Role!) {
    updateUserRole(id: $id, role: $role) {
      id
      role
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

export const SETTINGS = gql`
  query Settings {
    settings {
      siteName
      logoUrl
      url
      maintenance
      faviconUrl
      seo {
        title
        description
        ogImage
        keywords
        googleVerification
      }
      socialAccounts {
        instagram {
          connected
          handle
          url
        }
        x {
          connected
          handle
          url
        }
        youtube {
          connected
          handle
          url
        }
        facebook {
          connected
          handle
          url
        }
        tiktok {
          connected
          handle
          url
        }
      }
      youtube {
        channelUrl
        channelId
        channelTitle
        lastSyncAt
        lastError
      }
      sidebar {
        adLimit
        widgets {
          key
          label
          visible
        }
      }
    }
    rssSources {
      id
      name
      url
      enabled
      autoPublish
      category
      lastFetchAt
      lastError
      importedCount
    }
  }
`;

export const SAVE_SOCIAL_LINKS = gql`
  mutation SaveSocialLinks($links: [SocialLinkInput!]!) {
    saveSocialLinks(links: $links) {
      siteName
    }
  }
`;

export const SAVE_YOUTUBE_CHANNEL = gql`
  mutation SaveYoutubeChannel($channelUrl: String!) {
    saveYoutubeChannel(channelUrl: $channelUrl) {
      siteName
    }
  }
`;

export const SYNC_YOUTUBE = gql`
  mutation SyncYoutube {
    syncYoutube
  }
`;

export const SYNC_MATCHES = gql`
  mutation SyncMatches {
    syncMatches {
      affected
      message
    }
  }
`;

export const SAVE_TRANSFERMARKT_URL = gql`
  mutation SaveTransfermarktUrl($url: String!) {
    saveTransfermarktUrl(url: $url) {
      siteName
    }
  }
`;

export const MATCH_SOURCE = gql`
  query MatchSource {
    settings {
      matches {
        transfermarktUrl
        lastSyncAt
        lastError
        lastCount
      }
    }
  }
`;

export const MATCHES = gql`
  query AdminMatches {
    matches {
      id
      opponent
      date
      competition
      venue
      scoreFor
      scoreAgainst
      result
      ticketUrl
    }
  }
`;

export const CREATE_MATCH = gql`
  mutation CreateMatch($input: MatchInput!) {
    createMatch(input: $input) {
      id
    }
  }
`;

export const UPDATE_MATCH = gql`
  mutation UpdateMatch($id: ID!, $input: MatchInput!) {
    updateMatch(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_MATCH = gql`
  mutation DeleteMatch($id: ID!) {
    deleteMatch(id: $id)
  }
`;

export const ADS = gql`
  query AdminAds {
    ads(includeInactive: true) {
      id
      title
      advertiser
      imageUrl
      targetUrl
      placement
      active
      startsAt
      endsAt
      weight
      impressions
      clicks
    }
  }
`;

export const CREATE_AD = gql`
  mutation CreateAd($input: AdInput!) {
    createAd(input: $input) {
      id
    }
  }
`;

export const UPDATE_AD = gql`
  mutation UpdateAd($id: ID!, $input: AdInput!) {
    updateAd(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_AD = gql`
  mutation DeleteAd($id: ID!) {
    deleteAd(id: $id)
  }
`;

export const SAVE_SETTINGS = gql`
  mutation SaveSettings($input: SettingsInput!) {
    saveSettings(input: $input) {
      siteName
    }
  }
`;

export const TOGGLE_RSS = gql`
  mutation ToggleRss($id: ID!, $enabled: Boolean!) {
    toggleRssSource(id: $id, enabled: $enabled) {
      id
      enabled
    }
  }
`;

export const CREATE_RSS = gql`
  mutation CreateRss($input: RssSourceInput!) {
    createRssSource(input: $input) {
      id
    }
  }
`;

export const DELETE_RSS = gql`
  mutation DeleteRss($id: ID!) {
    deleteRssSource(id: $id)
  }
`;

export const RUN_RSS = gql`
  mutation RunRss {
    runRssIngest
  }
`;

export const CONNECT_SOCIAL = gql`
  mutation ConnectSocial($network: String!, $handle: String!) {
    connectSocial(network: $network, handle: $handle) {
      siteName
    }
  }
`;

export const DISCONNECT_SOCIAL = gql`
  mutation DisconnectSocial($network: String!) {
    disconnectSocial(network: $network) {
      siteName
    }
  }
`;

export const SAVE_SIDEBAR = gql`
  mutation SaveSidebar($widgets: [SidebarWidgetInput!]!, $adLimit: Int!) {
    saveSidebar(widgets: $widgets, adLimit: $adLimit) {
      sidebar {
        adLimit
        widgets {
          key
          label
          visible
        }
      }
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export const CATEGORIES = gql`
  query Categories {
    categories {
      value
      count
    }
  }
`;
