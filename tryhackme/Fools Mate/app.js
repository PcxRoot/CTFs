import { Chess } from '../vendor/chess.js';

const START_FEN = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
const FILES = 'abcdefgh';
const SMUG = ['Sure, go ahead.', 'Bold.', 'Cute.'];

  
const boardEl = document.getElementById('board');
const ranksEl = document.getElementById('ranks');
const filesEl = document.getElementById('files');
const moveListEl = document.getElementById('moveList');
const statusText = document.getElementById('statusText');
const turnDot = document.getElementById('turnDot');
const flagBanner = document.getElementById('flagBanner');
const resetBtn = document.getElementById('resetBtn');
const toastStack = document.getElementById('toastStack');
const modalOverlay = document.getElementById('modalOverlay');
const winMessage = document.getElementById('winMessage');
const winOk = document.getElementById('winOk');

const game = new Chess(START_FEN);
const sqDivs = {};

let els = {};
let history = [];
let selected = null;
let locked = false;
  
let dragEl = null;
let dragFrom = null;
let dragging = false;
let downX = 0;
let downY = 0;
  

function sqToXY(sq) {
  const f = FILES.indexOf(sq[0]);
  const r = parseInt(sq[1], 10);
  return { x: f * 12.5, y: (8 - r) * 12.5 };
}
  
function codeOf(cell) {
  return cell.color + cell.type.toUpperCase();
}
  
function buildBoard() {
  for (let r = 8; r >= 1; r--) {
    for (let f = 0; f < 8; f++) {
      const sq = FILES[f] + r;
      const d = document.createElement('div');
      const isLight = (f + r) % 2 !== 0;
      d.className = 'square ' + (isLight ? 'light' : 'dark');
      const { x, y } = sqToXY(sq);
      d.style.left = x + '%';
      d.style.top = y + '%';
      d.dataset.square = sq;
      boardEl.appendChild(d);
      sqDivs[sq] = d;
    }
  }
  for (let r = 8; r >= 1; r--) {
    const s = document.createElement('span');
    s.textContent = r;
    ranksEl.appendChild(s);
  }
  for (let f = 0; f < 8; f++) {
    const s = document.createElement('span');
    s.textContent = FILES[f];
    filesEl.appendChild(s);
  }
}
  
function setElPos(el, sq, instant) {
  const { x, y } = sqToXY(sq);
  if (instant) {
    el.style.transition = 'none';
    el.style.left = x + '%';
    el.style.top = y + '%';
    void el.offsetWidth;
    el.style.transition = '';
  } else {
    el.style.left = x + '%';
    el.style.top = y + '%';
  }
}
  
function renderFull() {
  for (const el of Object.values(els)) el.remove();
  els = {};
  const board = game.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = board[row][col];
      if (!cell) continue;
      const sq = FILES[col] + (8 - row);
      const el = document.createElement('div');
      el.className = 'piece ' + codeOf(cell);
      el.dataset.square = sq;
      const { x, y } = sqToXY(sq);
      el.style.transition = 'none';
      el.style.left = x + '%';
      el.style.top = y + '%';
      boardEl.appendChild(el);
      els[sq] = el;
    }
  }
  void boardEl.offsetWidth;
  for (const el of Object.values(els)) el.style.transition = '';
  refreshHighlights();
}
  
function animateMove(from, to) {
  const el = els[from];
  if (!el) { renderFull(); return; }
  if (els[to]) {
    const cap = els[to];
    delete els[to];
    setTimeout(() => cap.remove(), 170);
  }
  setElPos(el, to, false);
  el.dataset.square = to;
  delete els[from];
  els[to] = el;
}
  
function clearHints() {
  boardEl.querySelectorAll('.hint').forEach((n) => n.remove());
}
  
function showHints(sq) {
  clearHints();
  const moves = game.moves({ square: sq, verbose: true });
  for (const m of moves) {
    const h = document.createElement('div');
    const occupied = !!els[m.to] || m.flags.includes('e');
    h.className = 'hint' + (occupied ? ' capture' : '');
    const { x, y } = sqToXY(m.to);
    h.style.left = x + '%';
    h.style.top = y + '%';
    const spot = document.createElement('div');
    spot.className = 'spot';
    h.appendChild(spot);
    boardEl.appendChild(h);
  }
}
  
