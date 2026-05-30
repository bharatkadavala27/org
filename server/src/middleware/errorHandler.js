// Central error handler. Returns JSON {message}; never leaks stack in prod.

export function notFound(req, res, _next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  let message = err.message || 'Something went wrong';
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  } else if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (status >= 500) {
    console.error('[ERROR]', err.stack || err.message);
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
