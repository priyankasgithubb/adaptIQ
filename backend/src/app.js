import express from "express";
import cors from "cors";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import subjectRoutes from "./routes/subjects.js";
import commitmentRoutes from "./routes/commitments.js";
import examRoutes from "./routes/exams.js";
import priorityRoutes from "./routes/priorities.js";
import planRoutes from "./routes/plan.js";
import mlRoutes from "./routes/ml.js";
import analyticsRoutes from "./routes/analytics.js";
import quizRoutes from "./routes/quizzes.js";
import reviewRoutes from "./routes/reviews.js";
import recommendationRoutes from "./routes/recommendations.js";
import calendarRoutes from "./routes/calendar.js";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./lib/db.js";


export function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

const PgSession = connectPgSimple(session);

  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
  app.use(express.json());

app.use(
  session({
    name: "adaptiq.sid",
    secret: process.env.SESSION_SECRET || "dev-only-secret",
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/subjects", subjectRoutes);
  app.use("/api/commitments", commitmentRoutes);
  app.use("/api/exams", examRoutes);
  app.use("/api/priorities", priorityRoutes);
  app.use("/api/plan", planRoutes);
  app.use("/api/ml", mlRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/quizzes", quizRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/recommendations", recommendationRoutes);
  app.use("/api/calendar", calendarRoutes);
  
  // Four parameters tell Express this is the error handler.
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}