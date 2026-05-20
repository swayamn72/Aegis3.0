/** API origin: use Vite proxy in dev (empty string) so httpOnly cookies work. */
export const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '' : 'http://localhost:5000');

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;
