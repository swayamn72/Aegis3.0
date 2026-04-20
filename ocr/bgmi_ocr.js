/**
 * BGMI OCR Points Calculator
 * 
 * Input: 
 *   - A "testslot list" file mapping slot numbers to team names (user-provided)
 *   - Points images (points1.jpg, points2.jpg, ...) in the images directory
 * 
 * Flow:
 *   1. Parse slot list → team names
 *   2. OCR points images → extract positions, player names, kills
 *   3. Match players to teams using team names as clan-tag prefixes
 *   4. Calculate & output points table
 * 
 * Usage: node bgmi_ocr.js [imagesDir]
 */

const { RekognitionClient, DetectTextCommand } = require("@aws-sdk/client-rekognition");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const client = new RekognitionClient({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Position points: 1st=10, 2nd=6, 3rd=5, 4th=4, 5th=3, 6th=2, 7th=1, 8th=1, 9+=0
const POSITION_POINTS = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
const KILL_POINT_VALUE = 1;

function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ===== 1. PARSE SLOT LIST =====
function parseSlotList(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const slotToTeam = {};
    for (const line of content.split("\n")) {
        const m = line.match(/slot\s*(\d+)\s*:\s*(.+)/i);
        if (m) {
            const slotNum = parseInt(m[1]);
            const teamName = m[2].trim();
            slotToTeam[slotNum] = teamName;
        }
    }
    return slotToTeam;
}

// ===== 2. AWS REKOGNITION =====
async function detectText(imagePath) {
    const imageBytes = fs.readFileSync(imagePath);
    const res = await client.send(new DetectTextCommand({ Image: { Bytes: imageBytes } }));
    return res.TextDetections || [];
}

// ===== 3. POINTS IMAGE PARSING =====
function extractPointsFromDetections(detections) {
    const lines = detections
        .filter(d => d.Type === "LINE" && d.Confidence >= 15)
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
        .filter(d => d.Type === "WORD" && d.Confidence >= 15)
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

    // --- Parse finish/kill lines ---
    // Rekognition quirks: "0" → "O"/"D", "1" → "I"/"l", "finish es" (with space)
    const finishLines = [];
    for (const line of lines) {
        let text = line.text.trim()
            .replace(/finish\s+es/gi, "finishes")
            .replace(/finish\s*es\s*$/gi, "finishes");

        // Pattern 1: "N finishes" or "N finish"
        const m = text.match(/^([0OoDdIil\d]+)\s+finish(?:es)?$/i);
        if (m) {
            let k = m[1].toUpperCase();
            let kills;
            if (k === "O" || k === "D") kills = 0;
            else if (k === "I" || k === "L") kills = 1;
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

        // Pattern 3: "O finishes" where Rekognition reads O as letter
        const m2 = text.match(/^([Oo])\s+finish(?:es)?$/i);
        if (m2) {
            finishLines.push({ kills: 0, ...line });
        }
    }

    // Also look for WORD-level finish detections split differently from LINE-level
    for (const w of words) {
        const wt = w.text.trim();
        if (/^\d{1,2}$/.test(wt) && w.h < 0.03) {
            const nearbyFinish = words.find(fw =>
                /^finish(?:es)?$/i.test(fw.text.trim()) &&
                Math.abs(fw.cy - w.cy) < 0.02 &&
                fw.left > w.left
            );
            if (nearbyFinish) {
                const alreadyCaptured = finishLines.some(fl =>
                    Math.abs(fl.cy - w.cy) < 0.02 && Math.abs(fl.left - w.left) < 0.05
                );
                if (!alreadyCaptured) {
                    finishLines.push({ kills: parseInt(wt), ...w });
                }
            }
        }
    }

    // --- Parse player name lines ---
    const NOISE = /^(continue|finishes?|stage|remaining|team|damage|finish\s*es|eliminations?|\/\d+\s*eliminations?)$/i;
    const playerLines = [];
    for (const line of lines) {
        let text = line.text.trim().replace(/finish\s+es/gi, "finishes");
        if (/finish/i.test(text)) continue;
        if (NOISE.test(text)) continue;
        if (/^\d{1,2}$/.test(text)) continue;
        if (text.length < 2) continue;
        if (line.top < 0.1) continue;
        if (line.top > 0.92) continue;
        if (/elimination/i.test(text)) continue;
        if (text === "0" || text === "O") continue;
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
            if (yDist > 0.05) continue;
            if (f.cx < player.left - 0.02) continue;
            if (yDist < bestDist) { bestDist = yDist; bestIdx = fi; }
        }
        if (bestIdx >= 0) {
            usedFinishes.add(bestIdx);
            playerEntries.push({
                name: player.text.trim(), kills: finishLines[bestIdx].kills,
                left: player.left, top: player.top, cx: player.cx, cy: player.cy,
            });
        }
    }

    // --- Collect orphan finish lines (kills detected but player name unreadable) ---
    const orphanFinishes = [];
    for (let fi = 0; fi < finishLines.length; fi++) {
        if (!usedFinishes.has(fi) && finishLines[fi].kills > 0) {
            orphanFinishes.push(finishLines[fi]);
        }
    }

    // --- Find position anchors (large numbers) ---
    const posMap = {};
    for (const w of words) {
        const num = parseInt(w.text);
        if (isNaN(num) || num < 1 || num > 25) continue;
        if (!/^\d{1,2}$/.test(w.text)) continue;
        if (w.h < 0.025) continue;
        // Avoid picking up kill counts as position numbers
        const nearFinish = finishLines.some(fl =>
            Math.abs(fl.cy - w.cy) < 0.03 && Math.abs(fl.left - w.left) < 0.15
        );
        if (nearFinish && num <= 15) continue;
        if (!posMap[num] || w.h > posMap[num].h) {
            posMap[num] = { pos: num, ...w };
        }
    }
    const uniquePos = Object.values(posMap).sort((a, b) => a.top - b.top);

    // --- Assign players to positions ---
    const positions = {};
    const leftPlayers = playerEntries.filter(p => p.cx < 0.55);
    const rightPlayers = playerEntries.filter(p => p.cx >= 0.55);

    // Left side: Position 1 (top, with trophy) and Position 2 (bottom)
    if (leftPlayers.length > 0) {
        const sorted = [...leftPlayers].sort((a, b) => a.cy - b.cy);
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
            positions[1] = sorted.slice(0, 4).map(p => ({ name: p.name, kills: p.kills }));
        }
    }

    // Right side: group by position anchors with midpoint boundaries
    const rightAnchors = uniquePos.filter(a => a.cx >= 0.45 && a.pos !== 2).sort((a, b) => a.top - b.top);
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
            if (combined.length < 4) {
                combined.push({ name: "[unreadable]", kills: orphan.kills });
            }
        }

        if (combined.length > 0) {
            positions[anchor.pos] = combined;
        }
    }

    return positions;
}

