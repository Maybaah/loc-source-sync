const state = {
  bulk: null,
  lp: null,
  lang: null,
  entries: [],
  issues: [],
  fileName: '',
  levels: new Set(['update', 'review', 'likely', 'cosmetic']),
  query: '',
  onlyTodo: false
};

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function wireDrop(dropId, inputId, handler) {
  const drop = $(dropId);
  const input = $(inputId);
  input.addEventListener('change', () => input.files[0] && handler(input.files[0]));
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => {
    ev.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => {
    ev.preventDefault();
    drop.classList.remove('over');
  }));
  drop.addEventListener('drop', ev => {
    const file = ev.dataTransfer.files[0];
    if (file) handler(file);
  });
}

async function loadBulk(file) {
  try {
    state.bulk = Parse.bulk(await readFile(file));
    state.fileName = file.name;
    $('#name-bulk').textContent = file.name + ' · ' + state.bulk.rows.length + ' strings';
    const select = $('#lang');
    select.innerHTML = '';
    state.bulk.langs.forEach((l, i) => {
      const opt = el('option', null, l.name);
      opt.value = String(i);
      select.appendChild(opt);
    });
    const guess = state.bulk.langs.findIndex(l => /russian/i.test(l.name));
    select.value = String(guess >= 0 ? guess : 0);
    $('#setup').classList.remove('hidden');
    $('#setup-hint').textContent = state.bulk.langs.length + ' languages in this sheet';
  } catch (err) {
    $('#name-bulk').textContent = '';
    alert('Could not read the bulk file: ' + err.message);
  }
}

async function loadLp(file) {
  try {
    state.lp = Parse.lp(await readFile(file));
    $('#name-lp').textContent = file.name + ' · ' + state.lp.entries.length + ' strings';
  } catch (err) {
    $('#name-lp').textContent = '';
    alert('Could not read the Language Pass file: ' + err.message);
  }
}

function analyse() {
  const lang = state.bulk.langs[Number($('#lang').value)];
  state.lang = lang;
  state.entries = state.bulk.rows.map(row => {
    const target = Parse.targetOf(row, lang);
    const verdict = Classify.row(row, target);
    return Object.assign({}, row, {
      current: target.current,
      proposed: target.proposed,
      verdict: verdict.level,
      reasons: verdict.reasons,
      get target() { return this.proposed.trim() || this.current; }
    });
  });
  restoreEdits();
  refresh();
  $('#workspace').classList.remove('hidden');
  $('#loader').classList.add('hidden');
}

function refresh() {
  state.issues = Checks.run(state.entries);
  renderStats();
  renderRows();
  renderQa();
}

function renderStats() {
  const box = $('#stats');
  box.innerHTML = '';
  const counts = {};
  state.entries.forEach(e => counts[e.verdict] = (counts[e.verdict] || 0) + 1);
  Object.keys(Classify.LEVELS).forEach(level => {
    const stat = el('div', 'stat' + (state.levels.has(level) ? '' : ' off'),
      '<b>' + (counts[level] || 0) + '</b><span>' + Classify.LEVELS[level].label + '</span>');
    stat.dataset.level = level;
    stat.addEventListener('click', () => {
      const solo = state.levels.size === 1 && state.levels.has(level);
      state.levels = solo ? new Set(Object.keys(Classify.LEVELS)) : new Set([level]);
      renderStats();
      renderRows();
    });
    box.appendChild(stat);
  });
  box.appendChild(el('div', 'stat', '<b>' + state.issues.length + '</b><span>QA findings</span>'));
}

function visibleEntries() {
  const q = state.query.trim().toLowerCase();
  return state.entries.filter(e => {
    if (!state.levels.has(e.verdict)) return false;
    if (state.onlyTodo && !(e.verdict === 'update' || e.verdict === 'review')) return false;
    if (!q) return true;
    return (e.id + ' ' + e.source + ' ' + e.prev + ' ' + e.current + ' ' + e.proposed).toLowerCase().includes(q);
  });
}

function renderRows() {
  const box = $('#rows');
  box.innerHTML = '';
  const rows = visibleEntries();
  $('#row-count').textContent = rows.length + ' of ' + state.entries.length + ' strings';
  if (!rows.length) {
    box.appendChild(el('div', 'empty', 'Nothing matches the current filter.'));
    return;
  }
  rows.forEach(entry => box.appendChild(rowCard(entry)));
}

function rowCard(entry) {
  const card = el('div', 'row');
  card.dataset.level = entry.verdict;

  const head = el('div', 'row-head');
  head.appendChild(el('span', 'rid', Diff.escape(entry.id)));
  const verdict = el('span', 'verdict', Classify.LEVELS[entry.verdict].label);
  verdict.dataset.level = entry.verdict;
  head.appendChild(verdict);
  head.appendChild(el('span', 'reason', Diff.escape(entry.reasons.join('; '))));
  card.appendChild(head);

  const diff = el('div', 'diff');
  diff.innerHTML = '<div class="diff-label">Source change</div>' + Diff.render(entry.prev, entry.source);
  card.appendChild(diff);

  const target = el('div', 'target');
  target.appendChild(el('div', 'diff-label', 'Current ' + state.lang.name));
  target.appendChild(el('div', 'cur', Diff.escape(entry.current || '-')));
  target.appendChild(el('div', 'diff-label', 'New translation'));

  const area = document.createElement('textarea');
  area.value = entry.proposed;
  area.placeholder = 'Leave empty when the translation does not change';
  area.addEventListener('input', () => {
    entry.proposed = area.value;
    saveEdits();
    renderIssues(card, entry);
  });
  target.appendChild(area);
  card.appendChild(target);

  card.appendChild(el('div', 'row-issues'));
  renderIssues(card, entry);
  return card;
}

