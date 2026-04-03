export const responseHelpers = (req, res, next) => {
    res.success = (payload = {}, status = 200) => {
        const isPlainObject =
            payload !== null &&
            typeof payload === 'object' &&
            !Array.isArray(payload);

        return res.status(status).json({
            ...(isPlainObject ? payload : { data: payload }),
            requestId: req.requestId,
        });
    };

    res.fail = (status, message, extras = {}) => {
        return res.status(status).json({
            message,
            requestId: req.requestId,
            ...extras,
        });
    };

    next();
};
