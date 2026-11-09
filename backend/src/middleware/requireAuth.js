// Middleware runs before a route. No logged-in user id means 401.
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Please log in first" });
  }
  next();
}