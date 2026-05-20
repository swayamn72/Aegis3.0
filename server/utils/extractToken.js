/**
 * Extracts a JWT token from the request.
 * Priority: httpOnly cookie → Authorization Bearer header.
 *
 * @param {import('express').Request} req
 * @returns {string|null} The raw token string, or null if not found.
 */
const parseCookieHeader = (cookieHeader) => {
    if (!cookieHeader || typeof cookieHeader !== 'string') return {};
    return Object.fromEntries(
        cookieHeader.split(';').map((part) => {
            const idx = part.indexOf('=');
            if (idx === -1) return [part.trim(), ''];
            const key = part.slice(0, idx).trim();
            const value = part.slice(idx + 1).trim();
            try {
                return [key, decodeURIComponent(value)];
            } catch {
                return [key, value];
            }
        })
    );
};

const extractToken = (req) => {
    if (req.cookies?.token) {
        return req.cookies.token;
    }
    const authHeader = req.header?.('Authorization') ?? req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
};

/** Extract JWT from Socket.IO handshake (cookie, auth payload, or Authorization). */
export const extractSocketToken = (socket) => {
    const cookies = parseCookieHeader(socket.handshake?.headers?.cookie);
    if (cookies.token) return cookies.token;
    if (socket.handshake?.auth?.token) return socket.handshake.auth.token;
    const authHeader = socket.handshake?.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return null;
};

export default extractToken;
