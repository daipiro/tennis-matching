import { activeIds } from './state.js';
import { compareScores, scoreCandidate } from './scoring.js';

export function generateCandidates(state) {
  const ids = activeIds(state), choices = [];
  for (let a = 0; a < ids.length - 3; a++) for (let b = a + 1; b < ids.length - 2; b++) for (let c = b + 1; c < ids.length - 1; c++) for (let d = c + 1; d < ids.length; d++) {
    const four = [ids[a], ids[b], ids[c], ids[d]];
    if (four.some(id => state.forcedRest.includes(id))) continue;
    for (const [teamA, teamB] of [
      [[four[0], four[1]], [four[2], four[3]]],
      [[four[0], four[2]], [four[1], four[3]]],
      [[four[0], four[3]], [four[1], four[2]]]
    ]) {
      const { score, relaxed } = scoreCandidate(state, four, teamA, teamB);
      choices.push({ teamA, teamB, score, relaxed });
    }
  }
  return choices;
}

export function generateMatch(state, random = Math.random) {
  const choices = generateCandidates(state);
  if (!choices.length) throw new Error('組み合わせを作成できません');
  let best = choices[0].score, tied = [];
  for (const choice of choices) {
    const comparison = compareScores(choice.score, best);
    if (comparison < 0) { best = choice.score; tied = [choice]; }
    else if (comparison === 0) tied.push(choice);
  }
  const chosen = tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
  return { teamA: chosen.teamA, teamB: chosen.teamB, relaxed: chosen.relaxed };
}
