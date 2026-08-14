import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { MAX_AD_LIMIT } from "@ntv/shared";
import { SAVE_SIDEBAR } from "../lib/queries";
import { Field, Toggle } from "./ui";

export interface SidebarWidget {
  key: string;
  label: string;
  visible: boolean;
}

/**
 * Ordem e visibilidade dos widgets da sidebar.
 *
 * Arrastar **e** setas de propósito: o painel é mobile-first, e arrastar não
 * funciona no toque sem uma biblioteca de gestos. As setas são o caminho que
 * sempre funciona — inclusive por teclado; o arraste é o atalho no desktop.
 */
export function SidebarConfig({
  widgets: initial,
  adLimit: initialAdLimit,
  onSaved,
}: {
  widgets: SidebarWidget[];
  adLimit: number;
  onSaved: () => void;
}) {
  const [saveSidebar, { loading }] = useMutation(SAVE_SIDEBAR);
  const [widgets, setWidgets] = useState<SidebarWidget[]>(initial);
  const [adLimit, setAdLimit] = useState(String(initialAdLimit));
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // A lista vem do servidor já resolvida (widget novo do código entra sozinho).
  useEffect(() => {
    setWidgets(initial);
    setAdLimit(String(initialAdLimit));
  }, [initial, initialAdLimit]);

  function move(from: number, to: number) {
    if (to < 0 || to >= widgets.length || from === to) return;
    const next = [...widgets];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setWidgets(next);
    setMessage(null);
  }

  function toggle(key: string, visible: boolean) {
    setWidgets((prev) => prev.map((w) => (w.key === key ? { ...w, visible } : w)));
    setMessage(null);
  }

  async function save() {
    await saveSidebar({
      variables: {
        widgets: widgets.map((w) => ({ key: w.key, visible: w.visible })),
        adLimit: Number(adLimit) || 0,
      },
    });
    setMessage("Sidebar atualizada.");
    onSaved();
  }

  const hidden = widgets.filter((w) => !w.visible).length;

  return (
    <section className="card" style={{ maxWidth: 620 }}>
      <h2 className="widget__title">Widgets da sidebar</h2>
      <p className="hint" style={{ marginTop: -4 }}>
        Vale para a home e para a página da matéria. Na matéria, “Últimas postagens”
        continua fixo no topo.
      </p>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <ol className="widgetlist">
        {widgets.map((widget, index) => (
          <li
            key={widget.key}
            className={`widgetlist__item ${dragOver === index ? "is-over" : ""} ${
              widget.visible ? "" : "is-hidden"
            }`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(index);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              move(Number(e.dataTransfer.getData("text/plain")), index);
              setDragOver(null);
            }}
          >
            <span className="widgetlist__grip" aria-hidden>
              ⠿
            </span>

            <span className="widgetlist__moves">
              <button
                type="button"
                className="linkbtn"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label={`Subir ${widget.label}`}
              >
                ↑
              </button>
              <button
                type="button"
                className="linkbtn"
                onClick={() => move(index, index + 1)}
                disabled={index === widgets.length - 1}
                aria-label={`Descer ${widget.label}`}
              >
                ↓
              </button>
            </span>

            {/* O rótulo vai no Toggle para o interruptor ter nome acessível. */}
            <Toggle
              label={widget.label}
              checked={widget.visible}
              onChange={(value) => toggle(widget.key, value)}
            />
          </li>
        ))}
      </ol>

      <p className="hint">
        {hidden ? `${hidden} widget(s) oculto(s).` : "Todos os widgets visíveis."}
      </p>

      <Field
        label="Campanhas exibidas na sidebar"
        hint={`Quantas peças de publicidade aparecem, das ativas e dentro do período. 0 esconde o espaço. Máximo ${MAX_AD_LIMIT}.`}
      >
        <input
          className="ntv-input"
          type="number"
          min={0}
          max={MAX_AD_LIMIT}
          value={adLimit}
          onChange={(e) => setAdLimit(e.target.value)}
          style={{ maxWidth: 120 }}
        />
      </Field>

      <button className="ntv-btn" onClick={save} disabled={loading}>
        {loading ? "Salvando…" : "Salvar sidebar"}
      </button>
    </section>
  );
}