function clearSelection() {
  if (selected && sqDivs[selected]) sqDivs[selected].classList.remove('selected');
  selected = null;
  clearHints();
}
  
function select(sq) {
  clearSelection();
  selected = sq;
  sqDivs[sq].classList.add('selected');
  showHints(sq);
}
  
function refreshHighlights() {
  Object.values(sqDivs).forEach((d) => d.classList.remove('in-check'));
  if (game.isCheck() || game.isCheckmate()) {
    const turn = game.turn();
    const board = game.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = board[row][col];
        if (cell && cell.type === 'k' && cell.color === turn) {
          sqDivs[FILES[col] + (8 - row)].classList.add('in-check');
        }
      }
    }
  }
}
  
function setLastMove(from, to) {
  Object.values(sqDivs).forEach((d) => d.classList.remove('last-move'));
  if (sqDivs[from]) sqDivs[from].classList.add('last-move');
  if (sqDivs[to]) sqDivs[to].classList.add('last-move');
}
  
function recordMove(san, color) {
  if (color === 'w') history.push({ w: san, b: '' });
  else if (history.length) history[history.length - 1].b = san;
  renderMoveList();
}
  
function renderMoveList() {
  moveListEl.innerHTML = '';
  history.forEach((mv, i) => {
    const num = document.createElement('li');
    num.className = 'num';
    num.textContent = i + 1 + '.';
    const w = document.createElement('li');
    w.className = 'ply';
    w.textContent = mv.w;
    const b = document.createElement('li');
    b.className = 'ply';
    b.textContent = mv.b;
    if (i === history.length - 1) {
      (mv.b ? b : w).classList.add('last');
    }
    moveListEl.appendChild(num);
    moveListEl.appendChild(w);
    moveListEl.appendChild(b);
  });
  moveListEl.scrollTop = moveListEl.scrollHeight;
} 

function updateStatus() {
  const turn = game.turn();
  turnDot.classList.toggle('black', turn === 'b');
  if (game.isCheckmate()) {
    statusText.textContent = turn === 'b' ? 'Checkmate \u2014 White wins' : 'Checkmate \u2014 Black wins';
  } else if (game.isStalemate()) {
    statusText.textContent = 'Stalemate';
  } else if (game.isDraw()) {
    statusText.textContent = 'Draw';
  } else if (game.isCheck()) {
    statusText.textContent = (turn === 'w' ? 'White' : 'Black') + ' in check';
  } else {
    statusText.textContent = (turn === 'w' ? 'White' : 'Black') + ' to move';
  }
}

function showFlag(flag) {
  flagBanner.hidden = false;
  flagBanner.textContent = flag;
}
  
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastStack.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 220);
  }, 1700);
} 

function showSystemNotice(msg) {
  winMessage.textContent = msg;
  modalOverlay.hidden = false;
}
  
function hideSystemNotice() {
  modalOverlay.hidden = true;
}
  
function preMoveCheck(from, to, promotion) {
  const probe = new Chess(game.fen());
  let result;
  try {
    result = probe.move({ from, to, promotion: promotion || undefined });
  } catch (e) {
    result = null;
  }
  if (result && probe.isCheckmate()) {
    showSystemNotice("I'll shut down your PC if you play that.");
    return false;
  }
  return true;
}
  
function isLegalTarget(from, to) {
  return game.moves({ square: from, verbose: true }).some((m) => m.to === to);
}
  
function needsPromotion(from, to) {
  return game.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion);
} 

async function sendMove(from, to, promotion) {
  locked = true;
  let data;
  try {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, promotion: promotion || undefined })
    });
    data = await res.json();
  } catch (e) {
    locked = false;
    renderFull();
    return;
  }
  if (!data || !data.ok) {
    locked = false;
    renderFull();
    return;
  }
  
  const pMove = game.move({ from, to, promotion: promotion || undefined });
  animateMove(from, to);
  recordMove(pMove ? pMove.san : from + to, 'w');
  setLastMove(from, to);
  
  if (data.botMove) {
    const bf = data.botMove.slice(0, 2);
    const bt = data.botMove.slice(2, 4);
    const bp = data.botMove.slice(4);
    setTimeout(() => {
      const bMove = game.move({ from: bf, to: bt, promotion: bp || undefined });
      animateMove(bf, bt);
      recordMove(bMove ? bMove.san : bf + bt, 'b');
      setLastMove(bf, bt);
      if (game.fen() !== data.fen) { game.load(data.fen); renderFull(); }
      finalize(data);
      locked = game.isGameOver();
    }, 220);
  } else {
    if (game.fen() !== data.fen) { game.load(data.fen); renderFull(); }
    finalize(data);
    locked = game.isGameOver();
  }
} 

