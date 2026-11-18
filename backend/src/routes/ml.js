
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

const PLANNER_URL =
  process.env.PLANNER_URL || "http://127.0.0.1:8000";

// GET /api/ml/status
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    let response;

    try {
      response = await fetch(
        `${PLANNER_URL}/predict/status`,
        {
          signal: AbortSignal.timeout(5000),
        }
      );
    } catch {
      return res.status(503).json({
        available: false,
        error: "The prediction service is unavailable.",
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        available: false,
        error: "Could not retrieve prediction status.",
      });
    }

    const data = await response.json();

    res.json(data);
  })
);

// POST /api/ml/predict
router.post("/predict", (req, res) => {
  return res.status(503).json({
    available: false,
    error:
      "Academic predictions are not available until " +
      "the models are validated with genuine student data.",
  });
});

export default router;
