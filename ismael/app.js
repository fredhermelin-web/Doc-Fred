/* =========================================================
   Le Carnet d'Ismaël — application
   Sans serveur, sans compte : tout reste dans l'appareil.
   ========================================================= */
'use strict';
(() => {

const VERSION = '1.6.5';            // à changer en même temps que dans sw.js
const KEY = 'carnet-ismael:data';
const IS_ANDROID = /Android/i.test(navigator.userAgent);

/* ---------- petits outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = s => String(s).replace(/^(\s*)(\p{Ll})/u, (m, a, b) => a + b.toUpperCase());
const icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sod = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = s => Math.round((fromYmd(s) - sod()) / 864e5);
const fmt = (d, o) => new Intl.DateTimeFormat('fr-FR', o).format(d);

function dueLabel(s) {
  const n = dayDiff(s);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n === -1) return 'Hier';
  if (n < 0 && n > -7) return `Il y a ${-n} jours`;
  const d = fromYmd(s);
  if (n > 1 && n < 7) return cap(fmt(d, { weekday: 'long' }));
  const o = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return cap(fmt(d, o));
}
function dueClass(s) { const n = dayDiff(s); return n < 0 ? 'due-late' : n === 0 ? 'due-today' : n <= 2 ? 'due-soon' : ''; }
function relTime(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const d = new Date(ts), dd = Math.round((sod() - sod(d)) / 864e5);
  const hm = fmt(d, { hour: '2-digit', minute: '2-digit' });
  if (dd === 0) return `Aujourd'hui, ${hm}`;
  if (dd === 1) return `Hier, ${hm}`;
  if (dd < 7) return `${cap(fmt(d, { weekday: 'long' }))}, ${hm}`;
  const o = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return fmt(d, o);
}

/* ---------- comprendre une échéance dans une phrase ----------
   « Appeler Lucas vendredi » → { text: "Appeler Lucas", due: "2026-11-20" } */
const NUM = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, quinze: 15 };
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre';
const monthIdx = m => ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'].findIndex(p => norm(m).startsWith(p));
const PRE = "(?:(?:pour|avant|d['’]ici|au plus tard)\\s+)?";
const B = '(?<![\\p{L}\\d])', E = '(?![\\p{L}\\d])';
const rx = s => new RegExp(B + PRE + s + E, 'iu');
function nextWeekday(wd, strictly) {
  const t = sod(); let n = (wd - t.getDay() + 7) % 7;
  if (n === 0 && strictly) n = 7;
  return addDays(t, n);
}
function dateFromDayMonth(day, mon, year) {
  const t = sod();
  let d = new Date(year || t.getFullYear(), mon == null ? t.getMonth() : mon, day);
  if (!year && d < t) { if (mon == null) d = new Date(t.getFullYear(), t.getMonth() + 1, day); else d.setFullYear(d.getFullYear() + 1); }
  return d;
}
const RULES = [
  [rx("apr[eè]s[- ]demain"), () => addDays(sod(), 2)],
  [rx("demain(?:\\s+(?:matin|midi|soir|apr[eè]s[- ]midi))?"), () => addDays(sod(), 1)],
  [rx("(?:aujourd['’]hui|ce\\s+soir|ce\\s+matin|cet\\s+apr[eè]s[- ]midi|ce\\s+midi|tout\\s+de\\s+suite)"), () => sod()],
  [rx("(?:la\\s+)?semaine\\s+prochaine"), () => nextWeekday(1, true)],
  [rx("(?:la\\s+)?fin\\s+de\\s+(?:la\\s+)?semaine"), () => { const t = sod(); return t.getDay() === 6 || t.getDay() === 0 ? t : nextWeekday(5, false); }],
  [rx("(?:la\\s+)?fin\\s+(?:du|de\\s+ce)\\s+mois"), () => { const t = sod(); return new Date(t.getFullYear(), t.getMonth() + 1, 0); }],
  [rx("dans\\s+(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze)\\s+(jours?|semaines?|mois)"), m => {
    const n = NUM[norm(m[1])] || parseInt(m[1], 10), u = norm(m[2]);
    if (u.startsWith('mois')) { const t = sod(); t.setMonth(t.getMonth() + n); return t; }
    return addDays(sod(), u.startsWith('sem') ? n * 7 : n);
  }],
  [rx(`(?:le\\s+|ce\\s+)?(${DAYS.join('|')})(?:\\s+(prochain))?(?:\\s+(\\d{1,2}|1er)(?:\\s+(${MONTHS}))?)?`), m => {
    if (m[3]) return dateFromDayMonth(parseInt(m[3], 10), m[4] ? monthIdx(m[4]) : null);
    return nextWeekday(DAYS.indexOf(norm(m[1])), true);   // « vendredi » dit un vendredi = la semaine suivante
  }],
  [rx(`le\\s+(\\d{1,2}|1er|premier)(?:\\s+(${MONTHS}))?(?:\\s+(\\d{4}))?`), m => {
    const day = /^\d/.test(m[1]) ? parseInt(m[1], 10) : 1;
    return day >= 1 && day <= 31 ? dateFromDayMonth(day, m[2] ? monthIdx(m[2]) : null, m[3] ? +m[3] : 0) : null;
  }],
  [rx(`(\\d{1,2}|1er)\\s+(${MONTHS})(?:\\s+(\\d{4}))?`), m => dateFromDayMonth(parseInt(m[1], 10), monthIdx(m[2]), m[3] ? +m[3] : 0)],
  [rx("(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?"), m => {
    const d = +m[1], mo = +m[2] - 1; let y = m[3] ? +m[3] : 0; if (y && y < 100) y += 2000;
    return d >= 1 && d <= 31 && mo >= 0 && mo < 12 ? dateFromDayMonth(d, mo, y) : null;
  }],
];
function parseTask(input) {
  let text = String(input || '').trim()
    .replace(/^(?:(?:ajoute[rz]?|nouvelle|cr[ée]e[rz]?)\s+)?(?:une\s+)?(?:t[âa]che|rappel|[àa] faire)\s*[:,.-]?\s*/iu, '');
  let due = null;
  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (!m) continue;
    const d = fn(m);
    if (!d || isNaN(d)) continue;
    due = ymd(d);
    text = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length));
    break;
  }
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^[\s,.;:-]+|[\s,;:-]+$/g, '').trim();
  return { text: cap(text), due };
}

/* ---------- la dictée : ponctuation à la voix ---------- */
// (espaces simples seulement : un retour à la ligne déjà produit ne doit pas être avalé)
const SPOKEN = [
  [/ +point (?:à|a) la ligne +/gi, '.\n'],
  [/ +point d['’]interrogation +/gi, ' ? '],
  [/ +point d['’]exclamation +/gi, ' ! '],
  [/ +points de suspension +/gi, '… '],
  [/ +point[- ]virgule +/gi, ' ; '],
  [/ +deux[- ]points +/gi, ' : '],
  [/ +virgule +/gi, ', '],
  [/ +point final +/gi, '. '],
  [/ +ouvre[rz]? (?:la )?parenth[eè]se +/gi, ' ('],
  [/ +ferme[rz]? (?:la )?parenth[eè]se +/gi, ') '],
  [/ +ouvre[rz]? (?:les )?guillemets +/gi, ' « '],
  [/ +ferme[rz]? (?:les )?guillemets +/gi, ' » '],
  [/ +nouveau paragraphe +/gi, '\n\n'],
  [/ +(?:(?:à|a) la ligne|nouvelle ligne|retour (?:à|a) la ligne) +/gi, '\n'],
  [/ +tiret +/gi, '\n– '],
  [/ +point *$/i, '. '],
];
function spokenToText(t) {
  let s = ' ' + String(t).trim() + ' ';
  for (const [re, rep] of SPOKEN) s = s.replace(re, rep);
  s = s.replace(/[ \t]+([,.)])/g, '$1').replace(/ {2,}/g, ' ').replace(/ *\n */g, '\n')
       .replace(/([.!?…]\s+|\n)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
  return s.replace(/^ +/, '').replace(/ +$/, '');
}

/* ---------- données ---------- */
const DEFAULT_SETTINGS = { theme: 'light', filter: 'all', taskFilter: 'all', lastFolder: 'f-tes', lastBackup: 0, installHidden: false,
  gClientId: '', syncOn: false, syncLast: 0 };
// palette sans rose : bleu nuit de scène, vert-bleu, ocre, rouge brique, vert, ardoise, orange, brun
// 1.6.1 : teintes « cabinet de curiosités » (indigo, améthyste, or ancien, saphir…), plus de vert
const PALETTE = ['#46399E', '#8A4FB8', '#B5832A', '#C8452C', '#2E5FA3', '#4A6378', '#E07A1F', '#7A6A5A',
  // 1.6.4 : 16 teintes de plus (bleus de nuit, violets, grenats, cuivres, ardoises, deux verts profonds)
  '#3B3F8C', '#1F4E79', '#3F7CAC', '#5B6FD6', '#6B3FA0', '#A25CC4', '#5E3A7E', '#7A5C9E',
  '#A12F3E', '#8C2F39', '#D1603D', '#C98A1B', '#8A5A2B', '#5D6B82', '#2F7D6F', '#3E6B5A'];
const OLD_DEFAULTS = { 'f-tes': ['#3D5AC4', '#46399E'], 'f-pda': ['#1F8A80', '#8A4FB8'], 'f-perso': ['#C98A1B', '#B5832A'] };
const OLD_PINK = '#C2417B';
// icônes de dossiers (dessins au trait, plus d'emojis)
const ICONS = ['drumkit', 'drum', 'sticks', 'music', 'grad', 'notes', 'user', 'users', 'spark', 'shapes', 'work', 'bolt', 'home', 'cal', 'mic', 'folder'];
const EMO2IC = { '🎭': 'spark', '🎨': 'shapes', '🥁': 'drum', '🎵': 'music', '🎸': 'music', '🎹': 'music', '🎤': 'mic', '🎓': 'grad', '🏫': 'grad',
  '👥': 'users', '📅': 'cal', '💡': 'bolt', '⭐': 'spark', '🧾': 'work', '🚗': 'work', '🏠': 'home', '🎧': 'music', '📝': 'notes' };
// Les anciens dossiers gardent leurs données : seuls leurs pictogrammes par défaut évoluent.
const fIcon = f => icon(!f ? 'folder'
  : f.id === 'f-tes' && f.icon === 'spark' ? 'drumkit'
  : f.id === 'f-pda' && f.icon === 'shapes' ? 'drum'
  : f.icon || 'folder');
const WELCOME = `Ismaël, voici ton carnet.

– Touche le gros bouton rouge pour dicter : tu parles, le texte s'écrit.
– Dis « virgule », « point », « à la ligne » ou « nouveau paragraphe » pour ponctuer.
– Dans un modèle (compte-rendu de cours…), dis « ligne suivante » pour passer au champ suivant.
– Tout s'enregistre tout seul, même si tu quittes l'appli en plein milieu.
– Le bouton « Tâche » transforme la ligne en cours en tâche : « Appeler la mairie vendredi » reçoit l'échéance de vendredi.
– Tes notes restent dans cet appareil : pense à faire une sauvegarde de temps en temps (onglet Dossiers).

Tu peux supprimer cette note quand tu veux.`.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ');

function seed() {
  const now = Date.now();
  return {
    v: 1,
    folders: [
      { id: 'f-tes', name: 'Collège', color: '#2E5FA3', icon: 'grad', order: 0, updated: now },
      { id: 'f-pda', name: 'Schoralia', color: '#8A4FB8', icon: 'work', order: 1, updated: now },
      { id: 'f-perso', name: 'Perso', color: '#B5832A', icon: 'user', order: 2, updated: now },
    ],
    tombs: {},
    // Aucun exemple imposé au premier démarrage ; les données déjà enregistrées restent intactes.
    notes: [],
    tasks: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
function fix(d) {
  d.folders = Array.isArray(d.folders) ? d.folders : [];
  d.notes = Array.isArray(d.notes) ? d.notes : [];
  d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  d.tombs = d.tombs && typeof d.tombs === 'object' ? d.tombs : {};   // traces des suppressions (pour la synchro)
  for (const f of d.folders) {
    if (f.color === OLD_PINK) { f.color = PALETTE[0]; f.updated = Date.now(); }
    // v1.6.1 : les trois dossiers d'origine passent aux nouvelles teintes (une seule fois, seulement s'ils avaient encore l'ancienne)
    const od = OLD_DEFAULTS[f.id];
    if (!d.settings.v161 && od && String(f.color).toLowerCase() === od[0].toLowerCase()) { f.color = od[1]; f.updated = Date.now(); }
    if (!f.icon) f.icon = { 'f-tes': 'spark', 'f-pda': 'shapes', 'f-perso': 'user' }[f.id] || EMO2IC[f.emoji] || 'folder';
  }
  d.settings.v161 = true;
  if (!d.settings.v3) { d.settings.v3 = true; if (d.settings.theme === 'auto') d.settings.theme = 'light'; }   // v1.3 : clair par défaut
  const now = Date.now(), lim = now - 30 * 864e5;            // corbeille : 30 jours
  d.notes = d.notes.filter(n => { if (n.deleted && n.deleted <= lim) { d.tombs[n.id] = now; return false; } return true; });
  for (const id in d.tombs) if (d.tombs[id] < now - 120 * 864e5) delete d.tombs[id];
  return d;
}
const tomb = id => { db.tombs[id] = Date.now(); };
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v) return fix(d); } }
  catch (e) { console.warn('Lecture impossible', e); }
  return seed();
}
let db = load();
let dirty = false, saveT = 0, persistAsked = false;

function persist() { dirty = true; clearTimeout(saveT); saveT = setTimeout(saveNow, 300); setSaveState('pending'); }
function saveNow(fromSync) {
  clearTimeout(saveT);
  if (!dirty) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(db)); dirty = false; setSaveState('saved'); updateBadge();
    if (!fromSync && Sync) Sync.schedule();
    if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
  } catch (e) { setSaveState('error'); toast("Impossible d'enregistrer : l'espace de stockage est plein.", { ms: 6000 }); }
}

