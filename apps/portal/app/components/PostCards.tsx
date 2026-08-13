import { Link } from "react-router";
import { timeAgo } from "@ntv/shared";

export interface PostCardData {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  coverImage?: string | null;
  category: string;
  publishedAt?: string | null;
  credit?: string | null;
  featured?: { position?: number | null } | null;
  author?: { id: string; name: string; role: string; avatarUrl?: string | null } | null;
}

/** Placeholder cinza "FOTO" enquanto a mídia real não chega (README §Fidelity). */
function Media({ src, alt, className }: { src?: string | null; alt: string; className: string }) {
  if (src) return <img className={className} src={src} alt={alt} loading="lazy" />;
  return (
    <div className={className} aria-hidden>
      <span style={{ display: "none" }}>{alt}</span>
    </div>
  );
}

export function HeroCard({ post, lead }: { post: PostCardData; lead?: boolean }) {
  return (
    <Link
      to={`/noticia/${post.slug}`}
      className={`hero__card ${lead ? "hero__card--lead" : "hero__card--sub"}`}
    >
      {post.coverImage ? (
        <img className="hero__media" src={post.coverImage} alt="" />
      ) : (
        <div className="hero__placeholder">FOTO</div>
      )}
      <span className="hero__overlay" />
      <div className="hero__content">
        <span className="hero__badge">{post.category}</span>
        <h2 className="hero__title">{post.title}</h2>
        <p className="hero__meta">
          {post.credit ?? post.author?.name ?? "Redação NTV"} · {timeAgo(post.publishedAt)}
        </p>
      </div>
    </Link>
  );
}

export function TeamCard({ post }: { post: PostCardData }) {
  return (
    <Link to={`/noticia/${post.slug}`} className="teamcard">
      <Media src={post.coverImage} alt={post.title} className="teamcard__thumb" />
      <span className="teamcard__seal">
        <span className="ntv-badge">Equipe</span>
      </span>
      <h3 className="teamcard__title">{post.title}</h3>
      <p className="ntv-meta">
        {post.author?.name ?? "Redação NTV"} · {timeAgo(post.publishedAt)}
      </p>
    </Link>
  );
}

export function NewsRow({ post }: { post: PostCardData }) {
  return (
    <article className="newsitem">
      <Media src={post.coverImage} alt={post.title} className="newsitem__thumb" />
      <div>
        <h3 className="newsitem__title">
          <Link to={`/noticia/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="ntv-meta">
          {timeAgo(post.publishedAt)}
          {post.credit ? ` · ${post.credit}` : post.author ? ` · ${post.author.name}` : ""}
        </p>
      </div>
    </article>
  );
}
