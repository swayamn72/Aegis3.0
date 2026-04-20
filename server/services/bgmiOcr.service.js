/**
 * BGMI OCR Service (v2 – refined)
 *
 * Extracts match results from BGMI result screenshots via AWS Rekognition.
 *   - Accepts image Buffer (from multer memoryStorage)
 *   - Accepts a pre-built slotList from tournament DB
 *   - Returns structured result objects with per-player participation flags
 *   - Stateless: every export is a pure function or factory
 *
 * Changes from v1:
 *   - Improved finish/kill line parsing (handles OCR quirks)
 *   - Better player name filtering & noise suppression
 *   - Improved position anchor detection
 *   - Better player-to-finish spatial matching
 *   - isPlaying flag for each roster member
 *   - Special character normalization for fuzzy matching
 *   - Handles primary + secondary game IDs equally
 *   - Lower thresholds with adaptive matching for long names
 */

import { RekognitionClient, DetectTextCommand } from '@aws-sdk/client-rekognition';

// ─── Singleton Rekognition client (one per process) ────────────────────────
let _client = null;
function getRekognitionClient() {
    if (!_client) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in server .env');
        }
        _client = new RekognitionClient({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    }
    return _client;
}

// ─── Points table ────────────────────────────────────────────────────────────
export const POSITION_POINTS = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
const KILL_POINT_VALUE = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize a string for fuzzy comparison: lowercase, strip non-alphanumerics */
function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extended normalization that also strips common OCR-garbled special chars
 * (arrows, emojis, stars, bullets, Japanese chars, etc.)
 */
function normalizeForMatch(s) {
    return s
        .replace(/[→←↑↓×✕✖★☆•·|「」]/g, '')
        .replace(/[\u3000-\u9FFF\uF900-\uFAFF]/g, '') // CJK chars
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')        // emoji ranges
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/** Levenshtein distance */
function levenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            m[i][j] = b[i - 1] === a[j - 1]
                ? m[i - 1][j - 1]
                : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
        }
    }
    return m[b.length][a.length];
}

