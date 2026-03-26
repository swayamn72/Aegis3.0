/**
 * BGMI OCR Service
 *
 * Extracted from ocr/bgmi_ocr.js and adapted for server-side use:
 *   - Accepts image Buffer (from multer memoryStorage) instead of disk file
 *   - Accepts a pre-built slotToTeam map from tournament DB instead of a text file
 *   - Returns structured result objects; does NOT log to stdout
 *   - Stateless: every export is a pure function or factory
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
function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

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
 * @param {object[]} detections  Raw TextDetections from Rekognition
 * @returns {Record<number, Array<{name:string,kills:number}>>}
 */
export function extractPointsFromDetections(detections) {
    const lines = detections
        .filter(d => d.Type === 'LINE' && d.Confidence >= 20)
        .map(d => ({
            text: d.DetectedText,
            left: d.Geometry.BoundingBox.Left,
            top: d.Geometry.BoundingBox.Top,
            w: d.Geometry.BoundingBox.Width,
            h: d.Geometry.BoundingBox.Height,
            cx: d.Geometry.BoundingBox.Left + d.Geometry.BoundingBox.Width / 2,
            cy: d.Geometry.BoundingBox.Top + d.Geometry.BoundingBox.Height / 2,
        }));

    const words = detections
        .filter(d => d.Type === 'WORD' && d.Confidence >= 20)
        .map(d => ({
            text: d.DetectedText,
            left: d.Geometry.BoundingBox.Left,
            top: d.Geometry.BoundingBox.Top,
            w: d.Geometry.BoundingBox.Width,
            h: d.Geometry.BoundingBox.Height,
            cx: d.Geometry.BoundingBox.Left + d.Geometry.BoundingBox.Width / 2,
            cy: d.Geometry.BoundingBox.Top + d.Geometry.BoundingBox.Height / 2,
        }));

    // --- Parse finish/kill lines ---
    const finishLines = [];
    for (const line of lines) {
        let text = line.text.trim().replace(/finish\s+es/gi, 'finishes');
        const m = text.match(/^([0OoDdIi\d]+)\s+finish(?:es)?$/i);
        if (m) {
            let k = m[1].toUpperCase();
            let kills = (k === 'O' || k === 'D') ? 0 : (k === 'I' ? 1 : parseInt(k));
            if (isNaN(kills)) kills = 0;
            finishLines.push({ kills, ...line });
            continue;
        }
        if (/^finish$/i.test(text)) finishLines.push({ kills: 1, ...line });
    }

    // --- Parse player name lines ---
    const NOISE = /^(continue|finishes?|stage|remaining|team|damage|0|finish\s*es)$/i;
    const playerLines = [];
    for (const line of lines) {
        let text = line.text.trim().replace(/finish\s+es/gi, 'finishes');
        if (/finish/i.test(text)) continue;
        if (NOISE.test(text)) continue;
        if (/^\d{1,2}$/.test(text)) continue;
        if (text.length < 2) continue;
        if (line.top < 0.1) continue;
        playerLines.push(line);
    }

    // --- Match players to kill counts ---
    const playerEntries = [];
    const usedFinishes = new Set();
    for (const player of playerLines) {
        let bestIdx = -1, bestDist = 999;
        for (let fi = 0; fi < finishLines.length; fi++) {
            if (usedFinishes.has(fi)) continue;
            const f = finishLines[fi];
            const yDist = Math.abs(f.cy - player.cy);
            if (yDist < 0.04 && f.left > player.left - 0.05) {
                if (yDist < bestDist) { bestDist = yDist; bestIdx = fi; }
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

    // --- Collect orphan finishes ---
    const orphanFinishes = [];
    for (let fi = 0; fi < finishLines.length; fi++) {
        if (!usedFinishes.has(fi) && finishLines[fi].kills > 0) {
            orphanFinishes.push(finishLines[fi]);
        }
    }

    // --- Find position anchors ---
    const posMap = {};
    for (const w of words) {
        const num = parseInt(w.text);
        if (!isNaN(num) && num >= 1 && num <= 25 && /^\d{1,2}$/.test(w.text) && w.h >= 0.035) {
            if (!posMap[num] || w.h > posMap[num].h) posMap[num] = { pos: num, ...w };
        }
    }
    const uniquePos = Object.values(posMap).sort((a, b) => a.top - b.top);

    // --- Assign players to positions ---
    const positions = {};
    const leftPlayers = playerEntries.filter(p => p.cx < 0.55);
    const rightPlayers = playerEntries.filter(p => p.cx >= 0.55);

    if (leftPlayers.length > 0) {
        const sorted = [...leftPlayers].sort((a, b) => a.cy - b.cy);
        let gapIdx = -1, gapSize = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
            const gap = sorted[i + 1].cy - sorted[i].cy;
            if (gap > gapSize) { gapSize = gap; gapIdx = i; }
        }
        if (gapIdx >= 0 && gapSize > 0.06) {
            const mid = (sorted[gapIdx].cy + sorted[gapIdx + 1].cy) / 2;
            positions[1] = sorted.filter(p => p.cy < mid).map(p => ({ name: p.name, kills: p.kills }));
            positions[2] = sorted.filter(p => p.cy >= mid).map(p => ({ name: p.name, kills: p.kills }));
        } else {
            positions[1] = sorted.map(p => ({ name: p.name, kills: p.kills }));
        }
    }

    const rightAnchors = uniquePos.filter(a => a.cx >= 0.5 && a.pos !== 2).sort((a, b) => a.top - b.top);
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

        const regionOrphans = orphanFinishes.filter(f =>
            f.cx >= 0.55 && f.cy >= topBound && f.cy < bottomBound
        );
        const combined = posPlayers.map(p => ({ name: p.name, kills: p.kills }));
        for (const orphan of regionOrphans) {
            if (combined.length < 4) combined.push({ name: '[unreadable]', kills: orphan.kills });
        }
        if (combined.length > 0) positions[anchor.pos] = combined;
    }

    return positions;
}

// ─── 3. Team identification via clan-tag matching ─────────────────────────────
/**
 * Identifies which team a group of players belongs to using roster matching and clan-tags.
 * Uses a voting system where each player gets one vote for their best-matching team.
 * @param {Array<{name:string,kills:number}>} players
 * @param {Array} slotList With .teamName and .roster
 * @returns {string|null} The teamName of the identified team
 */
export function identifyTeam(players, slotList) {
    const votes = {}; // teamName -> vote count

    // Helper function for levenshtein similarity
    const getSimilarity = (s1, s2) => {
        const n1 = normalize(s1);
        const n2 = normalize(s2);
        if (!n1 || !n2) return 0;
        const dist = levenshtein(n1, n2);
        const maxLen = Math.max(n1.length, n2.length);
        return 1 - dist / maxLen;
    };

    for (const p of players) {
        let bestTeam = null;
        let bestScore = 0;
        const normPlayer = normalize(p.name);

        for (const team of slotList) {
            let scoreForThisTeam = 0;

            // 1. Roster Match: Check if this player closely matches any registered roster name
            const roster = team.roster || [];
            for (const rosterEntry of roster) {
                let rosterNames = [];
                if (rosterEntry.player && Array.isArray(rosterEntry.player.gameIds) && rosterEntry.player.gameIds.length > 0) {
                    rosterNames = rosterEntry.player.gameIds.map(g => g.inGameName).filter(Boolean);
                }
                if (rosterNames.length === 0 && rosterEntry.inGameName) {
                    rosterNames.push(rosterEntry.inGameName);
                }

                for (const rosterName of rosterNames) {
                    const sim = getSimilarity(p.name, rosterName);
                    if (sim >= 0.7) {
                        const rosterScore = sim * 20; // High weight for roster matches
                        if (rosterScore > scoreForThisTeam) scoreForThisTeam = rosterScore;
                    }
                }
            }

            // 2. Clan Tag Match
            const teamNameStr = team.teamName;
            const tags = [normalize(teamNameStr)];
            const fw = normalize(teamNameStr.split(/\s+/)[0]);
            if (fw.length >= 2 && fw !== tags[0]) tags.push(fw);

            for (const tag of tags) {
                if (tag.length < 1) continue;
                // Exact prefix match
                if (normPlayer.startsWith(tag)) {
                    const tagScore = tag.length * 10;
                    if (tagScore > scoreForThisTeam) scoreForThisTeam = tagScore;
                }
                // Included in prefix
                const prefix = normPlayer.substring(0, Math.min(normPlayer.length, tag.length * 2));
                if (prefix.includes(tag) && tag.length >= 2) {
                    const tagScore = tag.length * 8;
                    if (tagScore > scoreForThisTeam) scoreForThisTeam = tagScore;
                }
                // Levenshtein close
                if (tag.length >= 3) {
                    const playerPrefix = normPlayer.substring(0, tag.length + 1);
                    const dist = levenshtein(tag, playerPrefix.substring(0, tag.length));
                    if (dist <= 1) {
                        const tagScore = tag.length * 6;
                        if (tagScore > scoreForThisTeam) scoreForThisTeam = tagScore;
                    }
                }
            }

            // Update the player's best matching team overall
            if (scoreForThisTeam > bestScore) {
                bestScore = scoreForThisTeam;
                bestTeam = team.teamName;
            }
        }

        // Player casts their vote
        if (bestTeam && bestScore > 0) {
            votes[bestTeam] = (votes[bestTeam] || 0) + 1;
        }
    }

    if (Object.keys(votes).length === 0) return null;

    // Return team with the most votes
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── 4. Group images belonging to the same match ─────────────────────────────
/**
 * Groups multiple image result sets by shared position-1 players.
 * Useful when a match spans multiple screenshots.
 * (Not exposed via HTTP in this version but kept for future use.)
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
 * runs OCR and returns structured per-team results ready for the frontend.
 *
 * @param {Buffer}  imageBuffer   Raw image bytes
 * @param {Array<{slot:number, teamId:string, teamName:string, roster:any[]}>} slotList
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
 *   playerBreakdown: Array<{player:string|null, kills:number, detectedName:string, matchScore:number}>,
 *   unmatchedKills: number
 * }>>}
 */
export async function processScreenshot(imageBuffer, slotList) {
    // Build a name→teamId/teamName lookup (team name is the clan tag for matching)
    const teamNames = slotList.map(s => s.teamName);
    const teamByName = Object.fromEntries(slotList.map(s => [s.teamName, s]));

    // Run OCR
    const detections = await detectTextInBuffer(imageBuffer);
    const positions = extractPointsFromDetections(detections);

    // Build result per detected team
    const resultMap = {}; // teamId → result accumulator

    const getSimilarity = (s1, s2) => {
        const n1 = normalize(s1);
        const n2 = normalize(s2);
        if (!n1 || !n2) return 0;
        const dist = levenshtein(n1, n2);
        const maxLen = Math.max(n1.length, n2.length);
        return 1 - dist / maxLen;
    };

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
                playerKills: [0, 0, 0, 0], // format needed by PUT /results
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

        // --- Fuzzy matching for each player in this team's position blob ---
        const roster = teamInfo.roster || [];

        for (const ocrPlayer of players) {
            cur.kills += ocrPlayer.kills;
            cur.rawPlayerNames.push(ocrPlayer.name);

            let bestMatch = null;
            let bestMatchIndex = -1;
            let bestScore = 0;

            roster.forEach((rosterEntry, index) => {
                let rosterNames = [];
                if (rosterEntry.player && Array.isArray(rosterEntry.player.gameIds) && rosterEntry.player.gameIds.length > 0) {
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

            // Threshold: 80% (0.8)
            if (bestMatch && bestScore >= 0.8 && bestMatchIndex >= 0 && bestMatchIndex < 4) {
                cur.playerKills[bestMatchIndex] += ocrPlayer.kills;
                cur.playerBreakdown.push({
                    player: bestMatch.player, // ObjectID string
                    kills: ocrPlayer.kills,
                    detectedName: ocrPlayer.name,
                    matchScore: Math.round(bestScore * 100),
                });
            } else {
                // Not matched - counts to team kills but no specific player ID
                cur.unmatchedKills += ocrPlayer.kills;
                cur.playerBreakdown.push({
                    player: null,
                    kills: ocrPlayer.kills,
                    detectedName: ocrPlayer.name,
                    matchScore: Math.round(bestScore * 100),
                });
            }
        }

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
 * @returns {Promise<Array>} Merged result array
 */
export async function processScreenshots(imageBuffers, slotList) {
    if (!imageBuffers || imageBuffers.length === 0) return [];

    // Process all images concurrently
    const allResults = await Promise.all(
        imageBuffers.map(buf => processScreenshot(buf, slotList))
    );

    const mergedMap = {};

    for (const imageResult of allResults) {
        for (const teamResult of imageResult) {
            const tId = teamResult.teamId;
            if (!mergedMap[tId]) {
                // Deep clone to avoid mutating the original
                mergedMap[tId] = {
                    ...teamResult,
                    rawPlayerNames: [...teamResult.rawPlayerNames],
                    playerKills: [...teamResult.playerKills],
                    playerBreakdown: [...teamResult.playerBreakdown]
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
                existing.playerBreakdown.push(...teamResult.playerBreakdown);

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
