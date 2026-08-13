/** Tipos de domínio compartilhados entre API, admin e portal.
 *  Fonte da verdade do schema: apps/api/src/graphql/typeDefs.ts */
/** Permissões por papel — espelha o painel do admin (README §Usuários). */
export const PERMISSIONS = {
    admin: [
        "posts:write",
        "posts:delete-any",
        "featured:manage",
        "users:manage",
        "products:manage",
        "settings:manage",
        "rss:manage",
        "social:manage",
    ],
    editor: ["posts:write", "featured:manage", "products:manage"],
    reader: [],
};
export function can(role, permission) {
    if (!role)
        return false;
    return PERMISSIONS[role]?.includes(permission) ?? false;
}