/** Similarity score 0..1 using Levenshtein (higher = more similar) */
function getSimilarity(s1, s2) {
    const n1 = normalizeForMatch(s1);
    const n2 = normalizeForMatch(s2);
    if (!n1 || !n2) return 0;
    if (n1 === n2) return 1.0;
    const dist = levenshtein(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    return 1 - dist / maxLen;
}

/**
 * Adaptive match threshold: longer names are more tolerant of OCR errors
 * because Rekognition garbles special characters frequently.
 */
function getMatchThreshold(name) {
    const norm = normalizeForMatch(name);
    if (norm.length >= 10) return 0.60;
    if (norm.length >= 7) return 0.65;
    return 0.70;
}

// ─── 1. AWS Rekognition ───────────────────────────────────────────────────────
/**
 * Sends an image buffer to AWS Rekognition and returns raw TextDetections.
 * @param {Buffer} imageBuffer
 * @returns {Promise<object[]>}
 */
export async function detectTextInBuffer(imageBuffer) {
    const client = getRekognitionClient();
    const result = await client.send(new DetectTextCommand({
        Image: { Bytes: imageBuffer },
    }));
    return result.TextDetections || [];
}

// ─── 2. Parse OCR detections → position map ──────────────────────────────────

/**
 * Extracts a position-keyed map of players+kills from raw Rekognition detections.
 * Handles the BGMI result screen format:
 *   Left side: Position 1 (trophy) and Position 2
 *   Right side: Positions 3-20+ in numbered blocks
 *
 * @param {object[]} detections  Raw TextDetections from Rekognition
 * @returns {Record<number, Array<{name:string,kills:number}>>}
 */
export function extractPointsFromDetections(detections) {
    // ── Build helper arrays for lines and words ──
    const lines = detections
        .filter(d => d.Type === 'LINE' && d.Confidence >= 15)
        .map(d => ({
            text: d.DetectedText,
            confidence: d.Confidence,
            left: d.Geometry.BoundingBox.Left,
            top: d.Geometry.BoundingBox.Top,
            w: d.Geometry.BoundingBox.Width,
            h: d.Geometry.BoundingBox.Height,
            cx: d.Geometry.BoundingBox.Left + d.Geometry.BoundingBox.Width / 2,
            cy: d.Geometry.BoundingBox.Top + d.Geometry.BoundingBox.Height / 2,
        }));

    const words = detections
        .filter(d => d.Type === 'WORD' && d.Confidence >= 15)
        .map(d => ({
            text: d.DetectedText,
            confidence: d.Confidence,
            left: d.Geometry.BoundingBox.Left,
            top: d.Geometry.BoundingBox.Top,
            w: d.Geometry.BoundingBox.Width,
            h: d.Geometry.BoundingBox.Height,
            cx: d.Geometry.BoundingBox.Left + d.Geometry.BoundingBox.Width / 2,
            cy: d.Geometry.BoundingBox.Top + d.Geometry.BoundingBox.Height / 2,
        }));

    // ── Parse finish/kill lines ──
    // Rekognition quirks:
    //   "0" → "O" or "D",  "1" → "I" or "l",  "finishes" → "finish es"
    //   Sometimes the number is on a separate line from "finish(es)"
    const finishLines = [];

    for (const line of lines) {
        let text = line.text.trim()
            .replace(/finish\s+es/gi, 'finishes')
            .replace(/finish\s*es\s*$/gi, 'finishes');

        // Pattern 1: "N finishes" or "N finish"
        const m = text.match(/^([0OoDdIil\d]+)\s+finish(?:es)?$/i);
        if (m) {
            let k = m[1].toUpperCase();
            let kills;
            if (k === 'O' || k === 'D') kills = 0;
            else if (k === 'I' || k === 'L') kills = 1;
            else kills = parseInt(k);
            if (isNaN(kills)) kills = 0;
            finishLines.push({ kills, ...line });
            continue;
        }

        // Pattern 2: standalone "finish" (= 1 finish)
        if (/^finish$/i.test(text)) {
            finishLines.push({ kills: 1, ...line });
            continue;
        }

        // Pattern 3: "0 finishes" where Rekognition reads "O finishes"
        const m2 = text.match(/^([Oo])\s+finish(?:es)?$/i);
        if (m2) {
            finishLines.push({ kills: 0, ...line });
            continue;
        }
    }

    // Also look for WORD-level finish detections that may have been
    // split differently from LINE-level
    for (const w of words) {
        const wt = w.text.trim();
        // Check for standalone numbers near a "finish" word
        if (/^\d{1,2}$/.test(wt) && w.h < 0.03) {
            // Small number near finishes line — check if there's a "finish" word nearby
            const nearbyFinish = words.find(fw =>
                /^finish(?:es)?$/i.test(fw.text.trim()) &&
                Math.abs(fw.cy - w.cy) < 0.02 &&
                fw.left > w.left
            );
            if (nearbyFinish) {
                // Check if this number wasn't already captured as part of a LINE
                const alreadyCaptured = finishLines.some(fl =>
                    Math.abs(fl.cy - w.cy) < 0.02 && Math.abs(fl.left - w.left) < 0.05
                );
                if (!alreadyCaptured) {
                    finishLines.push({ kills: parseInt(wt), ...w });
                }
            }
        }
    }

    // ── Parse player name lines ──
    const NOISE = /^(continue|finishes?|stage|remaining|team|damage|finish\s*es|eliminations?|\/\d+\s*eliminations?)$/i;
    const playerLines = [];

    for (const line of lines) {
        let text = line.text.trim()
            .replace(/finish\s+es/gi, 'finishes');

        // Skip finish lines
        if (/finish/i.test(text)) continue;
        // Skip noise words
        if (NOISE.test(text)) continue;
        // Skip pure numbers (1-2 digits) — these are usually position anchors
        if (/^\d{1,2}$/.test(text)) continue;
        // Skip very short text
        if (text.length < 2) continue;
        // Skip text in the very top region (header: "Remaining 74 Team 20" etc.)
        if (line.top < 0.1) continue;
        // Skip text in the very bottom region ("Continue" button area)
        if (line.top > 0.92) continue;
        // Skip "Elimination" related text (from slot screenshots)
        if (/elimination/i.test(text)) continue;
        // Skip lines that are just "0" (Rekognition artifact)
        if (text === '0' || text === 'O') continue;

        playerLines.push(line);
    }

    // ── Match players to kill counts ──
    // Strategy: for each player line, find the nearest unused finish line
    // that is on the same horizontal row (similar cy) and to the right
    const playerEntries = [];
    const usedFinishes = new Set();

    for (const player of playerLines) {
        let bestIdx = -1, bestDist = 999;
        for (let fi = 0; fi < finishLines.length; fi++) {
            if (usedFinishes.has(fi)) continue;
            const f = finishLines[fi];
            const yDist = Math.abs(f.cy - player.cy);

            // Must be on the same row (within 5% vertical distance)
            if (yDist > 0.05) continue;

            // Finish text should generally be to the right of the player name
            // (or at least not significantly to the left)
            if (f.cx < player.left - 0.02) continue;

            if (yDist < bestDist) {
                bestDist = yDist;
                bestIdx = fi;
            }
        }
        if (bestIdx >= 0) {
            usedFinishes.add(bestIdx);
            playerEntries.push({
                name: player.text.trim(),
                kills: finishLines[bestIdx].kills,
                left: player.left,
                top: player.top,
                cx: player.cx,
                cy: player.cy,
            });
        }
    }

    // ── Collect orphan finishes (kills detected but player name unreadable) ──
    const orphanFinishes = [];
    for (let fi = 0; fi < finishLines.length; fi++) {
        if (!usedFinishes.has(fi) && finishLines[fi].kills > 0) {
            orphanFinishes.push(finishLines[fi]);
        }
    }

    // ── Find position anchors (large numbers in the right half) ──
    const posMap = {};
    for (const w of words) {
        const num = parseInt(w.text);
        if (isNaN(num) || num < 1 || num > 25) continue;
        if (!/^\d{1,2}$/.test(w.text)) continue;

        // Position anchors on result screens are:
        //   - In the right half for positions 3+
        //   - Position "2" is a large number in the left half
        //   - Relatively large text (h >= 0.025 for the smallest ones)
        if (w.h < 0.025) continue;

        // Avoid picking up kill counts as position numbers.
        // Kill counts are near "finishes" text — check if there's a finish word nearby
        const nearFinish = finishLines.some(fl =>
            Math.abs(fl.cy - w.cy) < 0.03 && Math.abs(fl.left - w.left) < 0.15
        );
        if (nearFinish && num <= 15) continue;

        if (!posMap[num] || w.h > posMap[num].h) {
            posMap[num] = { pos: num, ...w };
        }
    }
    const uniquePos = Object.values(posMap).sort((a, b) => a.top - b.top);

    // ── Assign players to positions ──
    const positions = {};
    const leftPlayers = playerEntries.filter(p => p.cx < 0.55);
    const rightPlayers = playerEntries.filter(p => p.cx >= 0.55);

    // Left side: Position 1 (top, with trophy icon) and Position 2 (below)
    if (leftPlayers.length > 0) {
        const sorted = [...leftPlayers].sort((a, b) => a.cy - b.cy);

        // Find the largest gap between consecutive players to split pos 1 and pos 2
        let gapIdx = -1, gapSize = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
            const gap = sorted[i + 1].cy - sorted[i].cy;
            if (gap > gapSize) { gapSize = gap; gapIdx = i; }
        }

        if (gapIdx >= 0 && gapSize > 0.05) {
            const mid = (sorted[gapIdx].cy + sorted[gapIdx + 1].cy) / 2;
            positions[1] = sorted.filter(p => p.cy < mid).slice(0, 4).map(p => ({ name: p.name, kills: p.kills }));
            positions[2] = sorted.filter(p => p.cy >= mid).slice(0, 4).map(p => ({ name: p.name, kills: p.kills }));
        } else {
            // All left players belong to position 1 (no clear gap means no pos 2 or only 1 team visible)
            positions[1] = sorted.slice(0, 4).map(p => ({ name: p.name, kills: p.kills }));
        }
    }

    // Right side: group by position anchors with midpoint boundaries
    const rightAnchors = uniquePos
        .filter(a => a.cx >= 0.45 && a.pos !== 2) // pos 2 is left-side
        .sort((a, b) => a.top - b.top);

    for (let i = 0; i < rightAnchors.length; i++) {
        const anchor = rightAnchors[i];
        const topBound = i > 0
            ? (rightAnchors[i - 1].top + rightAnchors[i - 1].h + anchor.top) / 2 : 0;
        const bottomBound = i + 1 < rightAnchors.length
            ? (anchor.top + anchor.h + rightAnchors[i + 1].top) / 2 : 1.0;

        const posPlayers = rightPlayers
            .filter(p => p.cy >= topBound && p.cy < bottomBound)
            .sort((a, b) => a.cy - b.cy)
            .slice(0, 4);

        // Add orphan finishes in this region (kills without player names)
        const regionOrphans = orphanFinishes.filter(f =>
            f.cx >= 0.50 && f.cy >= topBound && f.cy < bottomBound
        );
        const combined = posPlayers.map(p => ({ name: p.name, kills: p.kills }));
        for (const orphan of regionOrphans) {
            if (combined.length < 4) combined.push({ name: '[unreadable]', kills: orphan.kills });
        }
        if (combined.length > 0) positions[anchor.pos] = combined;
    }

    return positions;
}

