/**
 * Game Registry — Single Source of Truth
 *
 * Every game-specific enum, constant, and configuration lives here.
 * Schemas, routes, and UI components import from this registry
 * instead of hardcoding game-specific values.
 *
 * RATING ARCHITECTURE:
 *   aegisRating = PLATFORM-WIDE headline rating = max(BGMI rating, valRating, ...)
 *   - BGMI writes directly to aegisRating (for BGMI-only players, it IS their rating)
 *   - Valorant writes to valRating, then promotes to aegisRating via $max
 *   - A player likely competes in only 1 game, so aegisRating ≈ their game rating
 *
 * To add a new game: add a config block below and update SUPPORTED_GAMES.
 */

// ─── BGMI ────────────────────────────────────────────────────────────────────
const BGMI = {
  key: 'BGMI',
  displayName: 'BGMI',
  type: 'battle_royale',

  // Team & Match Structure
  teamSize: 4,            // core players per roster (IGL, Assaulter, etc.)
  maxRosterSize: 5,       // max members on platform team (no subs slot)
  maxTeamsPerMatch: 25,   // BR lobby size
  matchFormat: '1vAll',   // all teams in one lobby

  // Maps
  maps: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'],

  // Roles
  roles: ['IGL', 'Assaulter', 'Fragger', 'Support', 'Sniper', 'Substitute', 'Player', 'Coach'],

  // Tournament Formats
  formats: ['Battle Royale Points System', 'Elimination Format', 'Custom'],
  gameModes: ['TPP Squad', 'FPP Squad', 'Custom'],

  // Phase Types
  phaseTypes: ['qualifiers', 'final_stage'],

  // Scoring — placement points
  scoring: {
    positionPoints: {
      1: 10, 2: 6, 3: 5, 4: 4, 5: 3,
      6: 2, 7: 1, 8: 1, 9: 0, 10: 0,
    },
    killPointValue: 1,
    hasChickenDinner: true,
    winCondition: 'last_team_standing',
  },

  // Fantasy (active for BGMI)
  fantasy: {
    enabled: true,
    squadSize: 4,
    maxFromSameTeam: 2,
    budgetCap: 100,
    scoringDefaults: {
      killPoints: 1,
      threeKillBonus: 1,
      fiveKillBonus: 2,
      chickenDinner: 5,
      topThree: 3,
      topFive: 2,
      topEight: 1,
      zeroKillPenalty: -1,
      captainMultiplier: 2,
      viceCaptainMultiplier: 1.5,
    },
  },

  // Result schema variant
  resultField: 'results',   // field name on Match document
  ocrSupported: true,

  // Rating config
  // BGMI writes DIRECTLY to aegisRating (the platform headline rating).
  // For BGMI-only players, aegisRating IS their BGMI rating.
  rating: {
    ratingField: 'aegisRating',
    peakField: 'aegisRatingPeak',
    floorField: 'aegisRatingFloor',
    matchesField: 'aegisMatchesRated',
    provisionalField: 'aegisIsProvisional',
    lastRatedField: 'aegisLastRatedMatchAt',
    defaultRating: 1000,
    provisionalThreshold: 20,
  },

  // Stats field on Player/Team
  statsField: 'statistics',
};

