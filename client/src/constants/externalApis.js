/**
 * externalApis.js — Third-party API constants
 *
 * All external API URLs and fallback image helpers live here.
 * Never hardcode these directly inside component files.
 */

// ─── Valorant ────────────────────────────────────────────────────────────────
export const VALORANT_API_BASE = 'https://valorant-api.com/v1';
export const VALORANT_MAPS_URL = `${VALORANT_API_BASE}/maps`;
export const VALORANT_AGENTS_URL = `${VALORANT_API_BASE}/agents?isPlayableCharacter=true`;

// ─── Fallback / Placeholder Images ───────────────────────────────────────────
const PLACEHOLDER_BASE = 'https://placehold.co';

/**
 * Returns a placehold.co URL for use when a real image is unavailable.
 * @param {string} size  e.g. '96x96', '1200x400'
 * @param {string} bg    background colour (hex without #), default '1a1a1a'
 * @param {string} fg    foreground colour (hex without #), default 'ffffff'
 * @param {string} text  label text
 */
export const placeholderImage = (size, bg = '1a1a1a', fg = 'ffffff', text = '') =>
  `${PLACEHOLDER_BASE}/${size}/${bg}/${fg}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

// Common preset helpers used across tournament & team UI
export const PLACEHOLDER_TOURNAMENT_BANNER = placeholderImage('1200x400', '1a1a1a', 'ffffff', 'Tournament Banner');
export const PLACEHOLDER_TOURNAMENT_LOGO  = placeholderImage('96x96',    '1a1a1a', 'ffffff', 'LOGO');
export const PLACEHOLDER_TEAM_LOGO_SM     = placeholderImage('32x32',    '27272a', '71717a');
export const PLACEHOLDER_TEAM_LOGO_MD     = placeholderImage('64x64',    '27272a', 'ffffff');
export const PLACEHOLDER_MATCH_MAP        = placeholderImage('64x56',    '1a1a1a', 'ffffff');
