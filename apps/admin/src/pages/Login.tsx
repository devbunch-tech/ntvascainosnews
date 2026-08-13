import { useState } from "react";
import { useMutation } from "@apollo/client";
import { LOGIN } from "../lib/queries";
import { tokenStore } from "../lib/apollo";

export function Login() {
  const [login, { loading }] = useMutation(LOGIN);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const { data } = await login({
        variables: { email: form.get("email"), password: form.get("password") },
      });
      tokenStore.set(data.login.token);
      location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    }
  }

  return (
    <div className="loginpage">
      <form className="loginbox" onSubmit={onSubmit}>
        <img src="/assets/logo.svg" alt="NTV News" />
        <h1 className="page__title" style={{ fontSize: 18, marginBottom: 16 }}>
          Painel administrativo
        </h1>

        {error ? <p className="alert">{error}</p> : null}

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="ntv-input" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" className="ntv-input" name="password" type="password" required />
        </div>

        <button className="ntv-btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