const folders = () => db.folders.slice().sort((a, b) => a.order - b.order);
const folderById = id => db.folders.find(f => f.id === id);
const fColor = id => (folderById(id) || {}).color || '#8A7F73';
const fName = id => (folderById(id) || {}).name || 'Sans dossier';
const getNote = id => db.notes.find(n => n.id === id && !n.deleted);
const liveNotes = () => db.notes.filter(n => !n.deleted);
const noteTitle = n => n.title.trim() || (n.body.trim().split('\n')[0] || '').slice(0, 80) || 'Note sans titre';
function noteExcerpt(n) {
  let b = n.body.trim();
  if (!n.title.trim()) b = b.split('\n').slice(1).join(' ');
  return b.replace(/\s+/g, ' ').slice(0, 180);
}
const urgentTasks = () => db.tasks.filter(t => !t.done && t.due && dayDiff(t.due) <= 0)
  .sort((a, b) => a.due.localeCompare(b.due) || a.created - b.created);

/* ---------- état de l'interface ---------- */
const state = { listView: 'notes', rendered: '', query: '', sfilter: 'all', showDone: false, installEvt: null, wide: false,
  cal: { y: new Date().getFullYear(), m: new Date().getMonth(), sel: ymd(new Date()), wd: [] } };
const SPLIT = ['notes', 'search', 'calendar'];   // vues qui affichent la note à droite sur ordinateur
let editor = null;
const listEl = $('#list'), detailEl = $('#detail');
const mqWide = matchMedia('(min-width: 900px)');
state.wide = mqWide.matches;

/* ---------- navigation ---------- */
function parseRoute() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'note' && b) return { view: 'note', id: decodeURIComponent(b) };
  if (['notes', 'tasks', 'search', 'folders', 'trash', 'calendar'].includes(a)) return { view: a };
  return { view: 'notes' };
}
function go(hash, replace) {
  if (location.hash === hash) { route(); return; }
  if (replace) history.replaceState({ app: 1 }, '', hash); else history.pushState({ app: 1 }, '', hash);
  route();
}
function back(fallback) {
  if (history.state && history.state.app) history.back(); else go(fallback || '#/notes', true);
}
function route() {
  const r = parseRoute();
  if (r.view === 'note') {
    if (!getNote(r.id)) { go('#/notes', true); return; }
    if (!SPLIT.includes(state.listView)) state.listView = 'notes';
    openEditor(r.id);
  } else {
    state.listView = r.view;
    closeEditor();
  }
  layout();
  renderList();
}
function layout() {
  document.body.classList.toggle('single', state.wide && !SPLIT.includes(state.listView));
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (state.listView === 'trash' ? 'folders' : state.listView)));
  if (state.wide && !editor && SPLIT.includes(state.listView)) detailEl.innerHTML = detailEmpty();
}
mqWide.addEventListener('change', () => { state.wide = mqWide.matches; layout(); renderList(); });

/* ---------- rendu des listes ---------- */
function renderList() {
  const v = state.listView;
  if (v === 'search' && state.rendered === 'search' && $('#q')) { renderSearchResults(); return; }
  const a = document.activeElement, keep = a && listEl.contains(a) && a.id ? { id: a.id, val: a.value, s: a.selectionStart } : null;
  const html = ({ notes: viewNotes, tasks: viewTasks, search: viewSearch, folders: viewFolders, trash: viewTrash, calendar: viewCalendar })[v]();
  const isNew = state.rendered !== v;
  listEl.dataset.view = v;
  listEl.innerHTML = `<div class="wrap ${isNew ? 'enter' : ''}">${html}</div>`;
  state.rendered = v;
  if (keep) { const el = $('#' + keep.id); if (el) { el.value = keep.val; el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch (_) {} } }
  if (v === 'search') { renderSearchResults(); if (isNew && !editor) setTimeout(() => $('#q') && $('#q').focus(), 60); }
  if (isNew) { if (state.wide) listEl.scrollTop = 0; else window.scrollTo(0, 0); }
}

function chips(sel, act, counts, extraNone) {
  const c = k => counts ? ` <b>${counts[k] || 0}</b>` : '';
  let h = `<button class="chip ${sel === 'all' ? 'on' : ''}" data-act="${act}" data-id="all">Tout${c('all')}</button>`;
  h += folders().map(f => `<button class="chip ${sel === f.id ? 'on' : ''}" data-act="${act}" data-id="${f.id}" style="--c:${f.color}"><i class="dot"></i>${esc(f.name)}${c(f.id)}</button>`).join('');
  if (extraNone) h += `<button class="chip ${sel === 'none' ? 'on' : ''}" data-act="${act}" data-id="none"><i class="dot"></i>Sans dossier${c('none')}</button>`;
  return `<div class="chips">${h}<button class="chip add" data-act="folder-new" aria-label="Nouveau dossier" title="Nouveau dossier">${icon('plus')}</button></div>`;
}
const inFilter = (fid, sel) => sel === 'all' || (sel === 'none' ? !folderById(fid) : fid === sel);

function noteCard(n) {
  const active = editor && editor.id === n.id ? 'active' : '';
  const nt = db.tasks.filter(t => t.noteId === n.id && !t.done).length;
  return `<article class="card ${active}" data-act="open-note" data-id="${n.id}" tabindex="0" style="--c:${fColor(n.folderId)}">
    <div class="card-top"><span class="fname">${esc(fName(n.folderId))}</span>${n.pinned ? icon('pin') : ''}<time>${relTime(n.updated)}</time>
      <button class="card-trash" data-act="trash-card" data-id="${n.id}" aria-label="Mettre cette note à la corbeille" title="Mettre à la corbeille">${icon('trash')}</button></div>
    <h3>${esc(noteTitle(n))}</h3>
    ${noteExcerpt(n) ? `<p>${esc(noteExcerpt(n))}</p>` : ''}
    ${nt ? `<div class="mini"><span class="tag">${icon('tasks')}${plural(nt, 'tâche', 'tâches')}</span></div>` : ''}
  </article>`;
}

function viewNotes() {
  const sel = db.settings.filter;
  const all = liveNotes();
  const counts = { all: all.length, none: all.filter(n => !folderById(n.folderId)).length };
  all.forEach(n => { counts[n.folderId] = (counts[n.folderId] || 0) + 1; });
  const notes = all.filter(n => inFilter(n.folderId, sel)).sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
  const now = new Date();
  let h = `<header class="vh"><div class="vh-row"><div>
      <p class="eyebrow">${cap(fmt(now, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h1>Ismaël</h1>
      <button class="write-pill" data-act="new-note" aria-label="Écrire une note" title="Écrire une note (Alt+N)">${icon('quill')}</button></div>
      <div class="vh-actions">${syncBtn()}</div>
    </div></header>`;

  h += padsHtml(sel, counts);

  if (state.installEvt && !db.settings.installHidden) {
    h += `<div class="banner">${icon('install')}<p>Installe le carnet sur ton écran d'accueil pour l'ouvrir comme une vraie appli.</p>
      <button class="btn primary" data-act="install">Installer</button><button class="icon-btn" data-act="install-hide" aria-label="Masquer">${icon('x')}</button></div>`;
  }

  if (!notes.length) {
    if (sel !== 'all') h += `<p class="home-empty">Aucune note dans ce dossier. Touche le micro ou le crayon pour commencer.</p>`;
    return h;
  }
  const groups = [];
  const push = (label, n) => { let g = groups.find(x => x.label === label); if (!g) groups.push(g = { label, items: [] }); g.items.push(n); };
  const t0 = sod().getTime();
  for (const n of notes) {
    if (n.pinned) { push('Épinglées', n); continue; }
    const d = (t0 - sod(new Date(n.updated)).getTime()) / 864e5;
    push(d <= 0 ? "Aujourd'hui" : d <= 1 ? 'Hier' : d < 7 ? 'Cette semaine' : d < 31 ? 'Ce mois-ci' : 'Plus anciennes', n);
  }
  h += groups.map(g => `<h2 class="group-label">${g.label}</h2><div class="cards">${g.items.map(noteCard).join('')}</div>`).join('');
  return h;
}

/* ---------- les dossiers en pads (façon boîte à rythmes) ---------- */
function padsHtml(sel, counts) {
  const all = liveNotes();
  const pads = folders().map((f, i) => {
    const ns = all.filter(n => n.folderId === f.id), last = ns.length ? Math.max(...ns.map(n => n.updated)) : 0;
    const tt = db.tasks.filter(t => !t.done && t.folderId === f.id).length;
    return `<button class="pad ${sel === f.id ? 'on' : ''}" data-act="filter" data-id="${f.id}" style="--c:${f.color};--i:${i}" aria-pressed="${sel === f.id}">
      <span class="pad-ic">${fIcon(f)}</span><span class="pad-n">${counts[f.id] || 0}</span>
      <span class="pad-name">${esc(f.name)}</span>
      <span class="pad-sub">${last ? relTime(last) : 'Vide'}${tt ? ' · ' + plural(tt, 'tâche', 'tâches') : ''}</span>
      <i class="pad-led"></i></button>`;
  }).join('');
  return `<div class="pads">${pads}</div>
    <div class="pad-row">
      ${sel !== 'all' ? `<button class="pill-btn" data-act="filter" data-id="all">Toutes les notes</button>` : ''}
      <button class="pill-btn home-folders" data-act="nav" data-to="#/folders">${icon('folder')}Dossiers</button></div>`;
}

/* ---------- ligne de résumé sous le bonjour ---------- */
function statsLine() {
  const t0 = sod().getTime();
  const today = liveNotes().filter(n => n.created >= t0).length;
  const open = db.tasks.filter(t => !t.done).length, late = db.tasks.filter(t => !t.done && t.due && dayDiff(t.due) < 0).length;
  const bits = [`<span><b>${today}</b> ${today > 1 ? 'notes' : 'note'} aujourd'hui</span>`, `<span><b>${open}</b> ${open > 1 ? 'tâches' : 'tâche'} en cours</span>`];
  if (late) bits.push(`<span class="late"><b>${late}</b> en retard</span>`);
  return `<p class="stats">${bits.join('<i></i>')}</p>`;
}

/* ---------- (ancien) séquenceur 16 pas qui joue un groove à l'ouverture ---------- */
let seqPlayed = false;
function seqHtml() {
  const rows = [['HH', [0, 2, 4, 6, 8, 10, 12, 14], 'hh'], ['SN', [4, 12], 'sn'], ['BD', [0, 7, 8, 10], 'bd']];
  const cells = rows.map(([l, on, k]) => `<span class="seq-l">${l}</span>` +
    Array.from({ length: 16 }, (_, i) => `<i class="${on.includes(i) ? 'on ' + k : ''}${i % 4 === 0 ? ' q' : ''}" style="--i:${i}"></i>`).join('')).join('');
  const play = !seqPlayed; seqPlayed = true;
  return `<button class="seq ${play ? 'play' : ''}" data-act="groove" aria-label="Rejouer le groove" title="Touche pour rejouer">${cells}<span class="seq-bpm">♩ 90 BPM</span></button>`;
}

