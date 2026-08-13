import type { ActionFunctionArgs } from "react-router";
import { gql } from "~/lib/graphql.server";

const TRACK_AD_CLICK = /* GraphQL */ `
  mutation TrackAdClick($id: ID!) {
    trackAdClick(id: $id)
  }
`;

/** Contabiliza o clique no anúncio antes de o usuário sair para o anunciante. */
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false };
  try {
    await gql(TRACK_AD_CLICK, { variables: { id }, request });
  } catch {
    // Métrica não pode quebrar a navegação.
  }
  return { ok: true };
}
