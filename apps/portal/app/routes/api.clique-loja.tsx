import type { ActionFunctionArgs } from "react-router";
import { gql } from "~/lib/graphql.server";
import { TRACK_CLICK_MUTATION } from "~/lib/queries";

/** Contabiliza o clique em "Comprar" antes de o usuário sair para o marketplace. */
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false };
  try {
    await gql(TRACK_CLICK_MUTATION, { variables: { id }, request });
  } catch {
    // Métrica não pode quebrar a navegação do usuário.
  }
  return { ok: true };
}