// Group points images by match (same match = same position 1/2 players)
function groupPointsImagesByMatch(allImageResults) {
    const matches = [];
    for (const img of allImageResults) {
        const pos1Players = (img.positions[1] || []).map(p => normalize(p.name)).sort().join(",");
        let found = false;
        for (const match of matches) {
            const existingPos1 = (match.positions[1] || []).map(p => normalize(p.name)).sort().join(",");
            if (pos1Players && existingPos1 && pos1Players === existingPos1) {
                // Merge: add any new positions
                for (const [pos, players] of Object.entries(img.positions)) {
                    if (!match.positions[pos]) match.positions[pos] = players;
                }
                match.files.push(img.file);
                found = true;
                break;
            }
        }
        if (!found) {
            matches.push({ files: [img.file], positions: { ...img.positions } });
        }
    }
    return matches;
}

async function parseAllPointsImages(imageDir) {
    // Accept both points*.jpg and result*.jpg file patterns
    const files = fs.readdirSync(imageDir)
        .filter(f => /^(?:points|result)\d+\.(jpg|png|jpeg|webp)$/i.test(f))
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)[0]);
            const nb = parseInt(b.match(/\d+/)[0]);
            return na - nb;
        });

    const allResults = [];
    for (const file of files) {
        console.log(`  Processing: ${file}`);
        const dets = await detectText(path.join(imageDir, file));
        const positions = extractPointsFromDetections(dets);
        allResults.push({ file, positions });
    }
    return groupPointsImagesByMatch(allResults);
}

// ===== 4. TEAM IDENTIFICATION (clan-tag matching) =====
function levenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++)
        for (let j = 1; j <= a.length; j++)
            m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1]
                : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    return m[b.length][a.length];
}

