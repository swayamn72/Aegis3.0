// Badge images are served from public/badges/ — use string paths, not imports
const ironBadge = '/badges/iron_badge.png';
const bronzeBadge = '/badges/bronze_badge.png';
const silverBadge = '/badges/silver_badge.png';
const goldBadge = '/badges/gold_badge.png';
const platinumBadge = '/badges/platinum_badge.png';
const diamondBadge = '/badges/diamond_badge.png';
const masterBadge = '/badges/master_badge.png';
const aegisBadge = '/badges/aegis_badge.png';

/**
 * Aegis Rating tier configuration.
 * Each tier has: name, color, tailwind classes, min rating, and badge image.
 */
const TIERS = [
  { tier: 'Aegis',    min: 4000, color: '#FF4500', bg: 'bg-[#FF4500]/15', border: 'border-[#FF4500]/40', textClass: 'text-[#FF4500]', badge: aegisBadge },
  { tier: 'Master',   min: 3800, color: '#a855f7', bg: 'bg-purple-500/15', border: 'border-purple-500/40', textClass: 'text-purple-400', badge: masterBadge },
  { tier: 'Diamond',  min: 3500, color: '#06b6d4', bg: 'bg-cyan-500/15',   border: 'border-cyan-500/40',   textClass: 'text-cyan-400',   badge: diamondBadge },
  { tier: 'Platinum', min: 3000, color: '#22d3ee', bg: 'bg-teal-500/15',   border: 'border-teal-500/40',   textClass: 'text-teal-300',   badge: platinumBadge },
  { tier: 'Gold',     min: 2400, color: '#eab308', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', textClass: 'text-yellow-400', badge: goldBadge },
  { tier: 'Silver',   min: 1800, color: '#a1a1aa', bg: 'bg-zinc-400/15',   border: 'border-zinc-400/40',   textClass: 'text-zinc-400',   badge: silverBadge },
  { tier: 'Bronze',   min: 1200, color: '#d97706', bg: 'bg-amber-500/15',  border: 'border-amber-500/40',  textClass: 'text-amber-400',  badge: bronzeBadge },
  { tier: 'Iron',     min: 0,    color: '#71717a', bg: 'bg-zinc-600/15',   border: 'border-zinc-600/40',   textClass: 'text-zinc-500',   badge: ironBadge },
];

/**
 * Get the rating badge info for a given rating value.
 * @param {number} rating
 * @returns {{ tier: string, color: string, bg: string, border: string, textClass: string, badge: string }}
 */
export const getRatingBadge = (rating = 1000) => {
  for (const t of TIERS) {
    if (rating >= t.min) return { ...t };
  }
  return { ...TIERS[TIERS.length - 1] };
};

/**
 * Format a rating delta for display.
 * @param {number} delta
 * @returns {{ text: string, className: string }}
 */
export const formatDelta = (delta) => {
  if (delta > 0) return { text: `+${delta}`, className: 'text-green-400' };
  if (delta < 0) return { text: `${delta}`, className: 'text-red-400' };
  return { text: '±0', className: 'text-zinc-500' };
};
