import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { logout } from "~/lib/session.server";

export const action = ({ request }: ActionFunctionArgs) => logout(request);
export const loader = ({ request }: LoaderFunctionArgs) => logout(request);
