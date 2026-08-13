import { useEffect, useRef } from "react";
import { uploadFile } from "../lib/apollo";

const COMMANDS = [
  { label: "B", title: "Negrito", run: () => document.execCommand("bold") },
  { label: "I", title: "Itálico", run: () => document.execCommand("italic") },
  { label: "U", title: "Sublinhado", run: () => document.execCommand("underline") },
  { label: "H2", title: "Subtítulo", run: () => document.execCommand("formatBlock", false, "h2") },
  {
    label: "❝",
    title: "Citação",
    run: () => document.execCommand("formatBlock", false, "blockquote"),
  },
  { label: "•", title: "Lista", run: () => document.execCommand("insertUnorderedList") },
];

/** Editor rich-text mínimo sobre contentEditable — sem dependência externa.
 *  Emite HTML, que é o formato gravado em `posts.body`. */
export function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Só sincroniza de fora quando o conteúdo diverge (evita perder o cursor).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  async function insertImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      document.execCommand("insertHTML", false, `<img src="${url}" alt="" />`);
      emit();
    };
    input.click();
  }

  function insertLink() {
    const href = prompt("URL do link:");
    if (href) {
      document.execCommand("createLink", false, href);
      emit();
    }
  }

  function insertEmbed() {
    const url = prompt("URL do vídeo (YouTube) ou post para embutir:");
    if (!url) return;
    const youtube = /(?:youtu\.be\/|v=)([\w-]{11})/.exec(url)?.[1];
    const html = youtube
      ? `<p><iframe width="560" height="315" src="https://www.youtube.com/embed/${youtube}" frameborder="0" allowfullscreen></iframe></p>`
      : `<p><a href="${url}">${url}</a></p>`;
    document.execCommand("insertHTML", false, html);
    emit();
  }

  return (
    <>
      <div className="toolbar">
        {COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            type="button"
            title={cmd.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              cmd.run();
              emit();
            }}
          >
            {cmd.label}
          </button>
        ))}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertImage}>
          Imagem
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}>
          Link
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertEmbed}>
          Embed
        </button>
      </div>
      <div
        ref={ref}
        className="richtext"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
      />
    </>
  );
}
