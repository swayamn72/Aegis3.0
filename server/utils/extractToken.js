/**
 * Extracts a JWT token from the request.
 * Priority: httpOnly cookie → Authorization Bearer header.
 *
 * @param {import('express').Request} req
 * @returns {string|null} The raw token string, or null if not found.
 */
const extractToken = (req) => {
    if (req.cookies?.token) {
        return req.cookies.token;
    }
    const authHeader = req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7); // faster than replace()
    }
    return null;
};

export default extractToken;