// ─── 3. Team identification via roster game-ID matching ───────────────────────
/**
 * Identifies which team a group of players belongs to.
 * Matches OCR-detected player names against registered game IDs (primary + secondary)
 * in each team's roster. The team with the most matched players wins.
 *
 * Clan tags are NOT used — players may play without clan tags in their IGN.
 *
 * @param {Array<{name:string,kills:number}>} players  OCR-detected players
 * @param {Array} slotList  With .teamName and .roster (roster contains player.gameIds)
 * @returns {string|null} The teamName of the identified team
 */
export function identifyTeam(players, slotList) {
    // For each team, count how many OCR players match its roster
    const teamScores = {}; // teamName -> { matchCount, totalSimilarity }

    for (const team of slotList) {
        const roster = team.roster || [];
        if (roster.length === 0) continue;

        // Collect all registered game IDs for this team
        const rosterGameIds = [];
        for (const rosterEntry of roster) {
            if (rosterEntry.player && Array.isArray(rosterEntry.player.gameIds) && rosterEntry.player.gameIds.length > 0) {
                for (const gid of rosterEntry.player.gameIds) {
                    if (gid.inGameName) rosterGameIds.push(gid.inGameName);
                }
            }
            // Fallback: use the registration-level inGameName
            if (rosterEntry.inGameName) {
                rosterGameIds.push(rosterEntry.inGameName);
            }
        }

        if (rosterGameIds.length === 0) continue;

        let matchCount = 0;
        let totalSim = 0;

        for (const p of players) {
            if (!p.name || p.name === '[unreadable]') continue;

            let bestSim = 0;
            for (const gameId of rosterGameIds) {
                const sim = getSimilarity(p.name, gameId);
                if (sim > bestSim) bestSim = sim;
            }

            const threshold = getMatchThreshold(p.name);
            if (bestSim >= threshold) {
                matchCount++;
                totalSim += bestSim;
            }
        }

        if (matchCount > 0) {
            teamScores[team.teamName] = { matchCount, totalSim };
        }
    }

    if (Object.keys(teamScores).length === 0) return null;

    // Sort by: most matched players first, then by total similarity as tiebreaker
    const sorted = Object.entries(teamScores).sort((a, b) => {
        if (b[1].matchCount !== a[1].matchCount) return b[1].matchCount - a[1].matchCount;
        return b[1].totalSim - a[1].totalSim;
    });

    return sorted[0][0];
}

