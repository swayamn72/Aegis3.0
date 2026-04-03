const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const levelFromEnv = (process.env.LOG_LEVEL || 'info').toLowerCase();
const minLevel = LOG_LEVELS[levelFromEnv] ?? LOG_LEVELS.info;

const log = (level, message, meta = {}) => {
    if ((LOG_LEVELS[level] ?? 99) > minLevel) return;

    const payload = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...meta,
    };

    const line = JSON.stringify(payload);
    if (level === 'error') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    console.log(line);
};

export default {
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta),
};