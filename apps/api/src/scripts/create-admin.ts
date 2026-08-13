/**
 * Cria (ou promove) um administrador real.
 *
 *   npm run admin:create -- "Leo Lacerda" leo@dominio.com.br senhaForte123
 *
 * Se o e-mail já existir, o script promove a conta a admin e atualiza a senha.
 */
import { connectDB, disconnectDB } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import { User } from "../models/User.js";

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('Uso: npm run admin:create -- "Nome Completo" email@dominio.com senha');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Use uma senha de pelo menos 8 caracteres.");
  process.exit(1);
}

await connectDB();

const passwordHash = await hashPassword(password);
const existing = await User.findOne({ email: email.toLowerCase() });

if (existing) {
  existing.name = name;
  existing.role = "admin";
  existing.passwordHash = passwordHash;
  existing.invitePending = false;
  await existing.save();
  console.log(`[admin] conta existente promovida a admin: ${email}`);
} else {
  await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "admin",
    invitePending: false,
  });
  console.log(`[admin] admin criado: ${email}`);
}

await disconnectDB();