/* ---------- la déco : une mesure de batterie qui se joue une fois à l'ouverture ---------- */
let groovePlayed = false;
function grooveSvg() {
  const X = i => 62 + i * 30, hh = [0, 1, 2, 3, 4, 5, 6, 7], sn = [2, 6], kk = [0, 4, 5];
  const Y = { hh: 5, sn: 20.5, kk: 34.5 };
  let s = [10, 17, 24, 31, 38].map(y => `<line class="st" x1="0" x2="318" y1="${y}" y2="${y}"/>`).join('');
  s += `<rect class="clef" x="10" y="17" width="3" height="14"/><rect class="clef" x="16" y="17" width="3" height="14"/>`;
  s += `<text class="ts" x="30" y="23.5">4</text><text class="ts" x="30" y="37.5">4</text>`;
  for (let i = 0; i < 8; i += 2) s += `<rect class="beam" x="${X(i) + 3.2}" y="-6" width="${X(i + 1) - X(i) + 1.2}" height="3.2" rx="1"/>`;
  for (let i = 0; i < 8; i++) {
    const x = X(i), low = kk.includes(i) ? Y.kk : sn.includes(i) ? Y.sn : Y.hh;
    let g = `<line class="stem" x1="${x + 3.8}" x2="${x + 3.8}" y1="${low}" y2="-4.5"/>`;
    if (hh.includes(i)) g += `<path class="xh" d="M${x - 3.2} ${Y.hh - 3.2}l6.4 6.4M${x + 3.2} ${Y.hh - 3.2}l-6.4 6.4"/>`;
    if (sn.includes(i)) g += `<ellipse class="nh" cx="${x}" cy="${Y.sn}" rx="4.4" ry="3.2" transform="rotate(-22 ${x} ${Y.sn})"/>`;
    if (kk.includes(i)) g += `<ellipse class="nh" cx="${x}" cy="${Y.kk}" rx="4.4" ry="3.2" transform="rotate(-22 ${x} ${Y.kk})"/>`;
    s += `<g class="beat" style="--i:${i}">${g}</g>`;
  }
  s += `<line class="st bar" x1="306" x2="306" y1="10" y2="38"/><rect class="clef" x="311" y="10" width="3.5" height="28"/>`;
  const play = !groovePlayed; groovePlayed = true;
  return `<button class="groove ${play ? 'play' : ''}" data-act="groove" aria-label="Rejouer la mesure" title="Une petite mesure à 90 BPM">
    <svg viewBox="0 -9 320 52" aria-hidden="true">${s}<rect class="ph" x="0" y="-8" width="2" height="48" rx="1"/></svg></button>`;
}