// ─── 4. Group images belonging to the same match ─────────────────────────────
/**
 * Groups multiple image result sets by shared position-1 players.
 */
export function groupImagesByMatch(allImageResults) {
    const matches = [];
    for (const img of allImageResults) {
        const pos1Players = (img.positions[1] || []).map(p => normalize(p.name)).sort().join(',');
        let found = false;
        for (const match of matches) {
            const existingPos1 = (match.positions[1] || []).map(p => normalize(p.name)).sort().join(',');
            if (pos1Players && existingPos1 && pos1Players === existingPos1) {
                for (const [pos, players] of Object.entries(img.positions)) {
                    if (!match.positions[pos]) match.positions[pos] = players;
                }
                found = true;
                break;
            }
        }
        if (!found) matches.push({ positions: { ...img.positions } });
    }
    return matches;
}

// ─── 5. Main: process a single screenshot ────────────────────────────────────
/**
 * High-level function: given an image buffer and a slot→team map from the DB,
 * runs OCR and returns structured per-team results with player participation flags.
 *
 * @param {Buffer}  imageBuffer   Raw image bytes
 * @param {Array<{slot:number, teamId:string, teamName:string, roster:any[]}>} slotList
 * @param {Map<string, string[]>} [lobbyPlayersBySlot] Optional: actual players from slot screenshots
 * @returns {Promise<Array<{
 *   teamId: string,
 *   teamName: string,
 *   position: number|null,
 *   kills: number,
 *   positionPoints: number,
 *   killPoints: number,
 *   totalPoints: number,
 *   rawPlayerNames: string[],
 *   playerKills: number[],
 *   playerBreakdown: Array<{player:string|null, kills:number, detectedName:string, matchScore:number, isPlaying:boolean}>,
 *   unmatchedKills: number
 * }>>}
 */
