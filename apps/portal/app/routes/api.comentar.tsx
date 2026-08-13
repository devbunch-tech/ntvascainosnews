import { redirect, type ActionFunctionArgs } from "react-router";
import { gql, GraphQLRequestError } from "~/lib/graphql.server";
import { ADD_COMMENT_MUTATION, REMOVE_COMMENT_MUTATION } from "~/lib/queries";

/** Publica ou remove comentário. Exige sessão — sem token, manda para o login. */
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "create");

  try {
    if (intent === "remove") {
      const id = String(form.get("id") ?? "");
      await gql(REMOVE_COMMENT_MUTATION, { variables: { id }, request });
      return { removedId: id };
    }

    const data = await gql<{
      addComment: { ok: boolean; error?: string | null; category?: string | null; comment: unknown };
    }>(ADD_COMMENT_MUTATION, {
      request,
      variables: {
        postSlug: String(form.get("postSlug") ?? ""),
        body: String(form.get("body") ?? ""),
        parentId: form.get("parentId") ? String(form.get("parentId")) : null,
      },
    });
    return data.addComment;
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.code === "UNAUTHENTICATED") {
      throw redirect("/entrar?motivo=comentario");
    }
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível comentar." };
  }
}
