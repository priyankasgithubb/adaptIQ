import express from "express";
import cors from "cors";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";

export function createApp() {
  const app = express();

  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
  app.use(express.json());

  app.use(
    session({
      name: "adaptiq.sid",
      secret: process.env.SESSION_SECRET || "dev-only-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,                                // JavaScript can't read the cookie
        sameSite: "lax",                               // helps block cross-site attacks
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        maxAge: 1000 * 60 * 60 * 24 * 7,               // 7 days
      },
    })
  );

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);

  // Four parameters tell Express this is the error handler.
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}