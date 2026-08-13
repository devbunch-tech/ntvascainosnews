import { DateTimeResolver } from "graphql-scalars";
import { postResolvers } from "./post.js";
import { productResolvers } from "./product.js";
import { userResolvers } from "./user.js";
import { pollResolvers } from "./poll.js";
import { homeResolvers } from "./home.js";
import { adminResolvers } from "./admin.js";
import { commentResolvers } from "./comment.js";
import { mediaResolvers } from "./media.js";

const modules = [
  postResolvers,
  productResolvers,
  userResolvers,
  pollResolvers,
  homeResolvers,
  adminResolvers,
  commentResolvers,
  mediaResolvers,
] as Record<string, any>[];

/** Merge raso por tipo — Query/Mutation acumulam campos de todos os módulos. */
function merge(mods: Record<string, any>[]) {
  const out: Record<string, any> = {};
  for (const mod of mods) {
    for (const [typeName, fields] of Object.entries(mod)) {
      out[typeName] = { ...(out[typeName] ?? {}), ...fields };
    }
  }
  return out;
}

export const resolvers = {
  DateTime: DateTimeResolver,
  ...merge(modules),
};
