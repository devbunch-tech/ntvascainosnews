import { useRef, useState } from "react";

const MAX_BYTES = 2 * 1024 * 1024;

/** Upload direto do browser para o endpoint /upload da API.
 *  Preview imediato + validação de 2 MB (README §Inscrição). */
export function AvatarUpload({
  apiUrl,
  name = "avatarUrl",
  initial,
  size = 88,
}: {
  apiUrl: string;
  name?: string;
  initial?: string | null;
  size?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initial ?? null);
  const [url, setUrl] = useState<string>(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) return setError("Arquivo maior que 2 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return setError("Envie JPG ou PNG.");
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${apiUrl}/upload`, { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Falha no upload.");
      setUrl(payload.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
      setPreview(initial ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avatarpick">
      <button
        type="button"
        className="avatarpick__circle"
        style={{ width: size, height: size }}
        onClick={() => input.current?.click()}
        aria-label="Enviar foto de perfil"
      >
        {preview ? <img src={preview} alt="" /> : <span style={{ fontSize: 22 }}>👤</span>}
        <span className="avatarpick__cam" aria-hidden>
          📷
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
        }}
      />
      <input type="hidden" name={name} value={url} />
      <span className="field__hint">{busy ? "Enviando…" : "JPG ou PNG, até 2 MB"}</span>
      {error ? <span className="alert">{error}</span> : null}
    </div>
  );
}
