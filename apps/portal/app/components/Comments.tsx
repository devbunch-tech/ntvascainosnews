import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { moderateComment, timeAgo } from "@ntv/shared";
import { Avatar, type SessionUser } from "./Header";

const MAX_LENGTH = 1500;

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  status: string;
  mine: boolean;
  parentId?: string | null;
  replyingTo?: string | null;
  replies?: CommentItem[];
  author: { id: string; name: string; avatarUrl?: string | null };
}

interface CommentActionData {
  ok?: boolean;
  error?: string | null;
  comment?: CommentItem | null;
  removedId?: string;
}

/** Formulário de comentar/responder. O aviso local roda o mesmo filtro do servidor. */
function CommentForm({
  postSlug,
  user,
  parentId,
  placeholder,
  autoFocus,
  onCancel,
  onCreated,
}: {
  postSlug: string;
  user: SessionUser;
  parentId?: string;
  placeholder: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onCreated: (comment: CommentItem, parentId?: string) => void;
}) {
  const fetcher = useFetcher<CommentActionData>();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const data = fetcher.data;
    if (data?.ok && data.comment) {
      onCreated(data.comment, parentId);
      setDraft("");
      setPreview(null);
      formRef.current?.reset();
    }
    // `onCreated` muda a cada render do pai; depender só de `fetcher.data` evita loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  function onDraftChange(value: string) {
    setDraft(value);
    if (value.trim().length < 3) return setPreview(null);
    const verdict = moderateComment(value);
    setPreview(verdict.allowed ? null : (verdict.message ?? null));
  }

  const sending = fetcher.state !== "idle";
  const serverError = fetcher.data?.ok === false ? fetcher.data.error : null;

  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      action="/api/comentar"
      className={parentId ? "comments__form comments__form--reply" : "comments__form"}
    >
      <input type="hidden" name="postSlug" value={postSlug} />
      <input type="hidden" name="intent" value="create" />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}

      <div className="comments__composer">
        <Avatar name={user.name} url={user.avatarUrl} size={parentId ? 32 : 40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            className="ntv-textarea"
            name="body"
            rows={parentId ? 2 : 3}
            maxLength={MAX_LENGTH}
            placeholder={placeholder}
            value={draft}
            autoFocus={autoFocus}
            onChange={(e) => onDraftChange(e.target.value)}
            required
          />
          <div className="comments__formfoot">
            <span className="ntv-meta">
              {draft.length}/{MAX_LENGTH} · sem palavrão e sem política
            </span>
            {onCancel ? (
              <button type="button" className="linkbtn" onClick={onCancel}>
                Cancelar
              </button>
            ) : null}
            <button className="ntv-btn" disabled={sending || Boolean(preview) || !draft.trim()}>
              {sending ? "Enviando…" : parentId ? "Responder" : "Comentar"}
            </button>
          </div>
        </div>
      </div>

      {preview ? <p className="alert">{preview}</p> : null}
      {serverError && !preview ? <p className="alert">{serverError}</p> : null}
    </fetcher.Form>
  );
}