function renderIssues(card, entry) {
  const box = card.querySelector('.row-issues');
  box.innerHTML = '';
  Checks.run([entry]).forEach(is => {
    box.appendChild(el('div', 'issue sev-' + is.severity,
      '<b>' + Checks.META[is.check].title + '</b>: ' + Diff.escape(is.message)));
  });
}

function renderQa() {
  const box = $('#qa');
  box.innerHTML = '';
  const byCheck = {};
  state.issues.forEach(is => (byCheck[is.check] = byCheck[is.check] || []).push(is));
  const keys = Object.keys(Checks.META).filter(k => byCheck[k]);
  if (!keys.length) {
    box.appendChild(el('div', 'empty', 'No automated check produced a finding.'));
    return;
  }
  keys.forEach(check => {
    const group = byCheck[check];
    const details = el('details', 'qa-group');
    details.open = Checks.META[check].severity === 'high';
    details.appendChild(el('summary', null,
      Checks.META[check].title + '<span class="qa-badge">' + group.length + '</span>'));
    const items = el('div', 'qa-items');
    group.slice(0, 300).forEach(is => {
      const idPart = is.id ? '<span class="rid">' + Diff.escape(is.id) + '</span> ' : '';
      const line = el('div', 'issue sev-' + is.severity, idPart + Diff.escape(is.message));
      if (is.id) {
        line.style.cursor = 'pointer';
        line.addEventListener('click', () => jumpTo(is.id));
      }
      items.appendChild(line);
    });
    if (group.length > 300) items.appendChild(el('div', 'reason', 'and ' + (group.length - 300) + ' more'));
    details.appendChild(items);
    box.appendChild(details);
  });
}

function jumpTo(id) {
  switchTab('triage');
  state.query = id;
  $('#search').value = id;
  Object.keys(Classify.LEVELS).forEach(l => state.levels.add(l));
  state.onlyTodo = false;
  $('#only-todo').checked = false;
  renderStats();
  renderRows();
}

function renderGlossary() {
  const box = $('#gloss');
  const q = $('#gloss-q').value.trim().toLowerCase();
  box.innerHTML = '';
  if (!state.lp) {
    box.appendChild(el('div', 'empty', 'Load a Language Pass file on the start screen to search confirmed renderings.'));
    $('#gloss-count').textContent = '';
    return;
  }
  if (q.length < 2) {
    box.appendChild(el('div', 'empty', 'Type at least two characters.'));
    $('#gloss-count').textContent = '';
    return;
  }
  const rank = { 'LQA Pass': 0, 'LQA Pending': 1, 'Unrevised': 2, 'LQA Fail': 3 };
  const hits = state.lp.entries
    .filter(e => e.source.toLowerCase().includes(q) || e.target.toLowerCase().includes(q))
    .sort((a, b) => (rank[a.status] === undefined ? 4 : rank[a.status]) - (rank[b.status] === undefined ? 4 : rank[b.status]))
    .slice(0, 150);
  $('#gloss-count').textContent = hits.length + ' shown';
  if (!hits.length) {
    box.appendChild(el('div', 'empty', 'No match in the Language Pass file.'));
    return;
  }
  hits.forEach(hit => {
    const card = el('div', 'row');
    card.dataset.level = hit.status === 'LQA Pass' ? 'likely' : 'cosmetic';
    const head = el('div', 'row-head');
    head.appendChild(el('span', 'rid', Diff.escape(hit.id)));
    head.appendChild(el('span', 'reason', Diff.escape(hit.status || 'no status')));
    card.appendChild(head);
    card.appendChild(el('div', 'diff', Diff.escape(hit.source)));
    card.appendChild(el('div', 'diff', Diff.escape(hit.target)));
    box.appendChild(card);
  });
}

function editsKey() {
  return 'source-sync:' + state.fileName + ':' + (state.lang ? state.lang.name : '');
}

function saveEdits() {
  try {
    const map = {};
    state.entries.forEach(e => { if (e.proposed.trim()) map[e.id] = e.proposed; });
    localStorage.setItem(editsKey(), JSON.stringify(map));
  } catch (err) {}
}

function restoreEdits() {
  try {
    const saved = JSON.parse(localStorage.getItem(editsKey()) || '{}');
    state.entries.forEach(e => { if (saved[e.id] && !e.proposed) e.proposed = saved[e.id]; });
  } catch (err) {}
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-body').forEach(b => b.classList.toggle('hidden', b.id !== 'tab-' + name));
  if (name === 'glossary') renderGlossary();
}

wireDrop('#drop-bulk', '#file-bulk', loadBulk);
wireDrop('#drop-lp', '#file-lp', loadLp);
$('#run').addEventListener('click', analyse);
$('#search').addEventListener('input', e => { state.query = e.target.value; renderRows(); });
$('#only-todo').addEventListener('change', e => { state.onlyTodo = e.target.checked; renderRows(); });
$('#gloss-q').addEventListener('input', renderGlossary);
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
$('#exp-xlsx').addEventListener('click', () => Report.triageSheet(state.entries, state.lang.name));
$('#exp-md').addEventListener('click', () => Report.issuesMarkdown(state.entries, state.issues, state.lang.name, state.fileName));
$('#exp-col').addEventListener('click', () => Report.columnCsv(state.entries, state.lang.name));
