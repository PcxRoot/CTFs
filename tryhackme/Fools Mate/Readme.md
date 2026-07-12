# Reconocimiento

```bash
sudo nmap -p- -Pn -sS -n -vvv --min-rate 1000 $IP

PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

```bash
sudo nmap -p 22,80 -Pn -n -v --min-rate -sVC -oN versiones $IP

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 6c:85:e1:51:dd:5f:0e:7f:2a:31:ec:72:35:2f:f6:5d (ECDSA)
|_  256 b4:96:71:97:52:71:ad:8a:13:b2:e3:a5:26:28:50:3f (ED25519)
80/tcp open  http    Node.js Express framework
|_http-title: Endgame Trainer
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## Entorno Web

Cuando accedemos a la app web nos encontramos con una partida de ajedrez casi terminada. La situación es la siguiente:

![tablero_ajedrez_inicial](./tablero_ajedrez_inicial.png)

Siendo las piezas blancas, partimos con la ventaja de tener una pieza extra (la torre en `a1`), la cual nos permite ganar la partida en un movimiento.

>[!Note]
>El ***mate del pasillo*** ocurre cuando el rey está atrapado en la última fila por sus propios peones, sin poder moverse a los lados.
>
>En esta ocasión, nuestra torre en `a1` nos permite realizar este mate moviéndolo a la casilla `a8`.
>![Mate del pasillo](./Mate_del_pasillo)

Sin embargo, si intentamos este movimiento (o cualquier otro que nos permite hacer ***Jaque Mate***) nos mostrará una ventana emergente estilo retro que nos mostrará el mensaje `"I'll shut down your PC if you play that."`.

### `app.js`
Viendo el código fuente de la app, podemos ver que se carga un archivo JavaScript desde `./js/app.js` el cual contiene el código de la lógica del juego (incluido la trampa).

```JS
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
```

Lo primero que debemos saber es en bajo que circunstancias se nos devuelve la *flag* desde el servidor. Viendo el código descubrimos que cuando conseguimos hacer ***Jaque Mate*** se nos devuelve la *flag* en formato ***JSON*** en la respuesta del servidor.

El problema viene con la función `preMoveCheck()`, en la cual vemos que si el movimiento que vamos a mandar al servidor es un ***Jaque Mate*** se muestra el mensaje que comentamos antes y no se manda la petición al servidor.

```JS
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
```

### Client-Side Validation Bypass

La estructura de la aplicación web tiene una vulnerabilidad crítica en como gestiona la validación de la lógica del programa. El problema está en que el código que valida si la jugada del usuario es ***Jaque Mate*** para bloquearlo vive en el código JavaScript que se ejecuta en el ***navegador*** (es decir, en el ***Cliente***).

>[!important]
>Las ***validaciones en el lado del cliente*** son estrictamente para la ***experiencia de usuario (UX)*** y el ***rendimiento de la aplicación***, ***NUNCA PARA LA SEGURIDAD DE LA MISMA***.

Por ejemplo, imaginemos una aplicación de un banco en el que debemos de rellenar ***20 campos de datos***.

1. Rellenamos todos los campos y pulsamos en ***Enviar***.
2. Los datos viajan por Internet hasta el servidor.
3. El servidor procesa la solicitud para darse cuenta de que la contraseña no tiene una mayúscula obligatoria.
4. El servidor nos devuelve un error, la pagina recarga y... hemos perdido todos los datos que rellenamos y tenemos que empezar de cero!

Con la validación en el cliente, en el momento en que cambiamos de campo de texto, JavaScript nos pone un mensajito en rojo al instante: "*La contraseña debe tener una mayúscula*". El usuario corrige el error en tiempo real sin frustrarse.

Además, procesar peticiones web cuesta dinero (CPU, memoria, base de datos).
Si un usuario se equivoca y pone `hola.com` en vez de `hola@gmail.com`, *qué sentido tiene hacer que el **backend** gaste recursos de procesamiento y ancho de banda en rechazar algo tan obvio?* Javascript frena esa petición antes de que salga del navegador del usuario. Actúa como un filtro para que el servidor solo le llegue tráfico que, en principio, tiene sentido.

>[!important]
>***Valida en el cliente para ayudar al usuario. Valida en el servidor para proteger la aplicación***