/* ---------- l'agenda ---------- */
const WD_L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WD_N = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const fOrder = n => (folderById(n.folderId) || { order: 99 }).order;
const dayKey = ts => ymd(new Date(ts));
function dayGroups(notes) {
  const by = {};
  notes.forEach(n => { (by[dayKey(n.created)] = by[dayKey(n.created)] || []).push(n); });
  return Object.keys(by).sort().reverse().map(k => `<h2 class="group-label">${cap(fmt(fromYmd(k), { weekday: 'long', day: 'numeric', month: 'long' }))}
    <span>· ${by[k].length}</span></h2><div class="cards">${by[k].sort((a, b) => a.created - b.created).map(noteCard).join('')}</div>`).join('');
}
function viewCalendar() {
  const c = state.cal, sel = db.settings.filter;
  const first = new Date(c.y, c.m, 1), dim = new Date(c.y, c.m + 1, 0).getDate(), off = (first.getDay() + 6) % 7;
  const monthKey = `${c.y}-${pad(c.m + 1)}`, today = ymd(new Date());
  const notes = liveNotes().filter(n => inFilter(n.folderId, sel));
  const monthNotes = notes.filter(n => dayKey(n.created).startsWith(monthKey));
  const byDay = {}, tByDay = {};
  monthNotes.forEach(n => { (byDay[dayKey(n.created)] = byDay[dayKey(n.created)] || []).push(n); });
  db.tasks.forEach(t => { if (t.due && !t.done && inFilter(t.folderId, sel)) (tByDay[t.due] = tByDay[t.due] || []).push(t); });
  const counts = { all: 0, none: 0 };
  liveNotes().forEach(n => { if (!dayKey(n.created).startsWith(monthKey)) return; counts.all++; if (folderById(n.folderId)) counts[n.folderId] = (counts[n.folderId] || 0) + 1; else counts.none++; });

  let cells = '';
  for (let i = 0; i < off; i++) cells += '<span class="day blank"></span>';
  for (let d = 1; d <= dim; d++) {
    const date = new Date(c.y, c.m, d), k = ymd(date), w = (date.getDay() + 6) % 7;
    const ns = (byDay[k] || []).sort((a, b) => fOrder(a) - fOrder(b)), ts = tByDay[k] || [];
    const dots = ns.slice(0, 4).map(n => `<i style="--c:${fColor(n.folderId)}"></i>`).join('') + (ns.length > 4 ? '<b>+</b>' : '');
    const cls = [k === today && 'today', !c.wd.length && k === c.sel && 'sel', c.wd.includes(w) && 'wdon', ns.length && 'has', w > 4 && 'we'].filter(Boolean).join(' ');
    cells += `<button class="day ${cls}" data-act="cal-day" data-d="${k}" style="--d:${d}"
      aria-label="${fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })} : ${plural(ns.length, 'note', 'notes')}${ts.length ? ', ' + plural(ts.length, 'échéance', 'échéances') : ''}">
      <span class="dn">${d}</span><span class="dots">${dots}</span>${ts.length ? '<span class="tk" aria-hidden="true"></span>' : ''}</button>`;
  }
  const monthName = fmt(first, { month: 'long' });
  let h = `<header class="vh"><div class="vh-row"><div><p class="eyebrow">${plural(monthNotes.length, 'note', 'notes')} en ${monthName}</p><h1>Agenda</h1></div>
      <div class="vh-actions">${syncBtn()}<button class="icon-btn solid only-mobile" data-act="nav" data-to="#/search" aria-label="Chercher">${icon('search')}</button></div></div>
    ${chips(sel, 'filter', counts, counts.none > 0)}</header>
    <section class="cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="cal-move" data-n="-1" aria-label="Mois précédent">${icon('back')}</button>
        <button class="cal-title" data-act="cal-today" title="Revenir à aujourd'hui">${cap(fmt(first, { month: 'long', year: 'numeric' }))}</button>
        <button class="icon-btn" data-act="cal-move" data-n="1" aria-label="Mois suivant">${icon('chev-right')}</button>
      </div>
      <div class="cal-wd">${WD_L.map((l, i) => `<button class="${c.wd.includes(i) ? 'on' : ''} ${i > 4 ? 'we' : ''}" data-act="cal-wd" data-w="${i}" aria-pressed="${c.wd.includes(i)}" title="Tous les ${WD_N[i]}s du mois">${l}</button>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend">${folders().map(f => `<span style="--c:${f.color}"><i></i>${esc(f.name)}</span>`).join('')}<span class="lg-task"><i></i>échéance</span></div>
    </section>`;

  if (c.wd.length) {
    const ws = c.wd.slice().sort(), names = ws.map(i => WD_N[i] + 's');
    const list = monthNotes.filter(n => ws.includes((new Date(n.created).getDay() + 6) % 7));
    h += `<h2 class="sec">Les ${names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names.slice(-1) : names[0]} de ${monthName}</h2>`;
    h += list.length ? dayGroups(list) : `<p class="cal-none">Aucune note ces jours-là en ${monthName}. Change de mois avec les flèches.</p>`;
  } else if (c.sel && c.sel.startsWith(monthKey)) {
    const ns = (byDay[c.sel] || []).sort((a, b) => a.created - b.created), ts = tByDay[c.sel] || [];
    h += `<h2 class="sec">${cap(fmt(fromYmd(c.sel), { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>`;
    if (ns.length) h += `<div class="cards">${ns.map(noteCard).join('')}</div>`;
    if (ts.length) h += `<h2 class="group-label">Échéances</h2><ul class="tlist">${ts.map(t => taskItem(t)).join('')}</ul>`;
    if (!ns.length && !ts.length) h += `<p class="cal-none">Rien ce jour-là. Touche un jour avec des points, ou une lettre (M, V…) pour voir tous les mercredis ou vendredis.</p>`;
  } else {
    h += `<h2 class="sec">Tout ${monthName}</h2>`;
    h += monthNotes.length ? dayGroups(monthNotes) : `<p class="cal-none">Aucune note en ${monthName}.</p>`;
  }
  return h;
}
function calMove(n) {
  const c = state.cal, d = new Date(c.y, c.m + n, 1), now = new Date();
  c.y = d.getFullYear(); c.m = d.getMonth();
  c.sel = c.y === now.getFullYear() && c.m === now.getMonth() ? ymd(now) : null;
  renderList();
  const g = $('.cal-grid'); if (g) g.classList.add(n > 0 ? 'from-right' : 'from-left');
}
let touch0 = null;
document.addEventListener('touchstart', e => { touch0 = e.target.closest('.cal-grid') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch0) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y; touch0 = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { calMove(dx < 0 ? 1 : -1); state.swiped = Date.now(); }
}, { passive: true });

function taskItem(t, compact) {
  const f = folderById(t.folderId), note = t.noteId && getNote(t.noteId);
  const meta = [];
  if (t.due) meta.push(`<span class="${t.done ? '' : dueClass(t.due)}">${icon('cal')}${dueLabel(t.due)}</span>`);
  if (f && !compact) meta.push(`<span style="--c:${f.color}"><i class="dot"></i>${esc(f.name)}</span>`);
  if (note && !compact) meta.push(`<span>${icon('note')}${esc(noteTitle(note).slice(0, 40))}</span>`);
  return `<li class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
    <button class="check" data-act="task-toggle" data-id="${t.id}" aria-label="${t.done ? 'Rouvrir' : 'Terminer'} : ${esc(t.text)}">${icon('check')}</button>
    <div class="t-body" data-act="task-edit" data-id="${t.id}"><div class="t-text">${esc(t.text)}</div>
    ${meta.length ? `<div class="t-meta">${meta.join('')}</div>` : ''}</div></li>`;
}

function viewTasks() {
  const sel = db.settings.taskFilter;
  const open = db.tasks.filter(t => !t.done && inFilter(t.folderId, sel));
  const done = db.tasks.filter(t => t.done && inFilter(t.folderId, sel)).sort((a, b) => b.doneAt - a.doneAt);
  const counts = { all: db.tasks.filter(t => !t.done).length, none: 0 };
  db.tasks.forEach(t => { if (!t.done) { if (folderById(t.folderId)) counts[t.folderId] = (counts[t.folderId] || 0) + 1; else counts.none++; } });
  let h = `<header class="vh"><div class="vh-row"><div><p class="eyebrow">${plural(counts.all, 'tâche en cours', 'tâches en cours')}</p><h1>Tâches</h1></div></div>
    ${chips(sel, 'tfilter', counts, counts.none > 0)}</header>
    <form class="qa" id="qa-form" autocomplete="off">
      <input id="qa" placeholder="Nouvelle tâche… ex. « Appeler la mairie vendredi »" enterkeyhint="done" aria-label="Nouvelle tâche">
      <button type="button" class="round" data-act="qa-mic" aria-label="Dicter une tâche">${icon('mic')}</button>
      <button type="submit" class="round primary" aria-label="Ajouter">${icon('plus')}</button>
    </form><div class="qa-hint" id="qa-hint"></div>`;
  const g = { late: [], today: [], tomorrow: [], week: [], later: [], none: [] };
  for (const t of open) {
    if (!t.due) { g.none.push(t); continue; }
    const n = dayDiff(t.due);
    (n < 0 ? g.late : n === 0 ? g.today : n === 1 ? g.tomorrow : n < 7 ? g.week : g.later).push(t);
  }
  const sortT = arr => arr.sort((a, b) => (a.due || '').localeCompare(b.due || '') || a.created - b.created);
  const labels = { late: 'En retard', today: "Aujourd'hui", tomorrow: 'Demain', week: 'Cette semaine', later: 'Plus tard', none: 'Sans échéance' };
  let any = false;
  for (const k of Object.keys(g)) {
    if (!g[k].length) continue; any = true;
    h += `<h2 class="sec" ${k === 'late' ? 'style="color:var(--late)"' : ''}>${labels[k]} · ${g[k].length}</h2><ul class="tlist">${sortT(g[k]).map(t => taskItem(t)).join('')}</ul>`;
  }
  if (!any) h += `<div class="empty">${icon('tasks')}<h3>Rien à faire pour l'instant</h3><p>Écris ou dicte une tâche ci-dessus. Ajoute « demain », « vendredi » ou « le 12 » pour l'échéance.</p></div>`;
  if (done.length) {
    h += `<h2 class="sec"><button class="done-toggle" data-act="toggle-done"><span>Terminées · ${done.length}</span>${icon(state.showDone ? 'chev-down' : 'chev-right')}</button></h2>`;
    if (state.showDone) h += `<ul class="tlist">${done.slice(0, 60).map(t => taskItem(t)).join('')}</ul>`;
  }
  return h;
}

function viewSearch() {
  return `<div class="search-box"><form class="qa" id="search-form" role="search" onsubmit="return false">
      ${icon('search')}<input id="q" type="search" placeholder="Chercher une note, un élève, une tâche…" value="${esc(state.query)}" enterkeyhint="search" aria-label="Rechercher">
      ${state.query ? `<button type="button" class="round" data-act="q-clear" aria-label="Effacer">${icon('x')}</button>` : ''}
    </form>${chips(state.sfilter, 'sfilter')}</div><div id="results"></div>`;
}
const ACC = { a: '[aàâäá]', e: '[eéèêë]', i: '[iîïí]', o: '[oôöó]', u: '[uùûüú]', c: '[cç]', y: '[yÿ]' };
const termsRe = terms => new RegExp('(' + terms.map(t => t.split('').map(ch => ACC[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')).join('|') + ')', 'gi');
function hl(text, re) { return String(text).split(re).map((p, i) => i % 2 ? `<mark>${esc(p)}</mark>` : esc(p)).join(''); }
function renderSearchResults() {
  const box = $('#results'); if (!box) return;
  const terms = norm(state.query).split(/\s+/).filter(Boolean);
  const sel = state.sfilter;
  if (!terms.length) {
    const recent = liveNotes().filter(n => inFilter(n.folderId, sel)).sort((a, b) => b.updated - a.updated).slice(0, 6);
    box.innerHTML = `<h2 class="sec">Modifiées récemment</h2><div class="cards">${recent.map(noteCard).join('') || '<p class="empty">Aucune note.</p>'}</div>
      <p class="about">Astuce : sur ordinateur, <kbd>Ctrl</kbd> + <kbd>K</kbd> ouvre la recherche.</p>`;
    return;
  }
  const re = termsRe(terms);
  const notes = liveNotes().filter(n => inFilter(n.folderId, sel)).filter(n => {
    const hay = norm(n.title + ' ' + n.body + ' ' + fName(n.folderId)); return terms.every(t => hay.includes(t));
  }).sort((a, b) => b.updated - a.updated);
  const tasks = db.tasks.filter(t => inFilter(t.folderId, sel) && terms.every(x => norm(t.text).includes(x)));
  let h = '';
  if (notes.length) {
    h += `<h2 class="sec">${plural(notes.length, 'note', 'notes')}</h2><div class="cards">` + notes.map(n => {
      const nb = norm(n.body); let i = -1;
      for (const t of terms) { const k = nb.indexOf(t); if (k >= 0 && (i < 0 || k < i)) i = k; }
      const start = Math.max(0, i - 50), snip = i >= 0 ? (start ? '…' : '') + n.body.slice(start, start + 170).replace(/\s+/g, ' ') : noteExcerpt(n);
      return `<article class="card ${editor && editor.id === n.id ? 'active' : ''}" data-act="open-note" data-id="${n.id}" tabindex="0" style="--c:${fColor(n.folderId)}">
        <div class="card-top"><span class="fname">${esc(fName(n.folderId))}</span><time>${relTime(n.updated)}</time></div>
        <h3>${hl(noteTitle(n), re)}</h3><p class="res-snippet">${hl(snip, re)}</p></article>`;
    }).join('') + '</div>';
  }
  if (tasks.length) h += `<h2 class="sec">${plural(tasks.length, 'tâche', 'tâches')}</h2><ul class="tlist">${tasks.map(t => taskItem(t)).join('').replace(/<div class="t-text">([^<]*)<\/div>/g, (m, x) => `<div class="t-text">${hl(x.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), re)}</div>`)}</ul>`;
  if (!h) h = `<div class="empty">${icon('search')}<h3>Aucun résultat</h3><p>Essaie un autre mot, ou cherche dans « Tout ».</p></div>`;
  box.innerHTML = h;
}

function viewFolders() {
  const notes = liveNotes();
  const last = db.settings.lastBackup, old = !last || Date.now() - last > 14 * 864e5;
  const trashN = db.notes.filter(n => n.deleted).length;
  const th = db.settings.theme;
  let h = `<header class="vh"><h1>Dossiers</h1></header><h2 class="sec">Tes dossiers</h2><ul class="flist">`;
  h += folders().map(f => {
    const nn = notes.filter(n => n.folderId === f.id).length, tt = db.tasks.filter(t => !t.done && t.folderId === f.id).length;
    return `<li class="frow" data-act="folder-open" data-id="${f.id}" style="--c:${f.color}"><span class="femo">${fIcon(f)}</span>
      <span class="fname-l"><b>${esc(f.name)}</b><small>${plural(nn, 'note', 'notes')}${tt ? ` · ${plural(tt, 'tâche', 'tâches')}` : ''}</small></span>
      <button class="icon-btn" data-act="folder-edit" data-id="${f.id}" aria-label="Modifier ${esc(f.name)}">${icon('more')}</button></li>`;
  }).join('');
  h += `</ul><div style="margin-top:10px"><button class="btn ghost block" data-act="folder-new">${icon('plus')}Nouveau dossier</button></div>`;

  const s = db.settings, cid = Sync.clientId();
  h += `<h2 class="sec">Synchronisation</h2><div class="group">
    <div class="grow"><span class="gi g-drive">${icon('cloud')}</span><span class="gl"><b>Google Drive</b>
      <small id="sync-status">${s.syncOn ? esc(Sync.label()) : cid ? 'Prête : connecte ton compte pour retrouver tes notes sur le PC et le téléphone' : 'Retrouve les mêmes notes sur ton PC et ton téléphone'}</small></span></div>
    <div class="grow"><div class="btn-row" style="width:100%">
      ${s.syncOn ? `<button class="btn primary" data-act="sync-now">${icon('sync')}Synchroniser</button><button class="btn" data-act="sync-off">Arrêter</button>`
        : cid ? `<button class="btn primary" data-act="sync-connect">${icon('cloud')}Connecter mon compte Google</button><button class="btn" data-act="sync-setup">ID client</button>`
        : `<button class="btn primary" data-act="sync-setup">${icon('cloud')}Configurer</button>`}
    </div></div></div>`;

  h += `<h2 class="sec">Sauvegarde</h2><div class="group">
    <div class="grow"><span class="gi">${icon('download')}</span><span class="gl"><b>Copie de sécurité</b>
      <small class="${old ? 'warn' : ''}">${last ? 'Dernière : ' + relTime(last).toLowerCase() : 'Jamais faite'} · tes notes ne quittent pas cet appareil</small></span></div>
    <div class="grow"><div class="btn-row" style="width:100%">
      <button class="btn" data-act="export">${icon('download')}Enregistrer</button>
      ${navigator.share ? `<button class="btn" data-act="export-share">${icon('share')}Envoyer</button>` : ''}
      <button class="btn" data-act="import">${icon('upload')}Importer</button></div></div>
    <button class="grow" data-act="nav" data-to="#/trash"><span class="gi">${icon('trash')}</span><span class="gl"><b>Corbeille</b><small>${trashN ? plural(trashN, 'note', 'notes') + ' · effacées après 30 jours' : 'Vide'}</small></span>${icon('chev-right')}</button>
  </div>`;

  h += `<h2 class="sec">Réglages</h2><div class="group">
    <div class="grow"><span class="gi">${icon('sun')}</span><span class="gl"><b>Apparence</b></span>
      <span class="seg">${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => `<button class="${th === v ? 'on' : ''}" data-act="theme" data-val="${v}">${l}</button>`).join('')}</span></div>
    <button class="grow" data-act="help"><span class="gi">${icon('mic')}</span><span class="gl"><b>Dictée vocale</b><small>Les commandes à dire, et que faire si le micro ne marche pas</small></span>${icon('chev-right')}</button>
    ${state.installEvt ? `<button class="grow" data-act="install"><span class="gi">${icon('install')}</span><span class="gl"><b>Installer l'appli</b><small>Icône sur l'écran d'accueil, plein écran</small></span>${icon('chev-right')}</button>` : ''}
  </div>
  <p class="about"><b>Le Carnet d'Ismaël</b> · version ${VERSION}<br>Sans compte, sans publicité. Fonctionne hors connexion (sauf la dictée).</p>`;
  return h;
}

function viewTrash() {
  const del = db.notes.filter(n => n.deleted).sort((a, b) => b.deleted - a.deleted);
  let h = `<header class="vh"><div class="vh-row"><div><p class="eyebrow"><button class="link" data-act="nav" data-to="#/folders">${icon('back')}Dossiers</button></p><h1>Corbeille</h1></div>
    ${del.length ? `<button class="btn danger" data-act="trash-empty">Vider</button>` : ''}</div></header>`;
  if (!del.length) return h + `<div class="empty">${icon('trash')}<h3>La corbeille est vide</h3><p>Les notes supprimées restent ici 30 jours.</p></div>`;
  h += `<p class="eyebrow" style="margin:10px 0 12px">Effacement définitif 30 jours après la suppression.</p><div class="cards">`;
  h += del.map(n => `<article class="card" style="--c:${fColor(n.folderId)}">
    <div class="card-top"><span class="fname">${esc(fName(n.folderId))}</span><time>Supprimée ${relTime(n.deleted).toLowerCase()}</time></div>
    <h3>${esc(noteTitle(n))}</h3><p>${esc(noteExcerpt(n))}</p>
    <div class="btn-row" style="margin-top:10px"><button class="btn" data-act="restore" data-id="${n.id}">${icon('restore')}Restaurer</button>
    <button class="btn danger" data-act="purge" data-id="${n.id}">Effacer</button></div></article>`).join('');
  return h + '</div>';
}

function detailEmpty() {
  return `<div class="detail-empty"><div>${icon('sticks')}<h2>Choisis une note, ou dicte-en une</h2>
    <p><kbd>Alt</kbd> + <kbd>D</kbd> dicter · <kbd>Alt</kbd> + <kbd>N</kbd> écrire · <kbd>Ctrl</kbd> + <kbd>K</kbd> chercher</p></div></div>`;
}

/* ---------- l'éditeur ---------- */
function newNote(folderId) {
  const sel = db.settings.filter;
  const fid = folderId || (folderById(sel) ? sel : (folderById(db.settings.lastFolder) ? db.settings.lastFolder : (folders()[0] || {}).id || null));
  const now = Date.now();
  const n = { id: uid(), folderId: fid, title: '', body: '', pinned: false, created: now, updated: now, deleted: 0 };
  db.notes.push(n); persist();
  return n;
}
function openEditor(id) {
  if (editor && editor.id === id) return;
  closeEditor(true);
  const n = getNote(id); if (!n) return;
  detailEl.innerHTML = `<div class="editor" style="--c:${fColor(n.folderId)}">
    <header class="ed-bar">
      <button class="icon-btn" data-act="ed-back" aria-label="Retour" title="Retour (Échap)">${icon('back')}</button>
      <button class="folder-pill" data-act="ed-folder" aria-label="Changer de dossier"><i class="dot"></i><span>${esc(fName(n.folderId))}</span>${icon('chev-down')}</button>
      <span class="save-state" aria-live="polite"></span>
      <button class="icon-btn ${n.pinned ? 'on' : ''}" data-act="ed-pin" aria-pressed="${n.pinned}" aria-label="Épingler" title="Épingler">${icon('pin')}</button>
      <button class="icon-btn" data-act="ed-more" aria-label="Plus d'options">${icon('more')}</button>
    </header>
    <div class="ed-scroll"><div class="ed-paper">
      <textarea class="ed-title" rows="1" placeholder="Titre" maxlength="200" enterkeyhint="next" aria-label="Titre"></textarea>
      <p class="ed-meta"></p>
      <textarea class="ed-body" placeholder="Écris, ou touche le micro et parle…" aria-label="Texte de la note"></textarea>
    </div><section class="ed-tasks"></section></div>
    <div class="interim" hidden></div>
    <footer class="ed-dock">
      <button class="dock-btn" data-act="ed-template">${icon('template')}<span>Modèle</span></button>
      <button class="dock-btn" data-act="ed-task">${icon('task-add')}<span>Tâche</span></button>
      <button class="mic" data-act="ed-mic" aria-label="Dicter" title="Dicter (Alt+D)">${icon('mic', 'mic-ic')}${icon('stop', 'stop-ic')}</button>
      <button class="dock-btn" data-act="ed-share">${icon('share')}<span>Partager</span></button>
      <button class="dock-btn" data-act="ed-done">${icon('check')}<span>Terminé</span></button>
    </footer></div>`;
  const ed = editor = {
    id, root: $('.editor', detailEl), title: $('.ed-title', detailEl), body: $('.ed-body', detailEl),
    scroller: $('.ed-scroll', detailEl), target: null,
  };
  ed.body.value = n.body; ed.title.value = n.title;
  ed.target = ed.body;
  const onInput = () => {
    const note = getNote(ed.id); if (!note) return;
    note.title = ed.title.value.replace(/\n/g, ' '); note.body = ed.body.value; note.updated = Date.now();
    if (note.folderId) db.settings.lastFolder = note.folderId;
    persist(); grow(ed.title); grow(ed.body); updateMeta();
  };
  ed.title.addEventListener('input', onInput);
  ed.body.addEventListener('input', onInput);
  ed.title.addEventListener('focus', () => { ed.target = ed.title; ed.title.touched = true; });
  ed.body.addEventListener('focus', () => { ed.target = ed.body; ed.body.touched = true; });
  ed.title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ed.body.focus(); ed.body.setSelectionRange(0, 0); } });
  ed.scroller.addEventListener('scroll', () => $('.ed-bar', detailEl).classList.toggle('scrolled', ed.scroller.scrollTop > 4), { passive: true });
  detailEl.classList.add('open');
  if (!state.wide) document.body.classList.add('editing');
  requestAnimationFrame(() => { grow(ed.title); grow(ed.body); });
  updateMeta(); renderEdTasks();
}
function grow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
function updateMeta() {
  if (!editor) return; const n = getNote(editor.id); if (!n) return;
  const words = (n.body.match(/[\p{L}\d]+/gu) || []).length;
  $('.ed-meta', detailEl).textContent = `Créée ${relTime(n.created).toLowerCase()} · ${plural(words, 'mot', 'mots')}`;
}
function renderEdTasks() {
  if (!editor) return; const box = $('.ed-tasks', detailEl); if (!box) return;
  const ts = db.tasks.filter(t => t.noteId === editor.id).sort((a, b) => a.done - b.done || (a.due || '9').localeCompare(b.due || '9'));
  box.innerHTML = ts.length ? `<h2 class="sec">Tâches de cette note</h2><ul class="tlist">${ts.map(t => taskItem(t, true)).join('')}</ul>` : '';
}
function closeEditor(silent) {
  if (!editor) return;
  if (Dict.on) Dict.stop();
  const n = getNote(editor.id);
  if (n && !n.title.trim() && !n.body.trim() && !db.tasks.some(t => t.noteId === n.id)) {
    db.notes = db.notes.filter(x => x !== n); dirty = true;
  }
  saveNow();
  editor = null;
  document.body.classList.remove('editing');
  detailEl.classList.remove('open');
  if (state.wide) { if (!silent) detailEl.innerHTML = detailEmpty(); }
  else setTimeout(() => { if (!editor) detailEl.innerHTML = ''; }, 340);
}
let savedT = 0;
function setSaveState(s) {
  const el = editor && $('.save-state', detailEl); if (!el) return;
  clearTimeout(savedT);
  if (s === 'pending') { el.innerHTML = 'Enregistrement…'; el.classList.add('show'); }
  else if (s === 'saved') { el.innerHTML = `${icon('check')}Enregistré`; el.classList.add('show'); savedT = setTimeout(() => el.classList.remove('show'), 1800); }
  else { el.innerHTML = 'Non enregistré !'; el.classList.add('show'); }
}

