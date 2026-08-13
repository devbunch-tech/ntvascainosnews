import { useRef, useState, type ReactNode } from "react";
import { uploadFile } from "../lib/apollo";

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle">
      <span>
        <span className="toggle__label">{label}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" />
    </label>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    published: ["ntv-badge--success", "Publicado"],
    draft: ["ntv-badge--warning", "Rascunho"],
    scheduled: ["ntv-badge--mute", "Agendado"],
  };
  const [cls, label] = map[status] ?? ["ntv-badge--mute", status];
  return <span className={`ntv-badge ${cls}`}>{label}</span>;
}

/** Dropzone de imagem: clique ou arraste. Sobe pro /upload e devolve a URL. */
export function ImageDrop({
  value,
  onChange,
  label = "Arraste uma imagem ou clique para enviar",
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="dropzone"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handle(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? <img src={value} alt="" /> : null}
        {busy ? "Enviando…" : value ? "Trocar imagem" : label}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      {error ? <p className="alert">{error}</p> : null}
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="ntv-meta" style={{ padding: "16px 0" }}>
      {children}
    </p>
  );
}