function identifyTeam(players, teamNames) {
    // Match player name prefixes against team names (clan tags)
    // Strategy: startsWith, containment in prefix, and Levenshtein on prefix
    const votes = {};
    for (const p of players) {
        const normPlayer = normalize(p.name);
        let bestTeam = null, bestScore = 0;

        for (const team of teamNames) {
            const tags = [normalize(team)];
            // Also try first word of multi-word team names
            const fw = normalize(team.split(/\s+/)[0]);
            if (fw.length >= 2 && fw !== tags[0]) tags.push(fw);

            for (const tag of tags) {
                if (tag.length < 1) continue;

                // 1. Exact prefix match (best)
                if (normPlayer.startsWith(tag)) {
                    const score = tag.length * 10;
                    if (score > bestScore) { bestScore = score; bestTeam = team; }
                }

                // 2. Tag contained in first portion of player name
                const prefix = normPlayer.substring(0, Math.min(normPlayer.length, tag.length * 2));
                if (prefix.includes(tag) && tag.length >= 2) {
                    const score = tag.length * 8;
                    if (score > bestScore) { bestScore = score; bestTeam = team; }
                }

                // 3. Levenshtein on prefix (allows 1 char difference for tags >= 3 chars)
                if (tag.length >= 3) {
                    const playerPrefix = normPlayer.substring(0, tag.length + 1);
                    const dist = levenshtein(tag, playerPrefix.substring(0, tag.length));
                    if (dist <= 1) {
                        const score = tag.length * 6;
                        if (score > bestScore) { bestScore = score; bestTeam = team; }
                    }
                }
            }
        }

        if (bestTeam) {
            votes[bestTeam] = (votes[bestTeam] || 0) + 1;
        }
    }

    if (Object.keys(votes).length === 0) return null;
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

// ===== 5. CALCULATE POINTS =====
function calculatePointsTable(matches, teamNames) {
    const teamPoints = {};

    for (let mi = 0; mi < matches.length; mi++) {
        const match = matches[mi];
        console.log(`\n--- Match ${mi + 1} (from: ${match.files.join(", ")}) ---`);

        for (const [posStr, players] of Object.entries(match.positions)) {
            const pos = parseInt(posStr);
            const ppPoints = POSITION_POINTS[pos] || 0;
            const totalKills = players.reduce((s, p) => s + p.kills, 0);

            const teamName = identifyTeam(players, teamNames);
            const label = teamName || `Unknown (${players[0]?.name})`;

            if (teamName) {
                if (!teamPoints[teamName]) teamPoints[teamName] = { positionPoints: 0, killPoints: 0 };
                teamPoints[teamName].positionPoints += ppPoints;
                teamPoints[teamName].killPoints += totalKills * KILL_POINT_VALUE;
            }

            const playerStr = players.map(p => `${p.name}(${p.kills})`).join(", ");
            console.log(`  #${pos} ${label.padEnd(22)} | Pos Pts: ${ppPoints} | Kills: ${totalKills} (${totalKills} pts) | Players: ${playerStr}`);
        }
    }

    return teamPoints;
}

// ===== 6. OUTPUT =====
function printPointsTable(teamPoints) {
    console.log("\n" + "=".repeat(75));
    console.log("  BGMI TOURNAMENT POINTS TABLE");
    console.log("=".repeat(75));

    const sorted = Object.entries(teamPoints)
        .map(([team, pts]) => ({
            team,
            positionPoints: pts.positionPoints,
            killPoints: pts.killPoints,
            total: pts.positionPoints + pts.killPoints,
        }))
        .sort((a, b) => b.total - a.total);

    console.log(`${"#".padEnd(4)} ${"Team".padEnd(25)} ${"Pos Pts".padStart(8)} ${"Kill Pts".padStart(9)} ${"Total".padStart(7)}`);
    console.log("-".repeat(75));

    for (let i = 0; i < sorted.length; i++) {
        const { team, positionPoints, killPoints, total } = sorted[i];
        console.log(`${String(i + 1).padEnd(4)} ${team.padEnd(25)} ${String(positionPoints).padStart(8)} ${String(killPoints).padStart(9)} ${String(total).padStart(7)}`);
    }
    console.log("=".repeat(75));
    return sorted;
}

// ===== MAIN =====
async function main() {
    const imageDirArg = process.argv[2] || "TrainingImages3";
    const imageDir = path.isAbsolute(imageDirArg) ? imageDirArg : path.join(__dirname, imageDirArg);
    const slotListFile = path.join(__dirname, "testslot list");

    console.log("BGMI OCR Points Calculator");
    console.log("==========================\n");
    console.log(`  Image directory: ${imageDir}`);

    // Step 1: Parse slot list
    console.log("\nStep 1: Reading slot list...");
    const slotToTeam = parseSlotList(slotListFile);
    const teamNames = [...new Set(Object.values(slotToTeam))];
    console.log(`  Found ${Object.keys(slotToTeam).length} slots, ${teamNames.length} teams`);
    for (const [slot, team] of Object.entries(slotToTeam).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
        console.log(`    Slot ${slot}: ${team}`);
    }

    // Step 2: Process points images
    console.log("\nStep 2: Processing points images (OCR)...");
    const matches = await parseAllPointsImages(imageDir);
    console.log(`  Found ${matches.length} match(es)`);

    // Step 3: Calculate points
    console.log("\nStep 3: Calculating points...");
    const teamPoints = calculatePointsTable(matches, teamNames);

    // Step 4: Output
    const sorted = printPointsTable(teamPoints);

    // Save output
    const outputLines = ["BGMI TOURNAMENT POINTS TABLE", "=".repeat(55)];
    for (let i = 0; i < sorted.length; i++) {
        const { team, positionPoints, killPoints, total } = sorted[i];
        outputLines.push(`${i + 1}. ${team} : Position Points: ${positionPoints} | Kill Points: ${killPoints} | Total: ${total}`);
    }
    const outputPath = path.join(__dirname, "expectedoutput.txt");
    fs.writeFileSync(outputPath, outputLines.join("\n"), "utf-8");
    console.log(`\nResults saved to: ${outputPath}`);
}

main().catch(console.error);
