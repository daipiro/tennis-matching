import { pairKey } from './state.js?v=52';

// Lexicographic comparison keeps a lower-priority preference from outweighing a higher one.
export function scorePlayers(state, selected) {
  const active = Array.from({ length: state.participantCount }, (_, i) => i + 1);
  const playing = new Set(selected);
  let violated = 0, excess = 0, matchImbalance = 0, restImbalance = 0;
  let consecutiveRest = 0, restStreakPressure = 0, playStreakPressure = 0;
  const prospectiveMatches = [], prospectiveRests = [];
  for (const id of active) {
    const p = state.players[id], plays = playing.has(id);
    if (plays && p.maxStreak !== null && p.playStreak + 1 > p.maxStreak) {
      violated++;
      excess += p.playStreak + 1 - p.maxStreak;
    }
    prospectiveMatches.push(p.matches + Number(plays));
    prospectiveRests.push(p.rests + Number(!plays));
    if (!plays && p.restStreak) { consecutiveRest++; restStreakPressure += (p.restStreak + 1) ** 2; }
    if (plays) playStreakPressure += (p.playStreak + 1) ** 2;
  }
  const minMatches = Math.min(...prospectiveMatches), minRests = Math.min(...prospectiveRests);
  matchImbalance = prospectiveMatches.reduce((sum, value) => sum + (value - minMatches) ** 2, 0);
  restImbalance = prospectiveRests.reduce((sum, value) => sum + (value - minRests) ** 2, 0);
  return [violated, excess, matchImbalance, restImbalance, consecutiveRest, restStreakPressure, playStreakPressure];
}

export function scoreTeams(state, teamA, teamB) {
  const pairValues = [state.pairCounts[pairKey(...teamA)] || 0, state.pairCounts[pairKey(...teamB)] || 0];
  const opponents = teamA.flatMap(a => teamB.map(b => state.opponentCounts[pairKey(a, b)] || 0));
  return [Math.max(...pairValues), pairValues.reduce((a, b) => a + b, 0), Math.max(...opponents), opponents.reduce((a, b) => a + b, 0)];
}

export function compareScores(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