/* insérer du texte dicté à l'endroit du curseur */
function insertSpoken(el, raw, singleLine) {
  const parts = String(raw).split(/\s*\bligne suivante\b\s*/i);
  parts.forEach((p, i) => {
    if (i > 0) nextLine(el);
    let txt = spokenToText(p); if (singleLine) txt = txt.replace(/\n+/g, ' ');
    if (!txt) return;
    const v = el.value;
    let s = el.touched ? el.selectionStart : v.length, e = el.touched ? el.selectionEnd : v.length;
    const before = v.slice(0, s), after = v.slice(e);
    if (!before.trim() || /[.!?…:]\s*$|\n\s*$/.test(before)) txt = cap(txt);
    if (before && !/[\s(« ]$/.test(before) && !/^[\s,.;:!?…)»\n ]/.test(txt)) txt = ' ' + txt;
    el.value = before + txt + after;
    const pos = (before + txt).length;
    el.touched = true;
    try { el.setSelectionRange(pos, pos); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (editor && !after.trim()) editor.scroller.scrollTop = editor.scroller.scrollHeight;
  });
}
function nextLine(el) {
  const v = el.value, pos = el.touched ? el.selectionEnd : v.length;
  const nl = v.indexOf('\n', pos);
  let target;
  if (nl === -1) { el.value = v + '\n'; target = el.value.length; }
  else { const end = v.indexOf('\n', nl + 1); target = end === -1 ? v.length : end; }
  el.touched = true;
  try { el.setSelectionRange(target, target); } catch (_) {}
}

/* ---------- reconnaissance vocale ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Dict = {
  on: false, rec: null, h: null, last: 0,
  start(h) {
    if (!SR) { helpSheet(true); return false; }
    if (this.on || this.rec) this.stop(true);
    this.h = h; this.on = true; this.last = Date.now();
    h.state && h.state(true);
    this.spawn();
    return true;
  },
  spawn() {
    const r = new SR();
    r.lang = 'fr-FR'; r.interimResults = true; r.maxAlternatives = 1;
    r.continuous = !IS_ANDROID && !this.h.single;    // sur Android, sessions courtes enchaînées (plus fiable)
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i], tx = x[0].transcript;
        if (x.isFinal) { if (tx.trim() && this.h) { this.last = Date.now(); this.h.final(tx); } }
        else interim += tx;
      }
      if (interim) this.last = Date.now();
      this.h && this.h.interim && this.h.interim(interim);
    };
    r.onerror = e => {
      const msg = {
        'not-allowed': "Micro refusé. Autorise le micro pour ce site (icône à gauche de l'adresse, ou réglages du navigateur).",
        'service-not-allowed': "La dictée n'est pas disponible dans ce navigateur. Utilise Chrome ou Edge, ou le micro du clavier.",
        'network': "La dictée a besoin d'une connexion internet. Le micro du clavier peut prendre le relais.",
        'audio-capture': 'Aucun micro détecté.',
      }[e.error];
      if (msg) { this.on = false; toast(msg, { ms: 6500 }); }
    };
    r.onend = () => {
      if (this.rec !== r) return;
      if (this.on && !(this.h && this.h.single) && Date.now() - this.last < 20000) { this.spawn(); return; }
      this.finish();
    };
    this.rec = r;
    try { r.start(); } catch (e) { this.finish(); }
  },
  finish() {
    const h = this.h; this.on = false; this.rec = null; this.h = null;
    if (h) { h.interim && h.interim(''); h.state && h.state(false); h.end && h.end(); }
  },
  stop(now) {
    this.on = false;
    const r = this.rec;
    if (!r) { if (this.h) this.finish(); return; }
    if (now) { this.rec = null; try { r.abort(); } catch (_) {} this.finish(); return; }
    try { r.stop(); } catch (_) { this.finish(); return; }
    setTimeout(() => { if (this.rec === r) { try { r.abort(); } catch (_) {} this.finish(); } }, 2500);
  },
};

function edMic() {
  if (Dict.on) { Dict.stop(); return; }
  const ed = editor; if (!ed) return;
  if (document.activeElement && document.activeElement.blur && !state.wide) document.activeElement.blur();
  Dict.start({
    final: tx => { if (editor !== ed) return; insertSpoken(ed.target || ed.body, tx, ed.target === ed.title); },
    interim: tx => showInterim(tx),
    state: on => {
      const m = $('.mic', detailEl); if (m) { m.classList.toggle('rec', on); m.setAttribute('aria-label', on ? 'Arrêter la dictée' : 'Dicter'); }
      $('#fab').classList.toggle('rec', on);
      showInterim(on ? '' : null);
    },
  });
}
function showInterim(tx) {
  const el = $('.interim', detailEl); if (!el) return;
  if (tx === null || (!Dict.on && !tx)) { el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle('listening', !tx);
  el.textContent = tx || "J'écoute… parle normalement";
}

/* ---------- modèles ---------- */
const TEMPLATES = [
  { id: 'cours', emoji: '🥁', name: 'Compte-rendu de cours', desc: 'Élève, travail, tempo, devoirs',
    title: d => `Cours du ${fmt(d, { day: 'numeric', month: 'long' })}`,
    body: 'Élève : \nTravaillé : \nTempo : \nCe qui va bien : \nÀ travailler pour la prochaine fois : \n' },
  { id: 'spectacle', emoji: '🎭', name: 'Préparation de spectacle', desc: 'Morceau, musiciens, matériel',
    title: () => 'Préparation spectacle',
    body: 'Morceau : \nMusiciens : \nOrdre de passage : \nMatériel à prévoir : \nÀ régler : \n' },
  { id: 'reunion', emoji: '👥', name: 'Réunion', desc: 'Présents, sujets, décisions',
    title: d => `Réunion du ${fmt(d, { day: 'numeric', month: 'long' })}`,
    body: 'Présents : \nSujets : \nDécisions : \nÀ faire : \n' },
  { id: 'exo', emoji: '💡', name: "Idée d'exercice", desc: 'Objectif, niveau, déroulé',
    title: () => "Idée d'exercice",
    body: 'Objectif : \nNiveau : \nTempo de départ : \nDéroulé : \n' },
];
function applyTemplate(tpl) {
  const ed = editor; if (!ed) return;
  const n = getNote(ed.id); if (!n) return;
  if (!ed.title.value.trim()) ed.title.value = tpl.title(new Date());
  const v = ed.body.value;
  let start;
  if (!v.trim()) { ed.body.value = tpl.body; start = 0; }
  else { const sep = v.endsWith('\n\n') ? '' : v.endsWith('\n') ? '\n' : '\n\n'; ed.body.value = v + sep + tpl.body; start = v.length + sep.length; }
  const firstEnd = ed.body.value.indexOf('\n', start);
  ed.body.touched = true; ed.target = ed.body;
  try { ed.body.setSelectionRange(firstEnd, firstEnd); } catch (_) {}
  ed.body.dispatchEvent(new Event('input'));
}

/* ---------- feuilles (menus du bas) ---------- */
const layer = $('#sheet-layer'), sheetEl = $('.sheet', layer);
let sheet = null;
function openSheet(html, mount) {
  if (!sheet) history.pushState({ sheet: 1, app: 1 }, '', location.href);
  sheet = { after: null };
  sheetEl.innerHTML = `<div class="grab"></div>${html}`;
  layer.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('show')));
  if (mount) mount(sheetEl);
}
function closeSheet(after) {
  if (!sheet) { if (after) after(); return; }
  sheet.after = after || null;
  history.back();
}
function hideSheet() {
  if (Dict.on && Dict.h && Dict.h.sheet) Dict.stop(true);
  const after = sheet && sheet.after; sheet = null;
  layer.classList.remove('show');
  setTimeout(() => { if (!sheet) { layer.hidden = true; sheetEl.innerHTML = ''; } }, 260);
  if (after) setTimeout(after, 0);
}
window.addEventListener('popstate', () => { if (sheet) { hideSheet(); return; } route(); });

function confirmSheet(title, text, okLabel, onOk) {
  openSheet(`<h2>${esc(title)}</h2><p class="sub">${esc(text)}</p>
    <div class="actions"><button class="btn" data-act="sheet-close">Annuler</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`,
  el => { $('#ok', el).onclick = () => closeSheet(onOk); });
}

function folderPicker(current, onPick) {
  openSheet(`<h2>Ranger dans…</h2><ul class="menu">${folders().map(f => `<li><button data-id="${f.id}" style="--c:${f.color}"><span class="emo f-ic">${fIcon(f)}</span>${esc(f.name)}${f.id === current ? `<span class="tick">${icon('check')}</span>` : ''}</button></li>`).join('')}
    <li><button data-new>${icon('plus')}Nouveau dossier…</button></li></ul>`, el => {
    $$('[data-id]', el).forEach(b => b.onclick = () => closeSheet(() => onPick(b.dataset.id)));
    $('[data-new]', el).onclick = () => folderSheet(null, f => { closeSheet(() => onPick(f.id)); });
  });
}

function folderSheet(f, onSaved) {
  const isNew = !f;
  const cur = f ? { ...f, icon: f.icon || 'folder' } : { name: '', icon: 'folder', color: PALETTE[folders().length % 8] };
  openSheet(`<h2>${isNew ? 'Nouveau dossier' : 'Modifier le dossier'}</h2>
    <div class="field"><label for="fs-name">Nom</label><input id="fs-name" class="input" maxlength="40" placeholder="ex. Cours particuliers" value="${esc(cur.name)}"></div>
    <div class="field"><label>Icône</label><div class="emojis icons">${ICONS.map(e => `<button type="button" data-emo="${e}" class="${e === cur.icon ? 'on' : ''}" aria-label="${e}">${icon(e)}</button>`).join('')}</div></div>
    <div class="field"><label>Couleur</label><div class="swatches">${PALETTE.map(c => `<button type="button" data-col="${c}" style="--c:${c}" class="${c === cur.color ? 'on' : ''}" aria-label="Couleur ${c}"></button>`).join('')}
      <label class="sw-custom ${PALETTE.includes(cur.color) ? '' : 'on'}" style="--c:${PALETTE.includes(cur.color) ? 'transparent' : cur.color}" title="Autre couleur…"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(cur.color) ? cur.color : '#46399E'}" aria-label="Choisir une autre couleur"></label></div></div>
    ${isNew ? '' : `<div class="btn-row"><button class="btn" data-move="-1">Monter</button><button class="btn" data-move="1">Descendre</button></div>`}
    <div class="actions">${isNew ? '<button class="btn" data-act="sheet-close">Annuler</button>' : '<button class="btn danger" id="fs-del">Supprimer</button>'}
      <button class="btn primary" id="fs-ok">${isNew ? 'Créer' : 'Enregistrer'}</button></div>`, el => {
    const name = $('#fs-name', el);
    if (isNew) setTimeout(() => name.focus(), 250);
    $$('[data-emo]', el).forEach(b => b.onclick = () => { cur.icon = b.dataset.emo; $$('[data-emo]', el).forEach(x => x.classList.toggle('on', x === b)); });
    const cust = $('.sw-custom', el), cin = $('input', cust);
    $$('[data-col]', el).forEach(b => b.onclick = () => { cur.color = b.dataset.col; $$('[data-col]', el).forEach(x => x.classList.toggle('on', x === b)); cust.classList.remove('on'); cust.style.setProperty('--c', 'transparent'); });
    cin.oninput = () => { cur.color = cin.value; $$('[data-col]', el).forEach(x => x.classList.remove('on')); cust.classList.add('on'); cust.style.setProperty('--c', cin.value); };
    $$('[data-move]', el).forEach(b => b.onclick = () => {
      const list = folders(), i = list.findIndex(x => x.id === f.id), j = i + Number(b.dataset.move);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]]; list.forEach((x, k) => { if (x.order !== k) { x.order = k; x.updated = Date.now(); } });
      persist(); renderList(); toast('Ordre modifié');
    });
    const save = () => {
      const nm = name.value.trim(); if (!nm) { name.focus(); return; }
      let target;
      if (isNew) { target = { id: 'f-' + uid(), name: nm, icon: cur.icon, color: cur.color, order: db.folders.length, updated: Date.now() }; db.folders.push(target); }
      else { target = folderById(f.id); Object.assign(target, { name: nm, icon: cur.icon, color: cur.color, updated: Date.now() }); }
      persist(); renderList(); refreshEditorFolder();
      if (onSaved) onSaved(target); else closeSheet(() => toast(isNew ? `Dossier « ${nm} » créé` : 'Dossier modifié'));
    };
    $('#fs-ok', el).onclick = save;
    name.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    const del = $('#fs-del', el);
    if (del) del.onclick = () => {
      const nn = liveNotes().filter(n => n.folderId === f.id).length;
      confirmSheet(`Supprimer « ${f.name} » ?`, nn ? `Ses ${plural(nn, 'note', 'notes')} et ses tâches ne seront pas effacées : elles passeront dans « Sans dossier ».` : 'Le dossier est vide.', 'Supprimer', () => {
        db.folders = db.folders.filter(x => x.id !== f.id); tomb(f.id);
        const now = Date.now();
        db.notes.forEach(n => { if (n.folderId === f.id) { n.folderId = null; n.updated = now; } });
        db.tasks.forEach(t => { if (t.folderId === f.id) { t.folderId = null; t.updated = now; } });
        if (db.settings.filter === f.id) db.settings.filter = 'all';
        if (db.settings.taskFilter === f.id) db.settings.taskFilter = 'all';
        persist(); renderList(); toast('Dossier supprimé');
      });
    };
  });
}

