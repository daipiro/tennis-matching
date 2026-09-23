const $ = selector => document.querySelector(selector);
const circle = id => String.fromCodePoint(0x245f + id);
const el = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

function playerChip(id, streak, interactive, selected, resting = false) {
  const node = el(interactive ? 'button' : 'span', `player-chip streak-${Math.min(streak, 4)}${resting ? ' rest-chip' : ''}${selected === id ? ' selected' : ''}`);
  node.append(el('span', 'player-number', circle(id)));
  if (streak > 0 && !resting) node.append(el('small', '', `×${streak}`));
  if (interactive) {
    node.type = 'button'; node.dataset.swapId = String(id);
    node.setAttribute('aria-label', `プレイヤー${id}${resting ? '、休息中' : `、連続出場${streak}試合`}。交換する`);
    node.setAttribute('aria-pressed', selected === id ? 'true' : 'false');
  } else node.setAttribute('aria-label', `プレイヤー${id}${resting ? '、休息中' : `、連続出場${streak}試合`}`);
  return node;
}

export function renderMatchCard(match, { current = false, latest = false, selected = null } = {}) {
  const card = el('article', `match-card ${current ? 'current-card' : latest ? 'latest-card' : 'past-card'}`);
  const heading = el('h3', '', `第${match.matchNumber}試合`);
  if (current) heading.append(el('span', 'card-tag', ' 最新の確定試合'));
  card.append(heading);
  const teams = el('div', 'teams');
  const a = el('div', 'team'), b = el('div', 'team');
  for (const id of match.teamA) a.append(playerChip(id, match.streakSnapshot[id] || 0, current, selected));
  for (const id of match.teamB) b.append(playerChip(id, match.streakSnapshot[id] || 0, current, selected));
  teams.append(a, el('span', 'vs', 'VS'), b);
  const rest = el('p', 'match-rest', '休息');
  rest.append(el('strong', '', match.resting.map(circle).join('  ')));
  card.append(teams, rest);
  return card;
}

function renderRoster(state, selected) {
  const playing = $('#playing'), resting = $('#resting');
  playing.replaceChildren(); resting.replaceChildren();
  const latest = state.history.at(-1);
  if (!latest) {
    playing.append(el('p', 'empty', '試合を作成すると表示されます。'));
    resting.append(el('p', 'settings-help', 'まだ休息プレイヤーはいません。'));
    $('#playing-count').textContent = '0人';
    $('#resting-count').textContent = '0人';
    return;
  }
  const active = [...latest.teamA, ...latest.teamB].sort((a, b) => a - b);
  for (const id of active) playing.append(playerChip(id, latest.streakSnapshot[id] || 0, true, selected));
  for (const id of latest.resting) resting.append(playerChip(id, 0, true, selected, true));
  $('#playing-count').textContent = `${active.length}人`;
  $('#resting-count').textContent = `${latest.resting.length}人`;
}

function renderHistory(state, visibleCount) {
  const container = $('#history'); container.replaceChildren();
  $('#history-count').textContent = `${state.history.length}試合`;
  if (!state.history.length) container.append(el('p', 'empty', 'まだ試合はありません。'));
  const visible = state.history.slice(-visibleCount).reverse();
  visible.forEach((match, index) => container.append(renderMatchCard(match, { latest: index === 0 })));
  $('#more-history').hidden = state.history.length <= visibleCount;
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

export function render(state, { visibleCount = 3, selected = null } = {}) {
  renderHistory(state, visibleCount);
  const current = $('#current'); current.replaceChildren();
  if (state.history.length) {
    current.append(renderMatchCard(state.history.at(-1), { current: true, selected }));
    current.append(el('p', 'swap-help', selected === null ? '番号を選び、交換先の番号をタップしてください。' : `交換元 ${circle(selected)} を選択中。交換先をタップしてください。`));
  } else current.append(el('p', 'empty', '「次の試合」を押すと第1試合が確定します。'));
  $('#current-status').textContent = state.history.length ? '確定済み' : '試合前';
  renderRoster(state, selected);
  $('#undo-match').disabled = !state.history.length;
  $('#notice').textContent = state.notice || '';
  renderSettings(state); renderStats(state);
}
