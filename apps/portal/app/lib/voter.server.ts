import { createCookie } from "react-router";

/**
 * Identidade anônima para a enquete.
 *
 * A votação não exige login: o que segura o clique repetido é este id, gravado
 * num cookie de um ano. Não é infalível — limpar o cookie ou abrir uma janela
 * anônima permite votar de novo — mas é a troca consciente por não pedir
 * cadastro. Quem está logado é identificado pela conta, não por isto.
 */
export const voterCookie = createCookie("ntv_voter", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
});

/** Id já gravado no cookie, ou `null`. **Não cria** um novo. */
export async function readVoterId(request: Request): Promise<string | null> {
  const existing = (await voterCookie.parse(request.headers.get("Cookie"))) as string | null;
  return typeof existing === "string" && existing.length >= 8 ? existing : null;
}

/**
 * Id do votante, criando um se ainda não houver.
 *
 * Só a action de voto usa isto. Se as leituras também criassem id, cada request
 * sem cookie geraria um id novo — e o voto acabaria gravado com um id diferente
 * do que o navegador guardou, deixando a pessoa votar de novo.
 */
export async function getVoterId(request: Request): Promise<{ id: string; isNew: boolean }> {
  const existing = await readVoterId(request);
  if (existing) return { id: existing, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}