function taskSheet(t, preset = {}) {
  const isNew = !t;
  const cur = t ? { ...t } : { text: preset.text || '', due: null, folderId: preset.folderId || (folderById(db.settings.taskFilter) ? db.settings.taskFilter : null), noteId: preset.noteId || null };
  let manualDate = !isNew;
  const quick = [['Aujourd\'hui', 0], ['Demain', 1], ['Lundi', 'mon'], ['Dans 1 semaine', 7]];
  openSheet(`<h2>${isNew ? 'Nouvelle tâche' : 'Tâche'}</h2>
    <div class="field"><div class="input-row"><input id="ts-text" class="input" placeholder="ex. Réserver la salle pour jeudi" value="${esc(cur.text)}" enterkeyhint="done">
      ${SR ? `<button type="button" class="round" id="ts-mic" aria-label="Dicter">${icon('mic')}</button>` : ''}</div></div>
    <div class="field"><label>Échéance</label><div class="pills" id="ts-dates">
      ${quick.map(([l, v]) => `<button type="button" class="pill" data-q="${v}">${l}</button>`).join('')}
      <button type="button" class="pill" data-q="none">Aucune</button>
      <input type="date" id="ts-date" class="input" value="${cur.due || ''}" aria-label="Choisir une date"></div></div>
    <div class="field"><label>Dossier</label><div class="pills" id="ts-folders">
      ${folders().map(f => `<button type="button" class="pill ${cur.folderId === f.id ? 'on' : ''}" data-f="${f.id}" style="--c:${f.color}"><i class="dot"></i>${esc(f.name)}</button>`).join('')}</div></div>
    ${cur.noteId && getNote(cur.noteId) ? `<button class="grow" id="ts-note" style="padding:8px 0"><span class="gi">${icon('note')}</span><span class="gl"><b>${esc(noteTitle(getNote(cur.noteId)))}</b><small>Ouvrir la note liée</small></span>${icon('chev-right')}</button>` : ''}
    <div class="actions">${isNew ? '<button class="btn" data-act="sheet-close">Annuler</button>' : '<button class="btn danger" id="ts-del">Supprimer</button>'}
      <button class="btn primary" id="ts-ok">${isNew ? 'Ajouter' : 'Enregistrer'}</button></div>`, el => {
    const txt = $('#ts-text', el), date = $('#ts-date', el);
    const mark = () => $$('[data-q]', el).forEach(b => {
      const q = b.dataset.q; let v = null;
      if (q === 'none') v = ''; else if (q === 'mon') v = ymd(nextWeekday(1, true)); else v = ymd(addDays(sod(), +q));
      b.classList.toggle('on', (date.value || '') === v);
    });
    const detect = () => { if (manualDate) return; const p = parseTask(txt.value); date.value = p.due || ''; mark(); };
    txt.addEventListener('input', detect);
    date.addEventListener('change', () => { manualDate = true; mark(); });
    $$('[data-q]', el).forEach(b => b.onclick = () => {
      const q = b.dataset.q; manualDate = true;
      date.value = q === 'none' ? '' : q === 'mon' ? ymd(nextWeekday(1, true)) : ymd(addDays(sod(), +q)); mark();
    });
    $$('[data-f]', el).forEach(b => b.onclick = () => {
      cur.folderId = cur.folderId === b.dataset.f ? null : b.dataset.f;
      $$('[data-f]', el).forEach(x => x.classList.toggle('on', x.dataset.f === cur.folderId));
    });
    const mic = $('#ts-mic', el);
    if (mic) mic.onclick = () => {
      if (Dict.on) { Dict.stop(); return; }
      Dict.start({ single: true, sheet: true,
        final: tx => { txt.value = (txt.value.trim() ? txt.value.trim() + ' ' : '') + spokenToText(tx).replace(/\n+/g, ' '); detect(); },
        interim: tx => { if (tx) txt.placeholder = tx + '…'; },
        state: on => { mic.classList.toggle('rec', on); txt.placeholder = on ? "J'écoute…" : 'ex. Réserver la salle pour jeudi'; } });
    };
    const save = () => {
      let text = txt.value.trim(); if (!text) { txt.focus(); return; }
      let due = date.value || null;
      if (!manualDate) { const p = parseTask(text); if (p.due) { text = p.text || text; due = p.due; } }
      else text = cap(text);
      const now = Date.now();
      if (isNew) db.tasks.push({ id: uid(), text, due, done: false, doneAt: 0, folderId: cur.folderId, noteId: cur.noteId, created: now, updated: now });
      else Object.assign(db.tasks.find(x => x.id === t.id) || {}, { text, due, folderId: cur.folderId, updated: now });
      persist(); renderList(); renderEdTasks();
      closeSheet(() => toast(isNew ? `Tâche ajoutée${due ? ' · ' + dueLabel(due).toLowerCase() : ''}` : 'Tâche modifiée'));
    };
    $('#ts-ok', el).onclick = save;
    txt.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    const del = $('#ts-del', el);
    if (del) del.onclick = () => closeSheet(() => deleteTask(t.id));
    const nb = $('#ts-note', el);
    if (nb) nb.onclick = () => closeSheet(() => go('#/note/' + cur.noteId));
    mark();
    if (isNew) { if (cur.text) detect(); setTimeout(() => txt.focus(), 250); }
  });
}

function helpSheet(unsupported) {
  openSheet(`<div class="help"><h2>Dictée vocale</h2>
    ${unsupported ? `<p class="sub" style="color:var(--late)">Ce navigateur ne propose pas la dictée intégrée. Ouvre le carnet dans Chrome (Android) ou dans Chrome / Edge (PC), ou utilise le micro du clavier ci-dessous.</p>` : '<p class="sub">Parle normalement. Le texte s\'écrit à l\'endroit du curseur.</p>'}
    <dl>
      <dt>« virgule »</dt><dd>,</dd>
      <dt>« point »</dt><dd>. (en fin de phrase)</dd>
      <dt>« point d'interrogation »</dt><dd>?</dd>
      <dt>« deux points »</dt><dd>:</dd>
      <dt>« à la ligne »</dt><dd>nouvelle ligne</dd>
      <dt>« nouveau paragraphe »</dt><dd>ligne vide</dd>
      <dt>« tiret »</dt><dd>nouvelle ligne avec un tiret</dd>
      <dt>« ligne suivante »</dt><dd>saute au champ suivant d'un modèle</dd>
    </dl>
    <p><b>Autre solution, qui marche partout :</b> le micro du clavier. Sur le téléphone, le micro de Gboard ; sur Windows 11, touche <kbd>Windows</kbd> + <kbd>H</kbd> dans une note.</p>
    <p>La dictée intégrée de Chrome passe par le service de reconnaissance vocale de Google : il faut une connexion internet. Tout le reste fonctionne hors connexion.</p>
    <p>Si le micro est refusé : touche le cadenas à gauche de l'adresse (ou Réglages Android → Applications → Chrome → Autorisations) et autorise le micro.</p>
    <div class="actions"><button class="btn primary" data-act="sheet-close">Compris</button></div></div>`);
}

/* ---------- toasts ---------- */
function toast(msg, o = {}) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button>${esc(o.action)}</button>` : ''}`;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (o.action) $('button', el).onclick = () => { kill(); o.onAction(); };
  while (box.children.length > 2) box.firstChild.remove();
  box.append(el);
  setTimeout(kill, o.ms || (o.action ? 5000 : 2600));
}

/* ---------- actions sur les tâches et les notes ---------- */
function toggleTask(id, btn) {
  const t = db.tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done; t.doneAt = t.done ? Date.now() : 0; t.updated = Date.now();
  persist();
  const li = btn && btn.closest('.task');
  if (li) { li.classList.toggle('done', t.done); if (t.done) li.classList.add('leaving'); }
  if (t.done && navigator.vibrate) navigator.vibrate(12);
  setTimeout(() => { renderList(); renderEdTasks(); }, t.done ? 650 : 0);
  if (t.done) toast('Tâche terminée', { action: 'Annuler', onAction: () => { t.done = false; t.doneAt = 0; t.updated = Date.now(); persist(); renderList(); renderEdTasks(); } });
}
function deleteTask(id) {
  const i = db.tasks.findIndex(x => x.id === id); if (i < 0) return;
  const [t] = db.tasks.splice(i, 1); tomb(t.id); persist(); renderList(); renderEdTasks();
  toast('Tâche supprimée', { action: 'Annuler', onAction: () => { delete db.tombs[t.id]; t.updated = Date.now(); db.tasks.splice(i, 0, t); persist(); renderList(); renderEdTasks(); } });
}
function trashNote(id) {
  const n = getNote(id); if (!n) return;
  n.deleted = Date.now(); n.updated = Date.now(); persist();
  toast('Note mise à la corbeille', { action: 'Annuler', onAction: () => { n.deleted = 0; n.updated = Date.now(); persist(); go('#/note/' + n.id); } });
}
/* Petite poubelle sur chaque note de la liste : corbeille directe (30 jours), avec « Annuler » pendant quelques secondes. */
function trashFromList(id) {
  const n = getNote(id); if (!n) return;
  n.deleted = Date.now(); n.updated = Date.now(); persist(); renderList();
  if (navigator.vibrate) navigator.vibrate(12);
  toast('Note mise à la corbeille', { ms: 6000, action: 'Annuler', onAction: () => { n.deleted = 0; n.updated = Date.now(); persist(); renderList(); } });
}
function refreshEditorFolder() {
  if (!editor) return; const n = getNote(editor.id); if (!n) return;
  editor.root.style.setProperty('--c', fColor(n.folderId));
  $('.folder-pill span', detailEl).textContent = fName(n.folderId);
}
async function shareNote(n) {
  const text = (n.title.trim() ? n.title.trim() + '\n\n' : '') + n.body;
  if (navigator.share) { try { await navigator.share({ title: noteTitle(n), text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Note copiée : colle-la où tu veux'); } catch (_) { toast('Copie impossible'); }
}
function startDictatedNote(tpl) {
  const n = newNote();
  go('#/note/' + n.id);
  if (tpl) applyTemplate(tpl);
  edMic();
  if (tpl) toast('Dis « ligne suivante » pour passer au champ suivant', { ms: 4000 });
}

/* ---------- sauvegarde / import ---------- */
const backupName = ext => `carnet-de-fred-${ymd(new Date())}.${ext}`;
const backupText = () => JSON.stringify({ app: 'carnet-de-fred', version: VERSION, exported: new Date().toISOString(), ...db });
function markBackup() { db.settings.lastBackup = Date.now(); persist(); renderList(); }
function exportDownload() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([backupText()], { type: 'application/json' }));
  a.download = backupName('json'); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  markBackup(); toast('Copie enregistrée dans tes téléchargements');
}
async function exportShare() {
  const f = new File([backupText()], backupName('txt'), { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: 'Sauvegarde du Carnet' }); markBackup(); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  exportDownload();
}
function importFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,.txt,application/json,text/plain';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    try { merge(JSON.parse(await f.text())); }
    catch (e) { toast("Ce fichier n'est pas une sauvegarde du Carnet.", { ms: 5000 }); }
  };
  inp.click();
}
/* fusion de deux carnets : chaque élément garde sa version la plus récente,
   les suppressions (« tombs ») l'emportent sur les versions plus anciennes */