// ─── VALORANT ────────────────────────────────────────────────────────────────
const VALORANT = {
  key: 'VALORANT',
  displayName: 'Valorant',
  type: 'tactical_shooter',

  // Team & Match Structure
  teamSize: 5,
  maxRosterSize: 6,       // 5 starters + 1 sub
  maxTeamsPerMatch: 2,    // head-to-head
  matchFormat: '1v1',

  // Maps
  maps: [
    'Ascent', 'Bind', 'Haven', 'Split', 'Icebox',
    'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss',
  ],

  // Roles
  roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex', 'IGL', 'Substitute', 'Coach'],

  // Agents (updated — includes all 28 playable agents as of 2026)
  agents: [
    'Jett', 'Raze', 'Reyna', 'Phoenix', 'Neon', 'Yoru', 'Iso', 'Waylay',       // Duelists
    'Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko', 'Tejo',                // Initiators
    'Brimstone', 'Omen', 'Astra', 'Viper', 'Harbor', 'Clove', 'Miks',           // Controllers
    'Sage', 'Cypher', 'Killjoy', 'Chamber', 'Deadlock', 'Vyse', 'Veto',         // Sentinels
  ],

  // External API for dynamic agent/map images (free, no key required)
  agentImageApi: 'https://valorant-api.com/v1/agents?isPlayableCharacter=true',
  mapImageApi: 'https://valorant-api.com/v1/maps',

  // Tournament Formats
  formats: ['Best of 1', 'Best of 3', 'Best of 5', 'Round Robin', 'Swiss', 'Double Elimination', 'Custom'],
  gameModes: ['Standard', 'Custom'],

  // Phase Types
  phaseTypes: ['qualifiers', 'group_stage', 'playoffs', 'final_stage'],

  // VCT-style phase presets based on slot count
  phaseSuggestions: {
    8: [
      { name: 'Quarter Finals', format: 'Best of 1', type: 'playoffs' },
      { name: 'Semi Finals', format: 'Best of 3', type: 'playoffs' },
      { name: 'Grand Final', format: 'Best of 5', type: 'final_stage' },
    ],
    16: [
      { name: 'Swiss Stage', format: 'Swiss', type: 'qualifiers', rounds: 5 },
      { name: 'Playoffs', format: 'Double Elimination', type: 'playoffs' },
      { name: 'Grand Final', format: 'Best of 5', type: 'final_stage' },
    ],
    32: [
      { name: 'Open Qualifier', format: 'Best of 1', type: 'qualifiers' },
      { name: 'Swiss Stage', format: 'Swiss', type: 'group_stage', rounds: 5 },
      { name: 'Playoffs', format: 'Double Elimination', type: 'playoffs' },
      { name: 'Grand Final', format: 'Best of 5', type: 'final_stage' },
    ],
  },

  // Map Veto config — sequences define ban/pick order per best-of format
  // Each step alternates between teamA (even index) and teamB (odd index)
  mapVeto: {
    enabled: true,
    timerSeconds: 30,  // auto-random if team doesn't act
    sequences: {
      // Bo1: ban-ban-ban-ban-ban-ban-pick (remaining)
      1: ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'decider'],
      // Bo3: ban-ban-pick-pick-ban-ban-decider
      3: ['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'decider'],
      // Bo5: ban-ban-pick-pick-pick-pick-decider
      5: ['ban', 'ban', 'pick', 'pick', 'pick', 'pick', 'decider'],
    },
  },

  // Match Room — real-time chat per match
  matchRoom: {
    enabled: true,
    maxMessageLength: 500,
  },

  // Scoring — round-based
  scoring: {
    roundsToWin: 13,
    hasOvertime: true,
    overtimeRounds: 2,     // each OT set = 2 rounds
    winCondition: 'rounds_won',
    killPointValue: 0,     // not used for placement, used for individual stats
    // Standings point values
    winPoints: 3,
    lossPoints: 0,
  },

  // Swiss-specific config
  swiss: {
    winsToAdvance: 3,
    lossesToEliminate: 3,
    useBuchholz: true,       // Buchholz tiebreaker for Swiss
    useOpponentStrength: true, // pair teams with similar W-L records
  },

  // Fantasy (disabled for now)
  fantasy: {
    enabled: false,
    squadSize: 5,
    maxFromSameTeam: 2,
    budgetCap: 100,
    scoringDefaults: {
      killPoints: 0.5,
      assistPoints: 0.25,
      deathPenalty: -0.2,
      clutchBonus: 3,
      aceBonus: 5,
      firstKillBonus: 0.5,
      captainMultiplier: 2,
      viceCaptainMultiplier: 1.5,
    },
  },

  // Result schema variant
  resultField: 'vsResults',  // field name on Match document
  ocrSupported: true,        // Valorant OCR now supported

  // Rating config
  // Valorant writes to valRating, then promotes to aegisRating via $max
  // so a top Valorant player's headline aegisRating matches their valRating.
  rating: {
    ratingField: 'valRating',
    peakField: 'valRatingPeak',
    floorField: 'valRatingFloor',
    matchesField: 'valMatchesRated',
    provisionalField: 'valIsProvisional',
    lastRatedField: 'valLastRatedMatchAt',
    defaultRating: 1000,
    provisionalThreshold: 20,
  },

  // Stats field on Player/Team
  statsField: 'valorantStats',
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const GAME_REGISTRY = {
  BGMI,
  VALORANT,
};

/** All supported game keys */
export const SUPPORTED_GAMES = Object.keys(GAME_REGISTRY);

/** Get config for a game. Returns undefined if game not found. */
export function getGameConfig(gameTitle) {
  return GAME_REGISTRY[gameTitle];
}

/** Get all maps for a game */
export function getGameMaps(gameTitle) {
  return GAME_REGISTRY[gameTitle]?.maps || [];
}

/** Get all roles for a game */
export function getGameRoles(gameTitle) {
  return GAME_REGISTRY[gameTitle]?.roles || [];
}

/** Get all roles across ALL games (for schema enums) */
export function getAllRoles() {
  const roles = new Set();
  for (const game of Object.values(GAME_REGISTRY)) {
    game.roles.forEach(r => roles.add(r));
  }
  return [...roles];
}

/** Get all maps across ALL games (for schema validation) */
export function getAllMaps() {
  const maps = new Set();
  for (const game of Object.values(GAME_REGISTRY)) {
    game.maps.forEach(m => maps.add(m));
  }
  return [...maps];
}

/** Get all formats across ALL games */
export function getAllFormats() {
  const formats = new Set();
  for (const game of Object.values(GAME_REGISTRY)) {
    game.formats.forEach(f => formats.add(f));
  }
  return [...formats];
}

/** Validate a map name against a specific game */
export function isValidMap(gameTitle, mapName) {
  const config = GAME_REGISTRY[gameTitle];
  if (!config) return false;
  return config.maps.includes(mapName);
}

/** Check if a game supports OCR */
export function supportsOcr(gameTitle) {
  return GAME_REGISTRY[gameTitle]?.ocrSupported === true;
}

/** Check if a game supports fantasy */
export function supportsFantasy(gameTitle) {
  return GAME_REGISTRY[gameTitle]?.fantasy?.enabled === true;
}

/** Is the game a 1v1 (head-to-head) format? */
export function isHeadToHead(gameTitle) {
  return GAME_REGISTRY[gameTitle]?.matchFormat === '1v1';
}

/** Is the game battle royale (multi-team lobby)? */
export function isBattleRoyale(gameTitle) {
  return GAME_REGISTRY[gameTitle]?.matchFormat === '1vAll';
}

export default GAME_REGISTRY;
