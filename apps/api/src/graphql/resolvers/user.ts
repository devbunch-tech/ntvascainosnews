import { GraphQLError } from "graphql";
import { User } from "../../models/User.js";
import { Poll } from "../../models/Poll.js";
import {
  hashPassword,
  requireAuth,
  requirePermission,
  signToken,
  verifyPassword,
} from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";

const badInput = (msg: string) =>
  new GraphQLError(msg, { extensions: { code: "BAD_USER_INPUT" } });

export const userResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      return User.findById(ctx.user.id).lean();
    },
    users: async (
      _: unknown,
      { search, role }: { search?: string; role?: string },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "users:manage");
      const q: Record<string, unknown> = {};
      if (role) q.role = role;
      if (search) q.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
      return User.find(q).sort({ createdAt: -1 }).lean();
    },
  },

  Mutation: {
    signup: async (
      _: unknown,
      {
        name,
        email,
        password,
        newsletter = true,
      }: { name: string; email: string; password: string; newsletter?: boolean },
    ) => {
      if (password.length < 6) throw badInput("A senha precisa ter ao menos 6 caracteres.");
      const existing = await User.findOne({ email: email.toLowerCase() }).lean();
      if (existing) throw badInput("Já existe uma conta com este e-mail.");
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        role: "reader",
        preferences: { newsletter, matchAlerts: false, shopNews: false },
        lastLoginAt: new Date(),
      });
      return { token: signToken(user), user: user.toObject() };
    },

    login: async (_: unknown, { email, password }: { email: string; password: string }) => {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        throw new GraphQLError("E-mail ou senha inválidos.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      user.lastLoginAt = new Date();
      user.invitePending = false;
      await user.save();
      return { token: signToken(user), user: user.toObject() };
    },

    updateProfile: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      const me = requireAuth(ctx.user);
      const data: Record<string, unknown> = {};
      for (const key of ["name", "avatarUrl", "bio"]) {
        if (input[key] !== undefined) data[key] = input[key];
      }
      if (input.email) data.email = String(input.email).toLowerCase();
      if (input.preferences) data.preferences = input.preferences;
      return User.findByIdAndUpdate(me.id, { $set: data }, { new: true }).lean();
    },

    changePassword: async (
      _: unknown,
      { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
      ctx: GraphQLContext,
    ) => {
      const me = requireAuth(ctx.user);
      if (newPassword.length < 6) throw badInput("A nova senha precisa ter ao menos 6 caracteres.");
      const user = await User.findById(me.id);
      if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
        throw badInput("Senha atual incorreta.");
      }
      user.passwordHash = await hashPassword(newPassword);
      await user.save();
      return true;
    },

    inviteUser: async (
      _: unknown,
      { name, email, role }: { name: string; email: string; role: string },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "users:manage");
      const existing = await User.findOne({ email: email.toLowerCase() }).lean();
      if (existing) throw badInput("Este e-mail já está cadastrado.");
      // Convite fica pendente até o primeiro login (define senha por link).
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        role,
        invitePending: true,
      });
      return user.toObject();
    },

    updateUserRole: async (
      _: unknown,
      { id, role }: { id: string; role: string },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "users:manage");
      return User.findByIdAndUpdate(id, { $set: { role } }, { new: true }).lean();
    },

    deleteUser: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const me = requirePermission(ctx.user, "users:manage");
      if (me.id === id) throw badInput("Você não pode excluir a própria conta.");
      await User.findByIdAndDelete(id);
      return true;
    },
  },

  User: {
    id: idField,
    preferences: (u: { preferences?: any }) => ({
      newsletter: u.preferences?.newsletter ?? false,
      matchAlerts: u.preferences?.matchAlerts ?? false,
      shopNews: u.preferences?.shopNews ?? false,
    }),
    pollVotes: async (u: { pollVotes?: any[] }) => {
      const votes = u.pollVotes ?? [];
      if (!votes.length) return [];
      const polls = await Poll.find({ _id: { $in: votes.map((v) => v.poll) } })
        .select("player")
        .lean();
      const byId = new Map(polls.map((p) => [String(p._id), p]));
      return votes.map((v) => ({
        pollId: String(v.poll),
        playerName: byId.get(String(v.poll))?.player?.name ?? "—",
        choice: v.choice,
        votedAt: v.votedAt,
      }));
    },
  },
};
