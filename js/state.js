const ids = [1, 2, 3, 4, 5, 6, 7];
export const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join('-');
const freshStats = () => ({ matches: 0, rests: 0, playStreak: 0, restStreak: 0 });

export function createInitialState(participantCount = 5) {
  if (![5, 6, 7].includes(participantCount)) throw new RangeError('参加人数は5〜7人です');
  return recompute({ initialCount: participantCount, participantCount, events: [], maxStreaks: Object.fromEntries(ids.map(id => [id, null])), forcedRest: [], notice: '' });
}

export function activeIds(state) { return ids.slice(0, state.participantCount); }

export function recompute(state) {
  const players = Object.fromEntries(ids.map(id => [id, { id, active: id <= state.initialCount, ...freshStats(), maxStreak: state.maxStreaks[id], forcedRest: state.forcedRest.includes(id) }]));
  const pairCounts = {}, opponentCounts = {}, history = [], normalizedEvents = [];
  let count = state.initialCount;
  for (const event of state.events) {
    if (event.type === 'roster') {
      normalizedEvents.push(event);
      const old = count;
      count = event.count;
      for (const id of ids) {
        if ((id <= old) !== (id <= count)) { players[id].playStreak = 0; players[id].restStreak = 0; }
        players[id].active = id <= count;
      }
      continue;
    }
    const match = event.match;
    const playing = [...match.teamA, ...match.teamB];
    for (const id of match.activePlayers) {
      const player = players[id];
      if (playing.includes(id)) { player.matches++; player.playStreak++; player.restStreak = 0; }
      else { player.rests++; player.restStreak++; player.playStreak = 0; }
    }
    for (const team of [match.teamA, match.teamB]) {
      const key = pairKey(...team);
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    }
    for (const a of match.teamA) for (const b of match.teamB) {
      const key = pairKey(a, b);
      opponentCounts[key] = (opponentCounts[key] || 0) + 1;
    }
    const normalizedMatch = {
      ...match,
      matchNumber: history.length + 1,
      streakSnapshot: Object.fromEntries(playing.map(id => [id, players[id].playStreak])),
      restStreakSnapshot: Object.fromEntries(match.resting.map(id => [id, players[id].restStreak]))
    };
    history.push(normalizedMatch);
    normalizedEvents.push({ type: 'match', match: normalizedMatch });
  }
  for (const id of ids) players[id].active = id <= count;
  return { ...state, events: normalizedEvents, participantCount: count, players, pairCounts, opponentCounts, history };
}

export function changeCount(state, count) {
  if (![5, 6, 7].includes(count)) throw new RangeError('参加人数は5〜7人です');
  if (count === state.participantCount) return state;
  const forcedRest = state.forcedRest.filter(id => id <= count);
  while (count - forcedRest.length < 4) forcedRest.pop();
  return recompute({ ...state, events: [...state.events, { type: 'roster', count }], forcedRest, notice: '' });
}

export function setMaxStreak(state, id, value) {
  if (!ids.includes(id) || !(value === null || (Number.isInteger(value) && value >= 1 && value <= 4))) throw new RangeError('連続出場上限が無効です');
  return recompute({ ...state, maxStreaks: { ...state.maxStreaks, [id]: value }, notice: '' });
}

export function toggleForcedRest(state, id) {
  if (!activeIds(state).includes(id)) throw new RangeError('参加していないプレイヤーです');
  const forcedRest = state.forcedRest.includes(id) ? state.forcedRest.filter(other => other !== id) : [...state.forcedRest, id].sort((a, b) => a - b);
  if (state.participantCount - forcedRest.length < 4) throw new RangeError('出場できる人が4人未満になるため指定できません。');
  return recompute({ ...state, forcedRest, notice: '' });
}

export function appendMatch(state, selection, timestamp = Date.now()) {
  const playing = [...selection.teamA, ...selection.teamB];
  const match = { matchNumber: state.history.length + 1, activePlayers: activeIds(state), teamA: [...selection.teamA], teamB: [...selection.teamB], resting: activeIds(state).filter(id => !playing.includes(id)), timestamp };
  return recompute({ ...state, events: [...state.events, { type: 'match', match }], forcedRest: [], notice: selection.relaxed ? '連続出場上限を一時的に超えて組み合わせを作成しました。' : '' });
}

export function swapLatest(state, first, second) {
  if (!state.history.length || first === second) return state;
  const latest = state.history.at(-1);
  if (!latest.activePlayers.includes(first) || !latest.activePlayers.includes(second)) throw new RangeError('交換対象が無効です');
  const events = [...state.events];
  const index = events.findLastIndex(event => event.type === 'match');
  const match = { ...events[index].match };
  for (const field of ['teamA', 'teamB', 'resting']) match[field] = match[field].map(id => id === first ? second : id === second ? first : id);
  events[index] = { type: 'match', match };
  return recompute({ ...state, events, notice: 'プレイヤーを交換しました。' });
}

export function undoLatest(state) {
  const index = state.events.findLastIndex(event => event.type === 'match');
  if (index < 0) return state;
  return recompute({ ...state, events: state.events.filter((_, i) => i !== index), notice: '直前の試合を取り消しました。' });
}

export function newSession(state) {
  return recompute({ ...state, initialCount: state.participantCount, events: [], forcedRest: [], notice: '新しいセッションを開始しました。' });
}
