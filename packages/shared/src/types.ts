/** Tipos de domínio compartilhados entre API, admin e portal.
 *  Fonte da verdade do schema: apps/api/src/graphql/typeDefs.ts */

export type Role = "admin" | "editor" | "reader";
export type PostStatus = "draft" | "published" | "scheduled";
export type SourceType = "team" | "rss";
export type FeaturedPosition = 1 | 2 | 3;
export type MatchVenue = "home" | "away";
export type MatchResult = "W" | "D" | "L";
export type PollChoice = "good" | "bad";

export interface PostSource {
  type: SourceType;
  name?: string | null;
  url?: string | null;
}

export interface Featured {
  active: boolean;
  position?: FeaturedPosition | null;
}

export interface Crosspost {
  instagram: boolean;
  x: boolean;
}

export interface Author {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  bio?: string | null;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  coverImage?: string | null;
  coverCredit?: string | null;
  body: string;
  excerpt?: string | null;
  category: string;
  tags: string[];
  author?: Author | null;
  source: PostSource;
  status: PostStatus;
  publishedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  featured: Featured;
  crosspost: Crosspost;
  views: number;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  externalUrl: string;
  marketplace: string;
  category?: string | null;
  visible: boolean;
  soldOut: boolean;
  highlighted: boolean;
}

export interface Poll {
  id: string;
  player: { name: string; position: string; club: string; photo?: string | null };
  question: string;
  votes: { good: number; bad: number };
  status: "open" | "closed";
  goodPercent: number;
  totalVotes: number;
  myVote?: PollChoice | null;
}

export interface RssSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastFetchAt?: string | null;
  lastError?: string | null;
  importedCount: number;
}

export interface ClubStats {
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0–100 */
  efficiency: number;
}

export interface Match {
  id: string;
  opponent: string;
  date: string;
  competition: string;
  venue: MatchVenue;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  result?: MatchResult | null;
}

export interface Settings {
  siteName: string;
  logoUrl?: string | null;
  url: string;
  maintenance: boolean;
  seo: { title: string; description: string; ogImage?: string | null };
  socialAccounts: {
    instagram: { connected: boolean; handle?: string | null };
    x: { connected: boolean; handle?: string | null };
    youtube: { connected: boolean; handle?: string | null };
  };
}

export interface UserPreferences {
  newsletter: boolean;
  matchAlerts: boolean;
  shopNews: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: Role;
  preferences: UserPreferences;
  lastLoginAt?: string | null;
  invitePending: boolean;
  createdAt: string;
}

/** Permissões por papel — espelha o painel do admin (README §Usuários). */
export const PERMISSIONS: Record<Role, string[]> = {
  admin: [
    "posts:write",
    "posts:delete-any",
    "featured:manage",
    "users:manage",
    "products:manage",
    "settings:manage",
    "rss:manage",
    "social:manage",
  ],
  editor: ["posts:write", "featured:manage", "products:manage"],
  reader: [],
};

export function can(role: Role | undefined | null, permission: string): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}
