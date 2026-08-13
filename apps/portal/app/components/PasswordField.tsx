import { useState } from "react";

export function PasswordField({
  name,
  label,
  autoComplete = "current-password",
}: {
  name: string;
  label: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="password">
        <input
          id={name}
          className="ntv-input"
          type={show ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          minLength={6}
        />
        <button type="button" onClick={() => setShow((v) => !v)}>
          {show ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}
