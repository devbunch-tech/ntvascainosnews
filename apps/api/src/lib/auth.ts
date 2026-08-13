import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { can, type Role } from "@ntv/shared";
import { env } from "../env.js";
import { User } from "../models/User.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function signToken(user: { _id: unknown; email: string; name: string; role: string }) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name, role: user.role },
    env.jwtSecret,
    { expiresIn: "30d" },
  );
}

export async function userFromToken(token?: string | null): Promise<AuthUser | null> {
  if (!token) return null;
  const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
  try {
    const payload = jwt.verify(raw, env.jwtSecret) as jwt.JwtPayload;
    const doc = await User.findById(payload.sub).lean();
    if (!doc) return null;
    return {
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      role: doc.role as Role,
    };
  } catch {
    return null;
  }
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new GraphQLError("Não autenticado.", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return user;
}

export function requirePermission(user: AuthUser | null, permission: string): AuthUser {
  const authed = requireAuth(user);
  if (!can(authed.role, permission)) {
    throw new GraphQLError("Sem permissão para esta ação.", {
      extensions: { code: "FORBIDDEN", permission },
    });
  }
  return authed;
}
