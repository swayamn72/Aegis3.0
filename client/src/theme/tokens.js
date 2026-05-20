/**
 * Aegis Design Tokens
 * Mirrored from mobile spec for cross-platform consistency.
 */

export const THEME_COLORS = {
  // Brand Colors
  primary: {
    orange: '#fb923c', // orange-400
    red: '#ef4444',    // red-500
    amber: '#d97706',  // amber-600
  },
  
  // Backgrounds
  bg: {
    dark: '#0c0a09',   // amber-950
    card: '#1c1917',   // stone-900
    surface: '#292524', // stone-800
  },
  
  // Gradients (Tailwind-compatible strings)
  gradients: {
    aegis: 'bg-gradient-to-br from-orange-400 via-red-500 to-amber-600',
    dark: 'bg-gradient-to-br from-stone-900 to-stone-950',
    neon: 'bg-gradient-to-r from-orange-500 to-red-600',
  },
  
  // UI States
  status: {
    success: '#22c55e',
    warning: '#eab308',
    error: '#ef4444',
    info: '#3b82f6',
  }
};

export const SPACING = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};

export const ANIMATIONS = {
  duration: '200ms',
  timing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  fadeScale: 'transition-all duration-200 ease-out transform',
};

export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
};
