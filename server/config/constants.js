// Authentication constants
export const AUTH_CONSTANTS = {
    // Bcrypt configuration
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,

    // JWT expiration
    JWT_EXPIRY: '7d',
    JWT_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds

    // Verification code settings
    VERIFICATION_CODE_EXPIRY_MINUTES: {
        PLAYER: 5,
        ORGANIZATION: 10,
    },

    // Password reset settings
    PASSWORD_RESET_TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour in milliseconds
    PASSWORD_RESET_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes between reset requests

    // Rate limiting
    VERIFICATION_EMAIL_COOLDOWN_MS: 60 * 1000, // 1 minute
    MAX_VERIFICATION_ATTEMPTS: 5,

    // Login rate limiting
    LOGIN_RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    LOGIN_RATE_LIMIT_MAX: 5,

    // Brute force protection
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 15 * 60 * 1000, // 15 minutes

    // Cookie settings
    COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
};
