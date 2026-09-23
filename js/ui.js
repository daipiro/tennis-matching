const $ = selector => document.querySelector(selector);
const circle = id => String.fromCodePoint(0x245f + id);
const el = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

function playerChip(id, streak, interactive, selected, resting = false) {
  const node = el(interactive ? 'button' : 'span', `player-chip streak-${Math.min(streak, 4)}${resting ? ' rest-chip' : ''}${interactive && selected === id ? ' selected' : ''}`);
  node.append(el('span', 'player-number', circle(id)));
  if (streak > 0 && !resting) node.append(el('small', '', `×${streak}`));
  if (interactive) {
    node.type = 'button'; node.dataset.swapId = String(id);
    node.setAttribute('aria-label', `プレイヤー${id}${resting ? '、休息中' : `、連続出場${streak}試合`}。交換する`);
    node.setAttribute('aria-pressed', selected === id ? 'true' : 'false');
  } else node.setAttribute('aria-label', `プレイヤー${id}${resting ? '、休息中' : `、連続出場${streak}試合`}`);
  return node;
}

export function renderMatchCard(match, { latest = false, selected = null } = {}) {
  const card = el('article', `match-card ${latest ? 'latest-card' : 'past-card'}`);
  const heading = el('h3', '', `第${match.matchNumber}試合`);
  if (latest) heading.append(el('span', 'card-tag', '最新の試合'));
  card.append(heading);
  const teams = el('div', 'teams');
  const a = el('div', 'team'), b = el('div', 'team');
  for (const id of match.teamA) a.append(playerChip(id, match.streakSnapshot[id] || 0, latest, selected));
  for (const id of match.teamB) b.append(playerChip(id, match.streakSnapshot[id] || 0, latest, selected));
  teams.append(a, el('span', 'vs', 'VS'), b);
  const rest = el('div', 'match-rest');
  const restingPlayers = el('div', 'roster-list match-rest-players');
  for (const id of match.resting) restingPlayers.append(playerChip(id, 0, latest, selected, true));
  rest.append(restingPlayers);
  card.append(teams, rest);
  return card;
}

function renderHistory(state, selected) {
  const container = $('#history'); container.replaceChildren();
  $('#history-count').textContent = `${state.history.length}試合`;
  if (!state.history.length) container.append(el('p', 'empty', 'まだ試合はありません。'));
  const latest = state.history.at(-1);
  state.history.forEach(match => container.append(renderMatchCard(match, { latest: match === latest, selected })));
}

function renderSettings(state) {
  const container = $('#settings'); container.replaceChildren();
  const countLabel = el('label', 'count-setting', '参加人数');
  const count = el('select'); count.id = 'participant-count';
  for (const n of [5, 6, 7]) { const option = el('option', '', `${n}人`); option.value = String(n); count.append(option); }
  count.value = String(state.participantCount);
  countLabel.append(count); container.append(countLabel);
  container.append(el('p', 'settings-help', '強制休息は次の1試合のみ。上限は未設定なら制限なし。'));
  const head = el('div', 'setting-head');
  ['番号', '次試合の休息', '連続出場上限'].forEach(label => head.append(el('span', '', label)));
  container.append(head);
  for (const id of Array.from({ length: state.participantCount }, (_, i) => i + 1)) {
    const row = el('div', 'setting-row');
    row.append(el('strong', 'setting-number', circle(id)));
    const force = el('button', `force-button${state.forcedRest.includes(id) ? ' active' : ''}`, state.forcedRest.includes(id) ? '休息に指定中' : '休息を指定');
    force.type = 'button'; force.dataset.forceId = String(id); force.setAttribute('aria-pressed', state.forcedRest.includes(id) ? 'true' : 'false');
    row.append(force);
    const select = el('select'); select.dataset.maxId = String(id); select.setAttribute('aria-label', `プレイヤー${id}の最大連続出場`);
    for (const [value, label] of [['', '未設定'], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), `${i + 1}試合`])]) {
      const option = el('option', '', label); option.value = value; select.append(option);
    }
    select.value = state.maxStreaks[id] === null ? '' : String(state.maxStreaks[id]);
    row.append(select); container.append(row);
  }
}

function renderStats(state) {
  const container = $('#stats'); container.replaceChildren();
  const table = el('table', 'stats-table');
  const header = el('tr');
  ['番号', '試合', '休息', '連続出場', '連続休息'].forEach(label => header.append(el('th', '', label)));
  table.append(header);
  for (let id = 1; id <= state.participantCount; id++) {
    const p = state.players[id], row = el('tr');
    [circle(id), p.matches, p.rests, p.playStreak, p.restStreak].forEach(value => row.append(el('td', '', String(value))));
    table.append(row);
  }
  container.append(table);
}

export function render(state, { selected = null } = {}) {
  renderHistory(state, selected);
  $('#undo-match').disabled = !state.history.length;
  renderSettings(state); renderStats(state);
}
