import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import { notFound, errorHandler } from "./middleware/errorMiddleware";

interface CloudflareBindings {
  // DATABASE: D1Database;
  // KV_NAMESPACE: KVNamespace;
  // SECRET_KEY: string;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

const allowedOrigins = [
  "https://acadbud.vercel.app",
  "http://localhost:3000",
  "https://acadmate.in",
  "https://acadmate-fe.vercel.app",
];

app.use("*", logger());
app.use("*", secureHeaders());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Cache-Control", "Pragma"],
    credentials: true,
  })
);

app.get("/", (c) => {
  return c.text("Up nd Running on Cloudflare Workers!!");
});

app.route("/api", authRoutes);
app.route("/api", userRoutes);

app.notFound(notFound);
app.onError(errorHandler);

export default app;