function finalize(data) {
  refreshHighlights();
  updateStatus();
  if (data.flag) showFlag(data.flag);
}
  
function doMove(from, to) {
  if (!isLegalTarget(from, to)) return false;
  const promotion = needsPromotion(from, to) ? 'q' : undefined;
  if (!preMoveCheck(from, to, promotion)) {
    setElPos(els[from], from, true);
    return true;
  }
  toast(SMUG[Math.floor(Math.random() * SMUG.length)]);
  sendMove(from, to, promotion);
  return true;
}
  
function pointAtSquare(clientX, clientY) {
  const rect = boardEl.getBoundingClientRect();
  const fx = (clientX - rect.left) / rect.width;
  const fy = (clientY - rect.top) / rect.height;
  if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return null;
  const col = Math.floor(fx * 8);
  const row = Math.floor(fy * 8);
  return FILES[col] + (8 - row);
}
  
function onPointerDown(e) {
  if (locked) return;
  const sq = pointAtSquare(e.clientX, e.clientY);
  if (!sq) return;
  
  if (selected && selected !== sq && isLegalTarget(selected, sq)) {
    const from = selected;
    clearSelection();
    doMove(from, sq);
    return;
  }
  
  const piece = game.get(sq);
  if (piece && piece.color === 'w' && game.turn() === 'w' && els[sq]) {
    select(sq);
    dragEl = els[sq];
    dragFrom = sq;
    dragging = false;
    downX = e.clientX;
    downY = e.clientY;
    dragEl.setPointerCapture(e.pointerId);
  } else {
    clearSelection();
  }
}
  
function onPointerMove(e) {
  if (!dragEl) return;
  if (!dragging) {
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist < 5) return;
    dragging = true;
    dragEl.classList.add('dragging');
  }
  const rect = boardEl.getBoundingClientRect();
  let px = ((e.clientX - rect.left) / rect.width) * 100 - 6.25;
  let py = ((e.clientY - rect.top) / rect.height) * 100 - 6.25;
  px = Math.max(-6.25, Math.min(93.75, px));
  py = Math.max(-6.25, Math.min(93.75, py));
  dragEl.style.transition = 'none';
  dragEl.style.left = px + '%';
  dragEl.style.top = py + '%';
}

function onPointerUp(e) {
  if (!dragEl) return;
  const el = dragEl;
  const from = dragFrom;
  const wasDragging = dragging;
  dragEl = null;
  dragFrom = null;
  dragging = false;
  el.classList.remove('dragging');
  el.style.transition = '';
  
  if (!wasDragging) {
    return;
  }
  
  const drop = pointAtSquare(e.clientX, e.clientY);
  if (drop && drop !== from && isLegalTarget(from, drop)) {
    setElPos(el, from, true);
    clearSelection();
    doMove(from, drop);
  } else {
    setElPos(el, from, true);
    clearSelection();
  }
}
  
async function reset() {
  let data;
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
    data = await res.json();
  } catch (e) {
    return;
  }
  game.load(data && data.fen ? data.fen : START_FEN);
  history = [];
  renderMoveList();
  Object.values(sqDivs).forEach((d) => d.classList.remove('last-move', 'in-check', 'selected'));
  selected = null;
  flagBanner.hidden = true;
  flagBanner.textContent = '';
  locked = false;
  renderFull();
  updateStatus();
}
  
boardEl.addEventListener('pointerdown', onPointerDown);
boardEl.addEventListener('pointermove', onPointerMove);
boardEl.addEventListener('pointerup', onPointerUp);
boardEl.addEventListener('pointercancel', onPointerUp);
resetBtn.addEventListener('click', reset);
winOk.addEventListener('click', hideSystemNotice);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideSystemNotice(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSystemNotice(); });
  
buildBoard();
renderFull();
updateStatus();