function mergeInto(d) {
  if (!d || !Array.isArray(d.notes) || !Array.isArray(d.tasks)) throw new Error('format');
  let add = 0, upd = 0;
  const tombs = d.tombs && typeof d.tombs === 'object' ? d.tombs : {};
  for (const id in tombs) db.tombs[id] = Math.max(db.tombs[id] || 0, tombs[id]);
  const mergeList = (key, list, defaults) => {
    for (const x of list || []) {
      if (!x || !x.id) continue;
      const cur = db[key].find(y => y.id === x.id);
      if (!cur) { db[key].push({ ...defaults, ...x }); add++; }
      else if ((x.updated || 0) > (cur.updated || 0)) { Object.assign(cur, x); upd++; }
    }
    db[key] = db[key].filter(y => !(db.tombs[y.id] && db.tombs[y.id] >= (y.updated || 0)));
  };
  mergeList('folders', d.folders, { order: 99, updated: 0 });
  mergeList('notes', d.notes, { title: '', body: '', deleted: 0, pinned: false });
  mergeList('tasks', d.tasks, { done: false, doneAt: 0 });
  db = fix(db);
  return { add, upd };
}
function merge(d) {
  const r = mergeInto(d);
  persist(); renderList();
  toast(`Import terminé : ${r.add} ajout(s), ${r.upd} mise(s) à jour`, { ms: 4500 });
}
const signature = d => [...(d.folders || []), ...(d.notes || []), ...(d.tasks || [])].map(x => x.id + ':' + (x.updated || 0)).sort().join('|')
  + '#' + Object.keys(d.tombs || {}).sort().join('|');

/* ---------- synchronisation Google Drive ----------
   Un seul fichier caché « carnet-sync.json » dans l'espace privé de l'appli
   sur TON Google Drive (dossier appDataFolder : invisible, seul le carnet y a accès). */
