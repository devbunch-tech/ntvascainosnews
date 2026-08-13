import mongoose from "mongoose";
import { env } from "./env.js";

let connected = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (connected) return mongoose;
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  connected = true;
  console.log(`[db] conectado em ${env.mongoUri}`);
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
