/** Escape user input for safe use inside MongoDB $regex / RegExp. */
export function escapeRegex(str) {
  if (str == null) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSafeRegex(str, flags = 'i') {
  const escaped = escapeRegex(str).slice(0, 100);
  return new RegExp(escaped, flags);
}
