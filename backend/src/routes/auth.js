import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// POST /api/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 12);

    let user;
    try {
      const { rows } = await query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [email, passwordHash]
      );
      user = rows[0];
    } catch (err) {
      if (err.code === "23505") {  // unique violation: email already exists
        return res.status(409).json({ error: "This email is already registered" });
      }
      throw err;
    }

    req.session.userId = user.id;
    res.status(201).json({ user });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const { email, password } = parsed.data;

    const { rows } = await query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];

    // Same message for "no such email" and "wrong password", so attackers learn nothing.
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !passwordOk) {
      return res.status(401).json({ error: "Wrong email or password" });
    }

    // New session id on login blocks session-fixation attacks.
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );
    req.session.userId = user.id;
    res.json({ user: { id: user.id, email: user.email } });
  })
);

// POST /api/auth/logout
router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("adaptiq.sid");
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    // LEFT JOIN: the user, plus their profile if they have one.
    const { rows } = await query(
      `SELECT u.id, u.email, row_to_json(p) AS profile
         FROM users u
         LEFT JOIN learner_profiles p ON p.user_id = u.id
        WHERE u.id = $1`,
      [req.session.userId]
    );
    if (!rows[0]) return res.status(401).json({ error: "Please log in first" });
    res.json({ user: rows[0] });
  })
);

export default router;