export async function processScreenshot(imageBuffer, slotList, lobbyPlayersBySlot = null) {
    const teamByName = Object.fromEntries(slotList.map(s => [s.teamName, s]));

    // Run OCR
    const detections = await detectTextInBuffer(imageBuffer);
    const positions = extractPointsFromDetections(detections);

    // Build result per detected team
    const resultMap = {}; // teamId → result accumulator

    for (const [posStr, players] of Object.entries(positions)) {
        const pos = parseInt(posStr);
        const identified = identifyTeam(players, slotList);
        if (!identified) continue;

        const teamInfo = teamByName[identified];
        if (!teamInfo) continue;

        if (!resultMap[teamInfo.teamId]) {
            resultMap[teamInfo.teamId] = {
                teamId: teamInfo.teamId,
                teamName: identified,
                position: null,
                kills: 0,
                positionPoints: 0,
                killPoints: 0,
                totalPoints: 0,
                rawPlayerNames: [],
                playerKills: [0, 0, 0, 0],
                playerBreakdown: [],
                unmatchedKills: 0,
            };
        }

        const cur = resultMap[teamInfo.teamId];

        // A team can only have one position; take the best/lowest position number
        if (cur.position === null || pos < cur.position) {
            cur.position = pos;
            cur.positionPoints = POSITION_POINTS[pos] || 0;
        }

        // ── Fuzzy matching for each OCR-detected player ──
        const roster = teamInfo.roster || [];

        // Determine which roster members are visible in OCR (= actually playing)
        const matchedRosterIndices = new Set();

        for (const ocrPlayer of players) {
            cur.kills += ocrPlayer.kills;
            cur.rawPlayerNames.push(ocrPlayer.name);

            let bestMatch = null;
            let bestMatchIndex = -1;
            let bestScore = 0;

            roster.forEach((rosterEntry, index) => {
                let rosterNames = [];
                if (rosterEntry.player && Array.isArray(rosterEntry.player.gameIds) && rosterEntry.player.gameIds.length > 0) {
                    // Check ALL game IDs — both primary and secondary
                    rosterNames = rosterEntry.player.gameIds.map(g => g.inGameName).filter(Boolean);
                }
                if (rosterNames.length === 0 && rosterEntry.inGameName) {
                    rosterNames.push(rosterEntry.inGameName);
                }

                for (const rosterName of rosterNames) {
                    const score = getSimilarity(ocrPlayer.name, rosterName);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = rosterEntry;
                        bestMatchIndex = index;
                    }
                }
            });

            // Use adaptive threshold based on name length
            const threshold = bestMatch
                ? getMatchThreshold(ocrPlayer.name)
                : 0.70;

            if (bestMatch && bestScore >= threshold && bestMatchIndex >= 0 && bestMatchIndex < 4) {
                matchedRosterIndices.add(bestMatchIndex);
                cur.playerKills[bestMatchIndex] += ocrPlayer.kills;
                cur.playerBreakdown.push({
                    player: bestMatch.player?._id || bestMatch.player,
                    kills: ocrPlayer.kills,
                    detectedName: ocrPlayer.name,
                    matchScore: Math.round(bestScore * 100),
                    isPlaying: true,
                });
            } else {
                // Not matched — kills count toward team total but no specific player
                cur.unmatchedKills += ocrPlayer.kills;
                cur.playerBreakdown.push({
                    player: null,
                    kills: ocrPlayer.kills,
                    detectedName: ocrPlayer.name,
                    matchScore: Math.round(bestScore * 100),
                    isPlaying: false,
                });
            }
        }

        // ── Mark roster members NOT detected by OCR as isPlaying=false ──
        // These are registered players who didn't appear in the result screen
        roster.forEach((rosterEntry, index) => {
            if (index >= 4) return; // Only consider first 4 roster slots
            if (matchedRosterIndices.has(index)) return; // Already matched

            const playerId = rosterEntry.player?._id || rosterEntry.player;
            if (!playerId) return;

            // Check if this player was already added to breakdown
            const alreadyInBreakdown = cur.playerBreakdown.some(
                bd => bd.player && bd.player.toString() === playerId.toString()
            );
            if (alreadyInBreakdown) return;

            // This roster member did NOT appear in OCR → not playing this match
            cur.playerBreakdown.push({
                player: playerId,
                kills: 0,
                detectedName: null,
                matchScore: 0,
                isPlaying: false,
            });
        });

        cur.killPoints = cur.kills * KILL_POINT_VALUE;
        cur.totalPoints = cur.positionPoints + cur.killPoints;
    }

    // Sort by position (nulls last), then by total points desc
    return Object.values(resultMap).sort((a, b) => {
        if (a.position !== null && b.position !== null) return a.position - b.position;
        if (a.position !== null) return -1;
        if (b.position !== null) return 1;
        return b.totalPoints - a.totalPoints;
    });
}