function CommentNode({
  comment,
  postSlug,
  user,
  isReply,
  replyingId,
  onReplyToggle,
  onCreated,
  onRemoved,
}: {
  comment: CommentItem;
  postSlug: string;
  user?: SessionUser | null;
  isReply?: boolean;
  replyingId: string | null;
  onReplyToggle: (id: string | null) => void;
  onCreated: (comment: CommentItem, parentId?: string) => void;
  onRemoved: (id: string) => void;
}) {
  const remover = useFetcher<CommentActionData>();

  useEffect(() => {
    if (remover.data?.removedId) onRemoved(remover.data.removedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remover.data]);

  const held = comment.status !== "published";

  return (
    <li className={`comment ${held ? "comment--held" : ""}`}>
      <Avatar name={comment.author.name} url={comment.author.avatarUrl} size={isReply ? 30 : 36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="comment__head">
          <strong className="comment__name">{comment.author.name}</strong>
          {comment.replyingTo ? (
            <span className="comment__replyingto">respondendo a {comment.replyingTo}</span>
          ) : null}
          <span className="ntv-meta">{timeAgo(comment.createdAt)}</span>
          {held ? <span className="ntv-badge ntv-badge--warning">Não publicado</span> : null}
          {comment.mine ? (
            <remover.Form method="post" action="/api/comentar" style={{ marginLeft: "auto" }}>
              <input type="hidden" name="intent" value="remove" />
              <input type="hidden" name="id" value={comment.id} />
              <button className="linkbtn" type="submit">
                Excluir
              </button>
            </remover.Form>
          ) : null}
        </div>

        <p className="comment__body">{comment.body}</p>

        {held ? (
          <p className="ntv-meta">
            Este comentário não passou na moderação e só é visível para você.
          </p>
        ) : (
          <div className="comment__actions">
            {user ? (
              <button
                className="linkbtn"
                onClick={() => onReplyToggle(replyingId === comment.id ? null : comment.id)}
              >
                {replyingId === comment.id ? "Fechar" : "Responder"}
              </button>
            ) : (
              <Link className="linkbtn" to="/entrar?motivo=comentario">
                Responder
              </Link>
            )}
          </div>
        )}

        {user && replyingId === comment.id ? (
          <CommentForm
            postSlug={postSlug}
            user={user}
            parentId={comment.id}
            autoFocus
            placeholder={`Responder a ${comment.author.name}…`}
            onCancel={() => onReplyToggle(null)}
            onCreated={onCreated}
          />
        ) : null}

        {comment.replies?.length ? (
          <ol className="comments__list comments__list--replies">
            {comment.replies.map((reply) => (
              <CommentNode
                key={reply.id}
                comment={reply}
                postSlug={postSlug}
                user={user}
                isReply
                replyingId={replyingId}
                onReplyToggle={onReplyToggle}
                onCreated={onCreated}
                onRemoved={onRemoved}
              />
            ))}
          </ol>
        ) : null}
      </div>
    </li>
  );
}

export function Comments({
  postSlug,
  user,
  initial,
  total,
}: {
  postSlug: string;
  user?: SessionUser | null;
  initial: CommentItem[];
  total: number;
}) {
  const location = useLocation();
  const [items, setItems] = useState(initial);
  const [count, setCount] = useState(total);
  const [replyingId, setReplyingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
    setCount(total);
  }, [initial, total]);

  function handleCreated(comment: CommentItem, parentId?: string) {
    setCount((value) => value + 1);
    setReplyingId(null);

    if (!parentId) {
      setItems((prev) => [{ ...comment, replies: [] }, ...prev]);
      return;
    }
    // A API achata em um nível: a resposta entra sob a raiz indicada por parentId.
    const rootId = comment.parentId ?? parentId;
    setItems((prev) =>
      prev.map((root) =>
        root.id === rootId ? { ...root, replies: [...(root.replies ?? []), comment] } : root,
      ),
    );
  }

  function handleRemoved(id: string) {
    setItems((prev) =>
      prev
        .filter((root) => root.id !== id)
        .map((root) => ({ ...root, replies: (root.replies ?? []).filter((r) => r.id !== id) })),
    );
    setCount((value) => Math.max(0, value - 1));
  }

  return (
    <section className="comments" id="comentarios">
      <div className="section__head">
        <span className="section__rule" />
        <h2 className="section__title">
          Comentários {count ? <span className="comments__count">{count}</span> : null}
        </h2>
      </div>

      {user ? (
        <CommentForm
          postSlug={postSlug}
          user={user}
          placeholder="Comente sobre a notícia…"
          onCreated={handleCreated}
        />
      ) : (
        <div className="comments__login">
          <p>
            <strong>Entre na sua conta para comentar.</strong>
            <br />
            <span className="ntv-meta">
              É a mesma conta da Loja NTV — vale para comentários e enquetes.
            </span>
          </p>
          <Link
            className="ntv-btn"
            to={`/entrar?voltar=${encodeURIComponent(`${location.pathname}#comentarios`)}`}
          >
            Entrar
          </Link>
          <Link className="ntv-btn ntv-btn--outline" to="/inscricao">
            Criar conta
          </Link>
        </div>
      )}

      <ol className="comments__list">
        {items.map((comment) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            postSlug={postSlug}
            user={user}
            replyingId={replyingId}
            onReplyToggle={setReplyingId}
            onCreated={handleCreated}
            onRemoved={handleRemoved}
          />
        ))}
      </ol>

      {!items.length ? (
        <p className="ntv-meta" style={{ padding: "16px 0" }}>
          Nenhum comentário ainda. Seja o primeiro.
        </p>
      ) : null}
    </section>
  );
}
