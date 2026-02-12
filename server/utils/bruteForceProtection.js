import { AUTH_CONSTANTS } from '../config/constants.js';

/**
 * Checks if account is locked due to too many failed login attempts
 * @param {Object} user - User document (Player or Organization)
 * @returns {Object|null} - Error response object if locked, null if not locked
 */
export const checkAccountLock = (user) => {
    if (user.lockUntil && user.lockUntil > Date.now()) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
        return {
            status: 423,
            message: `Account temporarily locked due to too many failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
            locked: true,
            lockUntil: user.lockUntil
        };
    }
    return null;
};

/**
 * Increments login attempts and locks account if threshold exceeded
 * @param {Object} user - User document (Player or Organization)
 */
export const incrementLoginAttempts = async (user) => {
    const updates = {
        $inc: { loginAttempts: 1 }
    };

    // Lock account if max attempts reached
    if (user.loginAttempts + 1 >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
        updates.$set = {
            lockUntil: new Date(Date.now() + AUTH_CONSTANTS.LOCK_TIME)
        };
    }

    await user.updateOne(updates);
};

/**
 * Resets login attempts and unlocks account on successful login
 * @param {Object} user - User document (Player or Organization)
 */
export const resetLoginAttempts = async (user) => {
    // Only update if there are attempts or a lock
    if (user.loginAttempts > 0 || user.lockUntil) {
        await user.updateOne({
            $set: {
                loginAttempts: 0
            },
            $unset: {
                lockUntil: 1
            }
        });
    }
};
