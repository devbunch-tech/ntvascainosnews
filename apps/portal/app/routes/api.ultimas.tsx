import type { LoaderFunctionArgs } from "react-router";
import { gql } from "~/lib/graphql.server";
import { LATEST_PAGE_QUERY } from "~/lib/queries";

/** Resource route da paginação de "Últimas notícias". */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 12), 30);
  return gql(LATEST_PAGE_QUERY, { variables: { limit, offset }, request });
}
