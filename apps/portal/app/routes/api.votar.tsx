import { data, type ActionFunctionArgs } from "react-router";
import { gql } from "~/lib/graphql.server";
import { VOTE_MUTATION } from "~/lib/queries";
import { getVoterId, voterCookie } from "~/lib/voter.server";

/**
 * Voto na enquete — **sem exigir login**. A dedupe é por conta (quando logada)
 * ou pelo cookie anônimo, criado aqui na primeira votação.
 */
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const pollId = String(form.get("pollId") ?? "");
  const choice = String(form.get("choice") ?? "");

  if (!pollId || !["good", "bad"].includes(choice)) {
    return { error: "Voto inválido." };
  }

  const voter = await getVoterId(request);
  // O cookie só precisa ser gravado na primeira vez.
  const init = voter.isNew
    ? { headers: { "Set-Cookie": await voterCookie.serialize(voter.id) } }
    : undefined;

  try {
    const result = await gql<{
      votePoll: { id: string; goodPercent: number; totalVotes: number; myVote: string };
    }>(VOTE_MUTATION, { variables: { pollId, choice }, request, voterId: voter.id });

    return data(result.votePoll, init);
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Não foi possível votar." },
      init,
    );
  }
}
