import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { loadPriorities } from "../lib/loadPriorities.js";

const router = Router();
router.use(requireAuth);

// GET /api/priorities
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ priorities: await loadPriorities(req.session.userId) });
  })
);

export default router;