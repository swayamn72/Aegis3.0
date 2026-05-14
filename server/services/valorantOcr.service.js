/**
 * valorantOcr.service.js
 *
 * Parses Valorant scoreboard screenshots using Tesseract.js.
 *
 * The Valorant end-screen layout is structured:
 *   - Header: "VICTORY / DEFEAT"  + round score "13 - 7"
 *   - Per-player rows: Name | Agent | ACS | K | D | A | +/- | ADR | ...
 *
 * We run OCR on the image, then use regex patterns to extract:
 *   1. Final score (roundsA vs roundsB)
 *   2. Per-player stats (kills, deaths, assists, ACS, ADR, agent)
 *
 * Confidence scoring is based on how many expected fields were found.
 */

import Tesseract from 'tesseract.js';
import logger from '../config/logger.js';

// Known Valorant agents for fuzzy agent detection
const KNOWN_AGENTS = [
  'Jett', 'Reyna', 'Phoenix', 'Yoru', 'Neon', 'Iso',
  'Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove',
  'Sage', 'Cypher', 'Killjoy', 'Chamber', 'Deadlock', 'Vyse',
  'Sova', 'Fade', 'Gekko', 'Skye', 'Breach', 'Kay/o', 'KAY/O',
  'Raze', 'Breach', 'Neon', 'Tejo', 'Waylay',
];

// Score header patterns: "13 – 7", "13-7", "13 : 7", "SCORE 13 7"
const SCORE_PATTERN = /\b(\d{1,2})\s*[-–:]\s*(\d{1,2})\b/;

// Stat row pattern: captures groups of numbers that look like K/D/A + ACS
// Valorant scoreboard cols roughly: ACS K D A FK FD ... ADR KAST
const STAT_LINE_PATTERN = /(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;

/**
 * Main OCR entry point.
 * @param {string} imageUrl — Cloudinary URL or local path of the screenshot
 * @returns {Promise<{confidence: number, parsedResult: object, rawText: string, errors: string[]}>}
 */
export async function parseValorantScoreboard(imageUrl) {
  const errors = [];
  let rawText = '';

  try {
    logger.info('ocr_start', { imageUrl });

    const { data } = await Tesseract.recognize(imageUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          // Optionally track progress; suppress for prod
        }
      },
    });

    rawText = data.text;
    logger.info('ocr_raw_text_length', { chars: rawText.length });

    const lines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    // ── 1. Extract score ─────────────────────────────────────────────────────
    let scoreA = null;
    let scoreB = null;
    let winner = null;

    for (const line of lines) {
      const m = line.match(SCORE_PATTERN);
      if (m) {
        const a = parseInt(m[1]);
        const b = parseInt(m[2]);
        // Sanity: Valorant maps go to 13, overtime max ~25
        if (a <= 25 && b <= 25 && (a >= 13 || b >= 13)) {
          scoreA = a;
          scoreB = b;
          winner = a > b ? 'teamA' : 'teamB';
          break;
        }
      }
    }

    if (scoreA === null) errors.push('Could not extract final score from screenshot');

    // ── 2. Detect VICTORY / DEFEAT ───────────────────────────────────────────
    const upperText = rawText.toUpperCase();
    if (!scoreA && upperText.includes('VICTORY')) winner = 'teamA';
    else if (!scoreA && upperText.includes('DEFEAT')) winner = 'teamB';

    // ── 3. Extract player stats ───────────────────────────────────────────────
    const playerStats = [];
    let currentTeam = 'teamA';
    let teamACount = 0;
    let teamBCount = 0;

    for (const line of lines) {
      // Team boundary heuristic: after 5 players switch teams
      if (teamACount >= 5 && currentTeam === 'teamA') currentTeam = 'teamB';

      // Try to detect agent name in line
      const agentFound = KNOWN_AGENTS.find(a => line.toLowerCase().includes(a.toLowerCase()));

      // Match stat numbers
      const statMatch = line.match(STAT_LINE_PATTERN);
      if (statMatch && agentFound) {
        const nums = extractAllNumbers(line);
        if (nums.length >= 4) {
          const stat = {
            playerName: extractPlayerName(line, agentFound),
            team: currentTeam,
            agent: agentFound,
            acs: nums[0] || 0,
            kills: nums[1] || 0,
            deaths: nums[2] || 0,
            assists: nums[3] || 0,
            adr: nums.length >= 6 ? nums[5] : null,
          };
          playerStats.push(stat);
          if (currentTeam === 'teamA') teamACount++;
          else teamBCount++;
        }
      }
    }

    if (playerStats.length < 2) {
      errors.push('Could not extract player stats reliably — OCR quality may be low');
    }

    // ── 4. Calculate confidence ───────────────────────────────────────────────
    let confidence = 0;
    if (scoreA !== null) confidence += 0.5;
    if (playerStats.length >= 6) confidence += 0.3;
    else if (playerStats.length >= 2) confidence += 0.15;
    if (playerStats.some(p => p.agent)) confidence += 0.2;
    confidence = Math.min(1, confidence);

    const totalRounds = (scoreA ?? 0) + (scoreB ?? 0);

    logger.info('ocr_complete', { confidence, playerStats: playerStats.length, score: `${scoreA}-${scoreB}` });

    return {
      confidence,
      rawText,
      errors,
      parsedResult: {
        winner,
        scoreA,
        scoreB,
        totalRounds,
        playerStats,
      },
    };
  } catch (err) {
    logger.error('ocr_error', { error: err.message, imageUrl });
    return {
      confidence: 0,
      rawText,
      errors: [`OCR failed: ${err.message}`],
      parsedResult: null,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractAllNumbers(line) {
  return (line.match(/\d+/g) || []).map(Number);
}

function extractPlayerName(line, agentName) {
  // Player name usually appears before the agent name in scoreboard
  const agentIdx = line.toLowerCase().indexOf(agentName.toLowerCase());
  if (agentIdx > 0) {
    const before = line.slice(0, agentIdx).trim();
    // Take last word-group before agent (usually IGN)
    const parts = before.split(/\s+/).filter(Boolean);
    return parts.slice(-2).join(' ') || before || 'Unknown';
  }
  return 'Unknown';
}

/**
 * Enqueue an OCR job for a ResultSubmission.
 * Updates the submission document with parsed results.
 *
 * @param {string} submissionId — ResultSubmission._id
 * @param {string} imageUrl     — URL of the screenshot to parse
 */
export async function processSubmissionOcr(submissionId, imageUrl) {
  const { default: ResultSubmission } = await import('../models/resultSubmission.model.js');

  try {
    const result = await parseValorantScoreboard(imageUrl);

    await ResultSubmission.findByIdAndUpdate(submissionId, {
      'ocrData.processed': true,
      'ocrData.processedAt': new Date(),
      'ocrData.confidence': result.confidence,
      'ocrData.rawText': result.rawText?.slice(0, 5000), // cap stored raw text
      'ocrData.parsedResult': result.parsedResult,
      'ocrData.errors': result.errors,
      status: 'ocr_processed',
    });

    logger.info('ocr_submission_updated', { submissionId, confidence: result.confidence });
    return result;
  } catch (err) {
    logger.error('ocr_submission_error', { submissionId, error: err.message });
    await ResultSubmission.findByIdAndUpdate(submissionId, {
      'ocrData.processed': true,
      'ocrData.processedAt': new Date(),
      'ocrData.errors': [`Processing failed: ${err.message}`],
      status: 'ocr_processed',
    });
    throw err;
  }
}
