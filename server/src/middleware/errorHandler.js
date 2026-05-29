// Central error handler. Returns JSON {message}; never leaks stack in prod.

export function notFound(req, res, _next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  // Mongoose validation / duplicate-key friendly messages.
  let message = err.message || 'Something went wrong';
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }

  if (!isProd && status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    message,
    ...(isProd ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}

// Wrap async route handlers so rejections hit the error handler.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Throw this for clean HTTP errors.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
