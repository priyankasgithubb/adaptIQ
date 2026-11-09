// Express 4 doesn't catch errors from async functions. This sends them to the error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