En este caso, la función `preMoveCheck` se podría usar para comprobar que el movimiento del usuario fuera legal. No obstante, se utiliza para impedir que el usuario pueda hacer ***Jaque Mate***, pero como esta validación se hace en el lado del cliente (a través del código JavaScript que ejecuta nuestro navegador), eso significa que podemos modificar la forma en la que enviamos la petición HTTP para el movimiento.

#### `curl` y ***Burp Suite***

Como he comentado, el código JavaScript se ejecuta de forma automática en el navegador, impidiéndonos enviar la petición HTTP y ganando la partida. Sin embargo, podemos realizar la petición directamente con herramientas como `curl` o ***Burp Suite*** para saltarnos esta validación del código JavaScript.

#### ***Burp Suite***

Para poder explotar esta vulnerabilidad a través de ***Burp Suite*** debemos de inicializar la herramienta y empezar a interceptar las peticiones y respuestas HTTP.

1. Una vez empecemos a interceptar las peticiones y respuestas, podemos simplemente mover uno de los peones a cualquier posición legal.
2. Ahora podremos ver la petición y la respuesta en el historial de ***Burp Suite***. Daremos clic en la petición y pulsaremos al combinación de teclas `CTRL + R`, así mandaremos la petición al ***Repeater de Burp Suite*** y podremos modificar la petición a nuestro antojo y ver las respuestas del servidor.
3. Una vez dentro del ***Repeater*** veremos que la petición tiene dos parámetros `from` y `to` los cuales son la posición en la que estaba la pieza y a la que se mueve.

```HTTP
POST /api/move HTTP/1.1
Host: $IP
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: */*
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Referer: http://10.129.174.84/
Content-Type: application/json
Content-Length: 23
Origin: http://10.129.174.84
Connection: keep-alive
Priority: u=0

{
	"from":"f2",
	"to":"f3"
}
```

4. Ahora podemos enviar una petición al servidor en la que movamos la ***torre*** en la casilla `a1` a la casilla `a8` (***Mate del pasillo***). Como no se ejecuta el código JavaScript y en el ***backend*** no se valida la trampa como en el ***frontend***, se tomará como una jugada válida, la aplicación web verá que hemos ganado la partida y nos devolverá la *flag*.

```HTTP
POST /api/move HTTP/1.1
Host: $IP
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: */*
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Referer: http://10.129.174.84/
Content-Type: application/json
Content-Length: 23
Origin: http://10.129.174.84
Connection: keep-alive
Priority: u=0

{
	"from":"a1",
	"to":"a8"
}
```

```HTTP
HTTP/1.1 200 OK
X-Powered-By: Express
Set-Cookie: sid=992332e4be2ff8491bfe4510b429312b; Path=/; HttpOnly; SameSite=Lax
Content-Type: application/json; charset=utf-8
Content-Length: 155
ETag: W/"9b-4UJFSVz7fqu+CivQPQPb7IbmWH0"
Date: Sun, 12 Jul 2026 13:45:04 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{
	"ok":true,
	"move":"a1a8",
	"fen":"R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1",
	"status":"checkmate",
	"turn":"b",
	"winner":"white",
	"flag":"THM{[hidden]}"
}
```

#### `curl`

Con la herramienta `curl` podemos hacer exactamente lo mismo desde la línea de comandos.

1. Primero necesitamos conocer el ***API Endpoint*** con el cual se comunica el navegador para los movimientos de las piezas. Esta información podemos sacarla de la función `sendMove` del código JavaScript, en el que podemos ver que espera la respuesta del servidor en el ***API Endpoint*** `/api/move`.
2. Una vez conociendo el endpoint con el que debemos de comunicarnos, tan solo tenemos que especificar el tipo del contenido (`Content-Type: application/json`) y los parámetros que deseamos (`{"from":"a1","to":"a8"}`)

```bash
# Si lanza un error relacionado con jq significa que no lo tienes instalado
# No es importante, tan solo decora la salida en formato JSON del servidor, por lo que podemos quitarla sin problema
curl -s http://$IP/api/move -H "Content-Type: application/json" -d '{"from":"a1","to":"a8"}' | jq

{
  "ok": true,
  "move": "a1a8",
  "fen": "R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1",
  "status": "checkmate",
  "turn": "b",
  "winner": "white",
  "flag": "THM{[hidden]}"
}
```