var Sync = {
  SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  FILE: 'carnet-sync.json',
  state: 'off', busy: false, timer: 0, tc: null, tcFor: '', gisP: null,
  clientId() { return (db.settings.gClientId || (window.CARNET_CONFIG && window.CARNET_CONFIG.googleClientId) || '').trim(); },
  token() {
    try { const t = JSON.parse(localStorage.getItem('carnet-ismael:gtok') || 'null'); if (t && t.exp > Date.now()) return t.t; } catch (_) {}
    return null;
  },
  set(s) {
    this.state = s;
    $$('.sync-btn').forEach(b => { b.className = b.className.replace(/\bs-\w+/g, '') + ' s-' + s; b.title = this.label(); });
    const st = $('#sync-status'); if (st) st.textContent = this.label();
  },
  label() {
    return ({ busy: 'Synchronisation…', auth: 'Touche le nuage pour synchroniser', error: 'Échec : touche pour réessayer',
      ok: 'Synchronisé ' + (db.settings.syncLast ? relTime(db.settings.syncLast).toLowerCase() : ''), off: 'Désactivée' })[this.state] || '';
  },
  loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (this.gisP) return this.gisP;
    this.gisP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => { this.gisP = null; rej(new Error('gis')); };
      document.head.append(s);
    });
    return this.gisP;
  },
  // doit être appelé directement dans un clic (sinon la fenêtre Google est bloquée)
  askToken(consent) {
    return new Promise((res, rej) => {
      if (!(window.google && google.accounts && google.accounts.oauth2)) { rej(new Error('gis-not-ready')); return; }
      const cid = this.clientId();
      if (!this.tc || this.tcFor !== cid) {
        this.tc = google.accounts.oauth2.initTokenClient({ client_id: cid, scope: this.SCOPE, callback: () => {} });
        this.tcFor = cid;
      }
      this.tc.callback = r => {
        if (r.error) { rej(new Error(r.error)); return; }
        localStorage.setItem('carnet-ismael:gtok', JSON.stringify({ t: r.access_token, exp: Date.now() + (Number(r.expires_in) - 120) * 1000 }));
        res(r.access_token);
      };
      this.tc.error_callback = e => rej(new Error((e && e.type) || 'popup'));
      this.tc.requestAccessToken({ prompt: consent ? 'consent' : '' });
    });
  },
  async api(url, opts, tok) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + tok, ...((opts && opts.headers) || {}) } });
    if (r.status === 401 || r.status === 403) { localStorage.removeItem('carnet-ismael:gtok'); const e = new Error('auth'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
  },
  connect() {
    if (!this.clientId()) { syncSetupSheet(); return; }
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      this.loadGis().then(() => toast('Prêt : touche encore une fois « Connecter »')).catch(() => toast('Google est injoignable : vérifie la connexion internet.'));
      return;
    }
    this.askToken(true).then(() => {
      db.settings.syncOn = true; dirty = true; saveNow(true); renderList();
      toast('Google Drive connecté ✓'); this.run(false);
    }).catch(e => { console.warn(e); toast("Connexion à Google annulée ou impossible.", { ms: 4500 }); });
  },
  disconnect() {
    const t = this.token();
    if (t && window.google && google.accounts && google.accounts.oauth2) try { google.accounts.oauth2.revoke(t, () => {}); } catch (_) {}
    localStorage.removeItem('carnet-ismael:gtok');
    db.settings.syncOn = false; dirty = true; saveNow(true); this.set('off'); renderList();
    toast('Synchronisation arrêtée');
  },
  schedule() {
    if (!db.settings.syncOn || this.busy) return;
    clearTimeout(this.timer);
    if (!this.token()) { this.set('auth'); return; }
    this.timer = setTimeout(() => this.run(false), 4000);
  },
  run(interactive) {
    if (!db.settings.syncOn || this.busy) { if (!db.settings.syncOn && interactive) go('#/folders'); return; }
    clearTimeout(this.timer);
    const tok = this.token();
    if (tok) { this.exchange(tok, interactive); return; }
    if (!interactive) { this.set('auth'); return; }
    if (!(window.google && google.accounts && google.accounts.oauth2)) { this.loadGis().then(() => toast('Touche encore une fois le nuage')).catch(() => toast('Pas de connexion internet.')); return; }
    this.askToken(false).then(t => this.exchange(t, true)).catch(() => { this.set('auth'); toast('Connexion à Google annulée.'); });
  },
  async exchange(tok, interactive) {
    this.busy = true; this.set('busy');
    try {
      const base = 'https://www.googleapis.com';
      const q = encodeURIComponent(`name='${this.FILE}'`);
      const list = await (await this.api(`${base}/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=${q}`, {}, tok)).json();
      const file = list.files && list.files[0];
      let remote = null;
      if (file) remote = await (await this.api(`${base}/drive/v3/files/${file.id}?alt=media`, {}, tok)).json();
      const before = signature(db);
      if (remote) mergeInto(remote);
      const changedHere = signature(db) !== before;
      const payload = JSON.stringify({ app: 'carnet-de-fred', v: 1, saved: Date.now(), folders: db.folders, notes: db.notes, tasks: db.tasks, tombs: db.tombs });
      if (!remote || signature(remote) !== signature(db)) {
        if (file) await this.api(`${base}/upload/drive/v3/files/${file.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload }, tok);
        else {
          const b = 'carnet' + uid();
          const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: this.FILE, parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${b}--`;
          await this.api(`${base}/upload/drive/v3/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body }, tok);
        }
      }
      db.settings.syncLast = Date.now(); dirty = true; saveNow(true);
      if (changedHere) { renderList(); refreshOpenNote(); }
      this.set('ok');
      if (interactive) toast(changedHere ? 'Synchronisé : nouveautés récupérées ✓' : 'Synchronisé ✓');
    } catch (e) {
      console.warn('Synchro', e);
      this.set(e.auth ? 'auth' : 'error');
      if (interactive) toast(e.auth ? 'Google demande de te reconnecter : touche le nuage.' : 'Synchronisation impossible (connexion ?)', { ms: 4500 });
    } finally { this.busy = false; }
  },
};
function refreshOpenNote() {
  if (!editor) return;
  const n = getNote(editor.id);
  if (!n) { back('#/' + state.listView); return; }
  const a = document.activeElement;
  if (a !== editor.title && a !== editor.body) {
    if (editor.title.value !== n.title) editor.title.value = n.title;
    if (editor.body.value !== n.body) { editor.body.value = n.body; grow(editor.body); }
  }
  refreshEditorFolder(); renderEdTasks();
}
function syncBtn() {
  if (!db.settings.syncOn) return '';
  return `<button class="icon-btn solid sync-btn s-${Sync.state}" data-act="sync-now" aria-label="Synchroniser avec Google Drive" title="${esc(Sync.label())}">${icon('cloud')}${icon('sync', 'spin')}<i class="sdot"></i></button>`;
}
function syncSetupSheet() {
  openSheet(`<h2>Google Drive</h2>
    <p class="sub">Pour relier le carnet à ton compte Google, il faut un « ID client » (une seule fois). La marche à suivre est dans le fichier LISEZMOI, section 5 : environ 10 minutes.</p>
    <div class="field"><label for="gc-id">ID client Google</label>
      <input id="gc-id" class="input" placeholder="123456-abc.apps.googleusercontent.com" value="${esc(db.settings.gClientId)}" autocomplete="off" spellcheck="false"></div>
    <p class="sub">Tes notes iront dans un espace caché de ton Drive, que seul le carnet peut lire. Rien n'est envoyé ailleurs.</p>
    <div class="actions"><button class="btn" data-act="sheet-close">Annuler</button><button class="btn primary" id="gc-ok">Enregistrer</button></div>`, el => {
    const inp = $('#gc-id', el);
    $('#gc-ok', el).onclick = () => {
      const v = inp.value.trim();
      if (v && !/\.apps\.googleusercontent\.com$/.test(v)) { toast("Cet identifiant ne ressemble pas à un ID client Google (il finit par .apps.googleusercontent.com)", { ms: 5000 }); return; }
      db.settings.gClientId = v; dirty = true; saveNow(true);
      if (v) Sync.loadGis().catch(() => {});
      closeSheet(() => { renderList(); if (v) toast('Enregistré. Touche « Connecter mon compte Google ».', { ms: 4000 }); });
    };
  });
}

/* ---------- thème, badge, installation ---------- */
function applyTheme() {
  const t = db.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';   // 1.6.5 : thème toujours net, jamais à moitié sombre
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#0f2538' : '#f2f8fc');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function updateBadge() {
  const n = urgentTasks().length, b = $('#task-badge');
  b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
  try { if (navigator.setAppBadge) { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (_) {}
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installEvt = e; if (['notes', 'folders'].includes(state.listView)) renderList(); });
window.addEventListener('appinstalled', () => { state.installEvt = null; renderList(); toast('Carnet installé ✓'); });

/* ---------- toutes les actions (clics) ---------- */
const ACT = {
  'nav': el => go(el.dataset.to),
  'fab': () => {
    if (editor) { edMic(); return; }
    if (Dict.on) { Dict.stop(); return; }
    startDictatedNote();
  },
  'new-note': () => { const n = newNote(); go('#/note/' + n.id); setTimeout(() => editor && editor.body.focus(), 330); },
  'new-lesson': () => startDictatedNote(TEMPLATES[0]),
  'new-task': () => taskSheet(null),
  'trash-card': el => trashFromList(el.dataset.id),
  'open-note': el => { if (editor && editor.id === el.dataset.id) return; state.wide && editor ? go('#/note/' + el.dataset.id, true) : go('#/note/' + el.dataset.id); },
  'filter': el => {
    const id = el.dataset.id;
    db.settings.filter = el.classList.contains('pad') && db.settings.filter === id ? 'all' : id;   // re-toucher un pad = tout afficher
    if (navigator.vibrate && el.classList.contains('pad')) navigator.vibrate(8);
    persist(); renderList();
  },
  'tfilter': el => { db.settings.taskFilter = el.dataset.id; persist(); renderList(); },
  'sfilter': el => { state.sfilter = el.dataset.id; $$('.chips [data-act="sfilter"]').forEach(c => c.classList.toggle('on', c === el)); renderSearchResults(); },
  'q-clear': () => { state.query = ''; state.rendered = ''; renderList(); },
  'folder-new': () => folderSheet(null),
  'folder-edit': (el, e) => { e.stopPropagation(); folderSheet(folderById(el.dataset.id)); },
  'folder-open': el => { db.settings.filter = el.dataset.id; persist(); go('#/notes'); },
  'task-toggle': (el, e) => { e.stopPropagation(); toggleTask(el.dataset.id, el); },
  'task-edit': el => taskSheet(db.tasks.find(t => t.id === el.dataset.id)),
  'toggle-done': () => { state.showDone = !state.showDone; renderList(); },
  'qa-mic': el => {
    if (Dict.on) { Dict.stop(); return; }
    const inp = $('#qa');
    Dict.start({ single: true,
      final: tx => { inp.value = spokenToText(tx).replace(/\n+/g, ' '); qaHint(); },
      interim: tx => { if (tx) inp.value = tx; },
      state: on => { el.classList.toggle('rec', on); inp.placeholder = on ? "J'écoute… ex. « Appeler Lucas vendredi »" : 'Nouvelle tâche… ex. « Appeler la mairie vendredi »'; },
      end: () => { if ($('#qa') && $('#qa').value.trim()) addQuickTask(); } });
  },
  'theme': el => { db.settings.theme = el.dataset.val; applyTheme(); persist(); renderList(); },
  'help': () => helpSheet(false),
  'install': async () => {
    const e = state.installEvt;
    if (!e) { toast("Utilise le menu ⋮ de Chrome → « Installer l'application »", { ms: 5000 }); return; }
    e.prompt(); const r = await e.userChoice.catch(() => ({}));
    if (r && r.outcome === 'accepted') state.installEvt = null;
    renderList();
  },
  'install-hide': () => { db.settings.installHidden = true; persist(); renderList(); },
  'export': exportDownload,
  'export-share': exportShare,
  'import': importFile,
  'restore': el => { const n = db.notes.find(x => x.id === el.dataset.id); if (n) { n.deleted = 0; n.updated = Date.now(); persist(); renderList(); toast('Note restaurée'); } },
  'purge': el => confirmSheet('Effacer définitivement ?', 'Cette note ne pourra plus être récupérée.', 'Effacer', () => {
    tomb(el.dataset.id); db.notes = db.notes.filter(x => x.id !== el.dataset.id); persist(); renderList();
  }),
  'trash-empty': () => confirmSheet('Vider la corbeille ?', 'Toutes les notes de la corbeille seront effacées définitivement.', 'Vider', () => {
    db.notes.filter(x => x.deleted).forEach(x => tomb(x.id));
    db.notes = db.notes.filter(x => !x.deleted); persist(); renderList(); toast('Corbeille vidée');
  }),

  /* agenda, déco, synchro */
  'cal-day': el => {
    if (state.swiped && Date.now() - state.swiped < 400) return;
    const c = state.cal, k = el.dataset.d;
    c.sel = !c.wd.length && c.sel === k ? null : k; c.wd = [];
    renderList();
  },
  'cal-move': el => calMove(+el.dataset.n),
  'cal-today': () => { const n = new Date(); Object.assign(state.cal, { y: n.getFullYear(), m: n.getMonth(), sel: ymd(n), wd: [] }); renderList(); },
  'cal-wd': el => {
    const w = +el.dataset.w, c = state.cal;
    c.wd = c.wd.includes(w) ? c.wd.filter(x => x !== w) : c.wd.concat(w);
    renderList();
  },
  'groove': el => { el.classList.remove('play'); void el.offsetWidth; el.classList.add('play'); },
  'sync-now': () => Sync.run(true),
  'sync-setup': () => syncSetupSheet(),
  'sync-connect': () => Sync.connect(),
  'sync-off': () => confirmSheet('Arrêter la synchronisation ?', 'Tes notes restent sur cet appareil et dans ton Google Drive. Tu pourras te reconnecter quand tu veux.', 'Arrêter', () => Sync.disconnect()),
  'sheet-close': () => closeSheet(),
  'update-app': () => { updateWanted = true; if (waitingSW) waitingSW.postMessage('skipWaiting'); else location.reload(); },

  /* éditeur */
  'ed-back': () => back('#/' + state.listView),
  'ed-mic': edMic,
  'ed-pin': el => {
    const n = getNote(editor.id); n.pinned = !n.pinned; n.updated = Date.now(); persist();
    el.classList.toggle('on', n.pinned); el.setAttribute('aria-pressed', n.pinned);
    toast(n.pinned ? 'Note épinglée en haut' : 'Note désépinglée'); renderList();
  },
  'ed-folder': () => {
    const n = getNote(editor.id);
    folderPicker(n.folderId, id => { n.folderId = id; n.updated = Date.now(); db.settings.lastFolder = id; persist(); refreshEditorFolder(); renderList(); });
  },
  'ed-template': () => openSheet(`<h2>Modèles</h2><p class="sub">Le modèle s'ajoute à la note. Dis « ligne suivante » pour passer d'un champ à l'autre.</p>
    <ul class="menu">${TEMPLATES.map((t, i) => `<li><button data-i="${i}"><span class="emo f-ic">${icon({ cours: 'drum', spectacle: 'spark', reunion: 'users', exo: 'bolt' }[t.id] || 'template')}</span><span>${esc(t.name)}<small>${esc(t.desc)}</small></span></button></li>`).join('')}</ul>`,
    el => $$('[data-i]', el).forEach(b => b.onclick = () => closeSheet(() => applyTemplate(TEMPLATES[+b.dataset.i])))),
  'ed-task': () => {
    const ed = editor, n = getNote(ed.id), b = ed.body;
    let text = '';
    if (b.touched) {
      const v = b.value, s = b.selectionStart, e = b.selectionEnd;
      if (e > s) text = v.slice(s, e);
      else { const ls = v.lastIndexOf('\n', s - 1) + 1, le = v.indexOf('\n', s); text = v.slice(ls, le === -1 ? v.length : le); }
    }
    text = text.replace(/^[\s–\-•*]+/, '').replace(/^[^:\n]{1,30}:\s*(?=\S)/, m => /faire|tâche/i.test(m) ? '' : m).trim();
    taskSheet(null, { text, noteId: n.id, folderId: n.folderId });
  },
  'ed-share': () => shareNote(getNote(editor.id)),
  'ed-done': () => {
    const a = document.activeElement, typing = a && (a === editor.body || a === editor.title);
    if (Dict.on) Dict.stop();
    saveNow();
    if (typing) { a.blur(); toast('Enregistré ✓'); } else back('#/' + state.listView);
  },
  'ed-more': () => {
    const n = getNote(editor.id);
    openSheet(`<h2>${esc(noteTitle(n))}</h2><ul class="menu">
      <li><button data-m="folder">${icon('folder')}<span>Ranger dans un autre dossier<small>${esc(fName(n.folderId))}</small></span></button></li>
      <li><button data-m="template">${icon('template')}Insérer un modèle</button></li>
      <li><button data-m="task">${icon('task-add')}Créer une tâche liée</button></li>
      <li><button data-m="copy">${icon('copy')}Dupliquer la note</button></li>
      <li><button data-m="share">${icon('share')}Partager / copier le texte</button></li>
      <li><button data-m="delete" class="danger">${icon('trash')}Mettre à la corbeille</button></li></ul>`, el => {
      $$('[data-m]', el).forEach(b => b.onclick = () => {
        const m = b.dataset.m;
        if (m === 'folder') { ACT['ed-folder'](); return; }
        closeSheet(() => {
          if (m === 'template') ACT['ed-template']();
          else if (m === 'task') taskSheet(null, { noteId: n.id, folderId: n.folderId });
          else if (m === 'share') shareNote(n);
          else if (m === 'copy') {
            const now = Date.now(), c = { ...n, id: uid(), title: (n.title || noteTitle(n)) + ' (copie)', pinned: false, created: now, updated: now };
            db.notes.push(c); persist(); go('#/note/' + c.id, true); toast('Note dupliquée');
          } else if (m === 'delete') { const id = n.id; back('#/' + state.listView); setTimeout(() => trashNote(id), 50); }
        });
      });
    });
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('[data-act][tabindex]')) { e.target.click(); return; }
  if (e.key === 'Escape') {
    if (sheet) { closeSheet(); return; }
    if (Dict.on) { Dict.stop(); return; }
    if (editor) { ACT['ed-back'](); return; }
  }
  if (e.altKey && !e.ctrlKey) {
    const k = e.key.toLowerCase();
    if (k === 'd') { e.preventDefault(); ACT.fab(); }
    else if (k === 'n') { e.preventDefault(); ACT['new-note'](); }
    else if (k === 't') { e.preventDefault(); taskSheet(null); }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); go('#/search'); setTimeout(() => $('#q') && $('#q').focus(), 50); }
});

/* recherche et ajout rapide de tâche */
let searchT = 0;
document.addEventListener('input', e => {
  if (e.target.id === 'q') {
    state.query = e.target.value; clearTimeout(searchT); searchT = setTimeout(renderSearchResults, 90);
    const f = $('#search-form'), hasX = $('[data-act="q-clear"]', f);
    if (state.query && !hasX) f.insertAdjacentHTML('beforeend', `<button type="button" class="round" data-act="q-clear" aria-label="Effacer">${icon('x')}</button>`);
    if (!state.query && hasX) hasX.remove();
  }
  if (e.target.id === 'qa') qaHint();
});
function qaHint() {
  const h = $('#qa-hint'), v = $('#qa') && $('#qa').value; if (!h) return;
  const p = parseTask(v || '');
  h.innerHTML = v && p.due ? `${icon('cal')}Échéance : <b>${dueLabel(p.due)}</b> · ${esc(fmt(fromYmd(p.due), { day: 'numeric', month: 'long' }))}` : '';
}
function addQuickTask() {
  const inp = $('#qa'); const v = inp.value.trim(); if (!v) return;
  const p = parseTask(v), now = Date.now(), sel = db.settings.taskFilter;
  const t = { id: uid(), text: p.text || cap(v), due: p.due, done: false, doneAt: 0, folderId: folderById(sel) ? sel : null, noteId: null, created: now, updated: now };
  db.tasks.push(t); persist(); inp.value = ''; renderList();
  const ni = $('#qa'); if (ni && !IS_ANDROID) ni.focus();
  toast(`Tâche ajoutée${t.due ? ' · ' + dueLabel(t.due).toLowerCase() : ''}`, { action: 'Annuler', onAction: () => { db.tasks = db.tasks.filter(x => x !== t); persist(); renderList(); } });
}
document.addEventListener('submit', e => { if (e.target.id === 'qa-form') { e.preventDefault(); addQuickTask(); } });

/* enregistrement de sécurité quand on quitte */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow();
  else { updateBadge(); if (!editor) renderList(); if (db.settings.syncOn && Sync.token()) Sync.run(false); }
});
window.addEventListener('pagehide', saveNow);
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  try { db = fix(JSON.parse(e.newValue)); renderList(); renderEdTasks(); updateBadge(); } catch (_) {}
});
setInterval(() => { if (!document.hidden && !editor && ['notes', 'tasks'].includes(state.listView)) renderList(); else updateMeta(); }, 60000);

/* ---------- service worker & mises à jour ---------- */
let waitingSW = null, updateWanted = false;
function showUpdate(w) { waitingSW = w; $('#update-bar').hidden = false; }
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(e => console.warn('SW', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateWanted) { saveNow(); location.reload(); } });
}

/* repérer un bandeau ajouté par l'hébergeur (ex. « Powered by Netlify ») et se placer au-dessus */
function avoidOverlays() {
  let h = 0;
  for (const el of document.body.children) {
    if (['app', 'sheet-layer', 'toasts', 'update-bar'].includes(el.id) || /^(script|svg|style|link)$/i.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 160 && r.bottom > innerHeight - 160) h = Math.max(h, innerHeight - r.top);
  }
  document.documentElement.style.setProperty('--overlay', h ? Math.round(h + 4) + 'px' : '0px');
}
[400, 1500, 3500, 8000].forEach(t => setTimeout(avoidOverlays, t));
new MutationObserver(() => setTimeout(avoidOverlays, 300)).observe(document.body, { childList: true });
window.addEventListener('resize', () => setTimeout(avoidOverlays, 200));

/* outils de diagnostic (console) */
window.carnet = { parseTask, spokenToText, version: VERSION, mergeInto, signature, data: () => db, insertSpoken: (raw) => editor && insertSpoken(editor.target || editor.body, raw, editor.target === editor.title) };

/* ---------- démarrage ---------- */
applyTheme();
dirty = true; saveNow(true);                           // enregistre le carnet (et les éventuelles migrations) dès l'ouverture
history.replaceState(null, '', location.href);
const params = new URLSearchParams(location.search);
const shared = [params.get('share_title'), params.get('share_text'), params.get('share_url')].filter(Boolean);
const action = params.get('action');
if (location.search) history.replaceState(null, '', location.pathname + (location.hash || '#/notes'));
if (db.settings.syncOn) {                              // synchro au démarrage si Google est encore « ouvert »
  Sync.state = Sync.token() ? 'ok' : 'auth';
  Sync.loadGis().catch(() => {});
} else if (Sync.clientId()) Sync.loadGis().catch(() => {});
route();
updateBadge();
if (db.settings.syncOn && Sync.token()) Sync.run(false);

if (shared.length) {                                   // texte reçu par « Partager » (Android)
  const n = newNote();
  const [t, ...rest] = shared;
  if (shared.length > 1 && t.length < 120) { n.title = t; n.body = rest.join('\n'); } else n.body = shared.join('\n');
  n.updated = Date.now(); persist();
  go('#/note/' + n.id);
  toast('Note créée à partir du partage');
} else if (action === 'dictate') startDictatedNote();
else if (action === 'lesson') startDictatedNote(TEMPLATES[0]);
else if (action === 'task') { go('#/tasks'); setTimeout(() => taskSheet(null), 100); }
else if (action === 'search') go('#/search');

})();
