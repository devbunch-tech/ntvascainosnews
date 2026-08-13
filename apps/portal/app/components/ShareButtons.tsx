import { useEffect, useState } from "react";
import { buildStoryCard } from "~/lib/storyCard";

/** Ícones inline (24×24, currentColor) — sem dependência de icon pack. */
const ICONS = {
  facebook: (
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.77-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
  ),
  instagram: (
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0 5.18a4.66 4.66 0 1 0 0 9.32 4.66 4.66 0 0 0 0-9.32Zm0 7.69a3.03 3.03 0 1 1 0-6.06 3.03 3.03 0 0 1 0 6.06Zm5.93-7.87a1.09 1.09 0 1 1-2.18 0 1.09 1.09 0 0 1 2.18 0Z" />
  ),
  whatsapp: (
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35ZM12.05 21.8h-.01a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.78 9.78 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.81-9.8a9.75 9.75 0 0 1 6.93 2.88 9.73 9.73 0 0 1 2.87 6.93c0 5.4-4.4 9.8-9.8 9.8Zm8.34-18.14A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.07 1.56 5.85L.25 24l6.6-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28Z" />
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden focusable="false">
      {ICONS[name]}
    </svg>
  );
}

export interface ShareData {
  title: string;
  category: string;
  coverImage?: string | null;
  coverCredit?: string | null;
  /** URL absoluta e pública do post — é o que o Facebook rasteja. */
  url: string;
  apiUrl: string;
}

export function ShareButtons(share: ShareData) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // `navigator.share` só existe no cliente; checar no efeito evita erro de hidratação.
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  function openWindow(target: string) {
    window.open(target, "_blank", "noopener,noreferrer,width=660,height=580");
  }

  async function shareInstagram() {
    // No celular a folha nativa lista o Instagram — é o caminho de um toque.
    if (canNativeShare) {
      try {
        await navigator.share({ title: share.title, url: share.url });
        return;
      } catch (error) {
        // Cancelar não é erro; qualquer outra falha cai no card de story.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setStoryOpen(true);
  }

  return (
    <div className="share">
      <span className="share__label">Compartilhar</span>

      <button
        type="button"
        className="share__btn"
        aria-label="Compartilhar no Facebook"
        title="Facebook"
        onClick={() =>
          openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share.url)}`)
        }
      >
        <Icon name="facebook" />
      </button>

      <button
        type="button"
        className="share__btn"
        aria-label="Compartilhar no Instagram"
        title="Instagram"
        onClick={shareInstagram}
      >
        <Icon name="instagram" />
      </button>

      <button
        type="button"
        className="share__btn"
        aria-label="Compartilhar no WhatsApp"
        title="WhatsApp"
        onClick={() =>
          openWindow(
            `https://api.whatsapp.com/send?text=${encodeURIComponent(`${share.title} ${share.url}`)}`,
          )
        }
      >
        <Icon name="whatsapp" />
      </button>

      {storyOpen ? <StoryModal share={share} onClose={() => setStoryOpen(false)} /> : null}
    </div>
  );
}

/**
 * Fluxo de Instagram no desktop: o Instagram não publica link de terceiro por URL,
 * então geramos o card de story pronto para postar e copiamos o link para o sticker.
 */
function StoryModal({ share, onClose }: { share: ShareData; onClose: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    buildStoryCard({
      title: share.title,
      category: share.category,
      credit: share.coverCredit,
      imageUrl: share.coverImage,
      apiUrl: share.apiUrl,
    })
      .then((generated) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(generated);
        setBlob(generated);
        setPreview(objectUrl);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Falha ao gerar a imagem."));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [share]);

  function download() {
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "ntv-news-story.png";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      setError("Não foi possível copiar. Copie da barra de endereço.");
    }
  }

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="Compartilhar no Instagram" onClick={onClose}>
      <div className="modal story" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          Compartilhar no Instagram
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="modal__body">
          <div className="story__preview">
            {preview ? (
              <img src={preview} alt="Prévia do card para o story" />
            ) : error ? (
              <p className="alert">{error}</p>
            ) : (
              <p className="ntv-meta">Gerando o card…</p>
            )}
          </div>

          <ol className="story__steps">
            <li>Baixe o card abaixo.</li>
            <li>Poste no seu story e use o sticker de link.</li>
            <li>Cole o link do post — ele já vai copiado.</li>
          </ol>

          <div className="story__actions">
            <button className="ntv-btn" onClick={download} disabled={!blob}>
              Baixar card
            </button>
            <button className="ntv-btn ntv-btn--outline" onClick={copyLink}>
              {copied ? "Link copiado ✓" : "Copiar link"}
            </button>
          </div>

          <p className="modal__note">
            O Instagram não permite publicar link de terceiro direto do navegador — este é o
            caminho oficial. No celular, o botão abre a folha de compartilhamento do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