/**
 * Processes multiple screenshots and merges the results.
 *
 * @param {Buffer[]} imageBuffers Array of image bytes
 * @param {Array} slotList Slot list with team formatting and rosters
 * @param {Map<string, string[]>} [lobbyPlayersBySlot] Optional lobby data
 * @returns {Promise<Array>} Merged result array
 */
export async function processScreenshots(imageBuffers, slotList, lobbyPlayersBySlot = null) {
    if (!imageBuffers || imageBuffers.length === 0) return [];

    // Process all images concurrently
    const allResults = await Promise.all(
        imageBuffers.map(buf => processScreenshot(buf, slotList, lobbyPlayersBySlot))
    );

    const mergedMap = {};

    for (const imageResult of allResults) {
        for (const teamResult of imageResult) {
            const tId = teamResult.teamId;
            if (!mergedMap[tId]) {
                mergedMap[tId] = {
                    ...teamResult,
                    rawPlayerNames: [...teamResult.rawPlayerNames],
                    playerKills: [...teamResult.playerKills],
                    playerBreakdown: [...teamResult.playerBreakdown],
                };
            } else {
                const existing = mergedMap[tId];

                // Best (lowest) position
                if (teamResult.position !== null) {
                    if (existing.position === null || teamResult.position < existing.position) {
                        existing.position = teamResult.position;
                        existing.positionPoints = teamResult.positionPoints;
                    }
                }

                // Sum kills and points
                existing.kills += teamResult.kills;
                existing.killPoints += teamResult.killPoints;
                existing.unmatchedKills += teamResult.unmatchedKills;
                existing.totalPoints = existing.positionPoints + existing.killPoints;

                existing.rawPlayerNames.push(...teamResult.rawPlayerNames);

                // Merge player breakdowns intelligently:
                // If the same player appears in multiple images, sum their kills
                for (const newBd of teamResult.playerBreakdown) {
                    if (newBd.player) {
                        const existingBd = existing.playerBreakdown.find(
                            bd => bd.player && bd.player.toString() === newBd.player.toString()
                        );
                        if (existingBd) {
                            existingBd.kills += newBd.kills;
                            // If player is playing in ANY image, mark as playing
                            if (newBd.isPlaying) existingBd.isPlaying = true;
                            if (newBd.matchScore > existingBd.matchScore) {
                                existingBd.matchScore = newBd.matchScore;
                                existingBd.detectedName = newBd.detectedName;
                            }
                        } else {
                            existing.playerBreakdown.push({ ...newBd });
                        }
                    } else {
                        // Unmatched player — just add
                        existing.playerBreakdown.push({ ...newBd });
                    }
                }

                for (let i = 0; i < 4; i++) {
                    existing.playerKills[i] += teamResult.playerKills[i] || 0;
                }
            }
        }
    }

    // Sort the merged result
    return Object.values(mergedMap).sort((a, b) => {
        if (a.position !== null && b.position !== null) return a.position - b.position;
        if (a.position !== null) return -1;
        if (b.position !== null) return 1;
        return b.totalPoints - a.totalPoints;
    });
}
