import process from "node:process";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./services/prisma";

const app = createApp();

async function startServer(): Promise<void> {
  const dbUrl = new URL(env.databaseUrl);
  try {
    console.log(`Connecting to database at ${dbUrl.host}...`);
    await prisma.$connect();
    console.log(`Database connection established (${dbUrl.host}/${dbUrl.pathname.replace("/", "")})`);
  } catch (error) {
    console.error("Failed to connect to the database", error);
    process.exitCode = 1;
    return;
  }

  const server = app.listen(env.port, () => {
    console.log(`API ready on http://localhost:${env.port}`);
    console.log(`Primary frontend origin: ${env.frontendAppUrl}`);
    console.log(`OAuth redirect URI: ${env.googleRedirectUri}`);
  });

  const shutdown = async () => {
    console.log("Shutting down server...");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void startServer();
