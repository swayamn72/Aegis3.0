import logger from '../config/logger.js';

// Async handler to wrap async route handlers and catch errors
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const errorPayload = (message, requestId, extras = {}) => ({
    message,
    requestId,
    ...extras,
});

// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
    const requestId = req?.requestId;
    logger.error('unhandled_request_error', {
        requestId,
        method: req?.method,
        path: req?.originalUrl,
        errorName: err?.name,
        errorMessage: err?.message,
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json(
            errorPayload('Validation error', requestId, { errors })
        );
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json(
            errorPayload(`${field} already exists`, requestId)
        );
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(
            errorPayload('Invalid token', requestId)
        );
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json(
            errorPayload('Token expired', requestId)
        );
    }

    // Custom error status
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json(
        errorPayload(message, requestId, {
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        })
    );
};
