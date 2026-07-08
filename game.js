/* ============================================================
   SIGNAL CORE — a Galaga-style minimalist arcade shooter.
   Klein blue + white only. Monospace. Brutal minimalist.

   Galaga fidelity: fly-in entrances along curved paths, a
   breathing/swaying top formation, enemies that peel off in
   banking dives and loop back to their slot, tractor-beam
   capture + dual-fighter rescue, and challenging bonus stages.
   Lives only (no base to defend); endless, escalating stages.
   ============================================================ */

/* ---------- 1. CANVAS SETUP ---------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;   // 480
const H = canvas.height;  // 640

/* ---------- 2. CONSTANTS ---------- */
const COLOR = {
  klein: "#002FA7",
  white: "#FFFFFF",
  dim: "rgba(255,255,255,0.65)",
  faint: "rgba(255,255,255,0.2)",
};
const FONT = '"Courier New", monospace';

const MARGIN = 14;
const PLAY_LEFT = MARGIN;
const PLAY_RIGHT = W - MARGIN;

// Player
const PLAYER_W = 16;
const PLAYER_H = 14;
const PLAYER_SPEED = 250;
const PLAYER_Y = H - 92;
const DUAL_GAP = 9;            // half-distance between the two dual ships
const FIRE_COOLDOWN = 0.13;    // s between held-autofire shots (tapping bypasses this)
const RESPAWN_INVULN = 1.6;    // s of blink invulnerability after a death
const PLAYER_DEATH_TIME = 0.95;// s the death explosion plays before respawn

// Player bullets
const BULLET_SPEED = 500;      // base speed
const BULLET_W = 2;
const BULLET_H = 10;

// Rapid-fire meter (0..1): raises bullet speed AND the on-screen bullet cap.
// It spools UP while firing so both inputs feel great:
//   - Touch / held fire (the natural mobile interaction) ramps to HOLD_CEILING.
//   - Rapid tapping on desktop pushes past it toward full for a skill edge.
const BULLET_SPEED_BOOST = 0.9;  // up to +90% bullet speed at full meter
const MAX_BULLET_BONUS = 2;      // up to +2 on-screen bullets at full meter
const HOLD_CEILING = 0.6;        // meter cap reachable by simply holding/auto-firing
const HOLD_CHARGE = 1.1;         // spool-up rate/s while holding or touch-firing
const TAP_CHARGE = 1.5;          // faster spool-up/s while rapidly tapping
const RAPID_DECAY = 1.6;         // meter falloff/s when not firing
const RAPID_WINDOW = 0.25;       // a press within this (s) counts as "still tapping"

// Enemy bullets
const EBULLET_SPEED = 235;
const EBULLET_SIZE = 3;
const MAX_EBULLETS = 8;

// Formation layout
const COLS = 8;
const COL_SPACING = 40;
const ROW_SPACING = 34;
const FORM_TOP = 96;
const SWAY_AMP = 22;           // formation side-to-side amplitude
const BASE_SWAY_FREQ = 0.7;    // rad/s, grows slightly per stage
const BREATH_FREQ = 1.1;
const BREATH_AMT = 0.06;       // formation expand/contract

// Enemy tiers (all white; distinguished by shape + a boss box)
const TIER = {
  boss: { glyph: "◈", hp: 2, form: 150, dive: 400, size: 20 },
  goei: { glyph: "✦", hp: 1, form: 80,  dive: 160, size: 18 },
  zako: { glyph: "✧", hp: 1, form: 50,  dive: 100, size: 17 },
};
const HIT_R = 11;              // enemy hit radius (roughly ENEMY_SIZE/2 + slack)

// Attacks
const DIVE_TELEGRAPH = 0.4;    // s pulse before peeling off
const BASE_DIVE_INTERVAL = 2.6;// s between dive sorties (shrinks per stage)
const MIN_DIVE_INTERVAL = 0.8;
const BASE_DIVE_SPEED = 165;
const DIVE_SPEED_INC = 8;
const MAX_DIVE_SPEED = 300;
const SWOOP_AMP = 60;
const SWOOP_FREQ = 3.6;
const RETURN_SPEED = 230;      // rejoining the formation
const BASE_FIRE = 0.9;         // diver shots/sec-ish factor
const MAX_ACTIVE_ATTACKERS = 6;

// Capture / tractor beam
const BEAM_HOVER_Y = H * 0.42;
const BEAM_TIME = 2.1;         // s the beam stays open
const BEAM_MAX_W = 46;         // half-width of the beam mouth

// Entrances
const ENTER_DUR = 1.7;         // s to fly from off-screen to slot
const ENTER_STAGGER = 0.11;    // s between successive enemies launching

// Challenging stage
const CHALLENGE_EVERY = 4;     // stages 3, 7, 11, ...
const CHALLENGE_FIRST = 3;
const CHALLENGE_FLIGHTS = 8;
const CHALLENGE_PER_FLIGHT = 5;
const CHALLENGE_BONUS_PER_HIT = 100;
const CHALLENGE_PERFECT = 10000;

// Game states
const S = {
  START: "START",
  PLAYING: "PLAYING",
  CHALLENGE: "CHALLENGE",
  GAME_OVER: "GAME_OVER",
};

/* ---------- 3. UTILITIES ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pad = (n, len) => String(n).padStart(len, "0");

// Cubic bezier point
function cbez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/* ---------- 4. STARFIELD ---------- */
let stars = [];
function initStars() {
  stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 1 + (Math.random() * 3 | 0),      // depth layer 1..3
      tw: Math.random() * Math.PI * 2,     // twinkle phase
    });
  }
}
function updateStars(dt) {
  for (const s of stars) {
    s.y += (18 + s.z * 22) * dt;
    s.tw += dt * (2 + s.z);
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
  }
}

/* ---------- 5. GAME STATE ---------- */
let game;
let highScore = loadHigh();

function loadHigh() {
  try { return parseInt(localStorage.getItem("signalcore_high") || "0", 10) || 0; }
  catch (e) { return 0; }
}
function saveHigh() {
  try { localStorage.setItem("signalcore_high", String(highScore)); } catch (e) {}
}

function newGame() {
  return {
    state: S.START,
    score: 0,
    stage: 0,               // becomes 1 on first startStage()
    lives: 3,               // total ships incl. the one in play
    t: 0,                   // accumulated game time (s)

    player: {
      x: W / 2,
      dual: false,
      invuln: 0,
      fireTimer: 0,
      dying: 0,             // >0 while the death explosion plays
      lastPressAt: -1,      // game time of the previous fire press (for rapid meter)
      rapid: 0,             // 0..1 rapid-fire meter
      captured: false,      // this ship is currently held by a boss
    },

    bullets: [],
    ebullets: [],
    enemies: [],
    particles: [],

    swayFreq: BASE_SWAY_FREQ,
    diveSpeed: BASE_DIVE_SPEED,
    diveInterval: BASE_DIVE_INTERVAL,
    fireRate: BASE_FIRE,
    diveTimer: BASE_DIVE_INTERVAL,

    captureActive: false,   // a capture sortie is in progress
    freedShip: null,        // {x,y} rescued ship gliding down to dock

    banner: null,           // { text, sub, timer }
    shake: 0,

    // challenge bookkeeping
    ch: null,
  };
}

/* ---------- 6. INPUT ---------- */
const keys = {};
let spaceHeld = false; // tracks a single physical press (ignores OS key-repeat)
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
  keys[k] = true;
  if (k === " ") {
    if (game.state === S.START) startGame();
    else if (!spaceHeld) { spaceHeld = true; firePress(); } // each tap = an instant shot
  }
  if (k === "enter" && game.state === S.START) startGame();
  if (k === "r" && game.state === S.GAME_OVER) restartGame();
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  if (k === " ") spaceHeld = false;
});

canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (W / r.width);
  const my = (e.clientY - r.top) * (H / r.height);
  if ((game.state === S.START || game.state === S.GAME_OVER) && pointInButton(mx, my)) {
    game.state === S.START ? startGame() : restartGame();
  }
});

/* ----- Touch controls (mobile): drag anywhere to move, finger down = fire ----- */
const IS_TOUCH = ("ontouchstart" in window) ||
  (navigator.maxTouchPoints > 0) ||
  (window.matchMedia && matchMedia("(pointer: coarse)").matches);

let pendingTouchDX = 0;   // canvas-space horizontal drag to apply next frame
let touchFire = false;    // a finger is down → autofire
let activeTouchId = null; // the finger currently steering
let lastTouchX = 0;

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  requestWakeLock();
  const t = e.changedTouches[0];
  if (game.state === S.START) { startGame(); return; }
  if (game.state === S.GAME_OVER) { restartGame(); return; }
  // Begin steering with this finger and fire immediately.
  activeTouchId = t.identifier;
  lastTouchX = t.clientX;
  touchFire = true;
  firePress();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const scale = W / r.width;
  for (const t of e.changedTouches) {
    if (t.identifier !== activeTouchId) continue;
    pendingTouchDX += (t.clientX - lastTouchX) * scale; // relative drag → 1:1 feel
    lastTouchX = t.clientX;
  }
}, { passive: false });

function endTouch(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === activeTouchId) { activeTouchId = null; touchFire = false; }
  }
}
canvas.addEventListener("touchend", endTouch, { passive: false });
canvas.addEventListener("touchcancel", endTouch, { passive: false });

// Block iOS pinch-zoom gestures during play.
document.addEventListener("gesturestart", (e) => e.preventDefault());

/* ----- Wake lock: keep the screen awake while playing (Safari 16.4+) ----- */
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch (e) { /* denied or unsupported — ignore */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && game && game.state !== S.START) requestWakeLock();
});
const BTN = { w: 170, h: 40 };
function buttonRect() { return { x: W / 2 - BTN.w / 2, y: H / 2 + 46, w: BTN.w, h: BTN.h }; }
function pointInButton(mx, my) {
  const b = buttonRect();
  return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
}

/* ---------- 7. STAGE / FORMATION SETUP ---------- */
// Each stage's formation rows, top to bottom (Galaga: bosses on top,
// butterflies in the middle, bees at the bottom).
const ROWS = [
  { tier: "boss", cols: [2, 3, 4, 5] },
  { tier: "goei", cols: [0, 1, 2, 3, 4, 5, 6, 7] },
  { tier: "goei", cols: [0, 1, 2, 3, 4, 5, 6, 7] },
  { tier: "zako", cols: [0, 1, 2, 3, 4, 5, 6, 7] },
  { tier: "zako", cols: [0, 1, 2, 3, 4, 5, 6, 7] },
];

function slotColOffset(col) { return (col - (COLS - 1) / 2) * COL_SPACING; }

// Live formation target for a docked/returning enemy (with sway + breathing).
function slotTarget(e) {
  const breath = 1 + Math.sin(game.t * BREATH_FREQ) * BREATH_AMT;
  const sway = Math.sin(game.t * game.swayFreq) * SWAY_AMP;
  const bob = Math.sin(game.t * 0.8) * 3;
  return {
    x: W / 2 + sway + e.slotOff * breath,
    y: FORM_TOP + e.rowIndex * ROW_SPACING + bob,
  };
}

function makeEnemy(tier, rowIndex, col, idx) {
  const d = TIER[tier];
  return {
    tier, glyph: d.glyph, size: d.size,
    hp: d.hp, maxHp: d.hp,
    pointsForm: d.form, pointsDive: d.dive,
    rowIndex, col, slotOff: slotColOffset(col),
    x: 0, y: 0,
    state: "entering",
    started: false, launchAt: idx * ENTER_STAGGER,
    p0: null, p1: null, p2: null, p3: null, pathT: 0,
    diveT: 0, diveCenterX: 0, swoopDir: 1, fireTimer: 0,
    telegraph: 0,
    hitFlash: 0,
    carrying: false,        // boss holding a captured ship
    // capture sortie fields
    capPhase: null, capT: 0, beamOn: false,
    alive: true,
  };
}

function startStage() {
  game.stage += 1;
  const st = game.stage;

  // Difficulty scaling (all soft-capped so endless play stays fair).
  const k = st - 1;
  game.swayFreq = BASE_SWAY_FREQ + Math.min(k * 0.05, 0.7);
  game.diveSpeed = Math.min(BASE_DIVE_SPEED + k * DIVE_SPEED_INC, MAX_DIVE_SPEED);
  game.diveInterval = Math.max(BASE_DIVE_INTERVAL - k * 0.15, MIN_DIVE_INTERVAL);
  game.fireRate = Math.min(BASE_FIRE + k * 0.12, 2.4);
  game.diveTimer = 1.4;
  game.captureActive = false;
  game.freedShip = null;
  game.enemies = [];
  game.ebullets = [];

  if (isChallengeStage(st)) { startChallenge(); return; }

  game.state = S.PLAYING;
  // Build the formation and give every enemy a fly-in path to its slot.
  let idx = 0;
  ROWS.forEach((row, rowIndex) => {
    row.cols.forEach((col) => {
      const e = makeEnemy(row.tier, rowIndex, col, idx++);
      assignEntrancePath(e);
      e._launchBase = game.t; // entrances stagger from now
      game.enemies.push(e);
    });
  });
  game.banner = { text: "STAGE " + pad(st, 2), sub: null, timer: 1.6 };
}

// A swooping side entrance that arcs up and over before settling — the
// signature Galaga fly-in.
function assignEntrancePath(e) {
  const tgt = { x: W / 2 + e.slotOff, y: FORM_TOP + e.rowIndex * ROW_SPACING };
  const fromLeft = e.col < COLS / 2;
  e.p0 = { x: fromLeft ? -40 : W + 40, y: 120 + e.rowIndex * 8 };
  e.p1 = { x: W / 2, y: -70 };
  e.p2 = { x: tgt.x + (fromLeft ? -90 : 90), y: tgt.y - 110 };
  e.p3 = tgt;
  e.pathT = 0;
}

function isChallengeStage(st) {
  return st >= CHALLENGE_FIRST && (st - CHALLENGE_FIRST) % CHALLENGE_EVERY === 0;
}

/* ---------- 8. PLAYER ---------- */
// Center x of each active fighter (one, or two when dual).
function shipXs() {
  const p = game.player;
  return p.dual ? [p.x - DUAL_GAP, p.x + DUAL_GAP] : [p.x];
}
function playerHalfSpan() { return game.player.dual ? DUAL_GAP + PLAYER_W / 2 : PLAYER_W / 2; }

function updatePlayer(dt) {
  const p = game.player;

  // Death explosion: play it out, then respawn (or end the game).
  if (p.dying > 0) {
    pendingTouchDX = 0;
    updateRapid(dt, false); // cools down
    p.dying -= dt;
    if (p.dying <= 0) {
      p.dying = 0;
      if (game.lives <= 0) { gameOver(); return; }
      p.x = W / 2;
      p.invuln = RESPAWN_INVULN;
    }
    return; // no control while exploding
  }

  if (p.captured) { pendingTouchDX = 0; updateRapid(dt, false); return; } // no control
  if (p.invuln > 0) p.invuln -= dt;

  let dir = 0;
  if (keys["arrowleft"] || keys["a"]) dir -= 1;
  if (keys["arrowright"] || keys["d"]) dir += 1;
  p.x += dir * PLAYER_SPEED * dt;
  p.x += pendingTouchDX;      // touch drag (relative)
  pendingTouchDX = 0;
  const span = playerHalfSpan();
  p.x = clamp(p.x, PLAY_LEFT + span, PLAY_RIGHT - span);

  updateRapid(dt, true);
  p.fireTimer -= dt;
  if (keys[" "] || touchFire) tryFire(); // holding / finger-down = steady autofire
}

// Spool the rapid meter up while firing, down while idle. Holding (or touch
// auto-fire) ramps to HOLD_CEILING; rapid tapping pushes past it toward full.
function updateRapid(dt, controllable) {
  const p = game.player;
  const holding = controllable && (keys[" "] || touchFire);
  const tapping = controllable && p.lastPressAt >= 0 && (game.t - p.lastPressAt) < RAPID_WINDOW;
  if (tapping) {
    p.rapid = Math.min(1, p.rapid + TAP_CHARGE * dt);
  } else if (holding) {
    p.rapid = p.rapid < HOLD_CEILING
      ? Math.min(HOLD_CEILING, p.rapid + HOLD_CHARGE * dt)
      : Math.max(HOLD_CEILING, p.rapid - RAPID_DECAY * dt); // ease extra tap-heat back down
  } else {
    p.rapid = Math.max(0, p.rapid - RAPID_DECAY * dt);
  }
}

function spawnPlayerShots() {
  const p = game.player;
  const speed = BULLET_SPEED * (1 + p.rapid * BULLET_SPEED_BOOST);
  for (const cx of shipXs()) {
    game.bullets.push({ x: cx - BULLET_W / 2, y: PLAYER_Y - PLAYER_H, speed });
  }
}
function canFire() {
  const p = game.player;
  if (p.dying > 0 || p.captured) return false;
  // Base cap (2 single / 4 dual) grows by up to MAX_BULLET_BONUS while hot.
  const cap = (p.dual ? 4 : 2) + Math.round(p.rapid * MAX_BULLET_BONUS);
  return game.bullets.length < cap;
}
// Discrete tap: fire instantly if a slot is free. Recording the press time lets
// updateRapid recognise sustained fast tapping and spool the meter to full.
function firePress() {
  if (game.state !== S.PLAYING && game.state !== S.CHALLENGE) return;
  const p = game.player;
  if (p.dying > 0 || p.captured) return;
  p.lastPressAt = game.t;
  if (canFire()) { spawnPlayerShots(); p.fireTimer = FIRE_COOLDOWN; }
}
// Held: steady autofire at the cooldown cadence (never faster than tapping).
function tryFire() {
  const p = game.player;
  if (p.fireTimer > 0 || !canFire()) return;
  p.fireTimer = FIRE_COOLDOWN;
  spawnPlayerShots();
}

// Player takes a hit: dual downgrades to single (no life lost); a single
// ship explodes, costs a life, then respawns with brief invulnerability.
function playerHit() {
  const p = game.player;
  if (p.invuln > 0 || p.captured || p.dying > 0) return;
  if (p.dual) {
    p.dual = false;
    p.invuln = RESPAWN_INVULN;
    game.shake = 8;
    spawnBurst(p.x, PLAYER_Y, 10);
    return;
  }
  killPlayerShip();
}

function killPlayerShip() {
  const p = game.player;
  if (p.dying > 0) return;
  game.lives -= 1;
  game.shake = 14;
  spawnExplosion(p.x, PLAYER_Y);   // Galaga-style burst
  p.dying = PLAYER_DEATH_TIME;     // respawn / game-over handled in updatePlayer
  game.ebullets = [];
}

/* ---------- 9. BULLETS ---------- */
function updateBullets(dt) {
  for (const b of game.bullets) b.y -= (b.speed || BULLET_SPEED) * dt;
  game.bullets = game.bullets.filter((b) => b.y + BULLET_H > 0);

  for (const b of game.ebullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  game.ebullets = game.ebullets.filter((b) => b.y < H + 10 && b.x > -10 && b.x < W + 10);
}

// A diver fires a shot roughly toward the player.
function enemyFire(e) {
  if (game.ebullets.length >= MAX_EBULLETS) return;
  const p = game.player;
  const tx = p.x, ty = PLAYER_Y;
  const ang = Math.atan2(ty - e.y, tx - e.x);
  game.ebullets.push({
    x: e.x, y: e.y,
    vx: Math.cos(ang) * EBULLET_SPEED,
    vy: Math.max(60, Math.sin(ang) * EBULLET_SPEED),
  });
}

/* ---------- 10. ENEMIES ---------- */
function updateEnemies(dt) {
  const px = game.player.x;

  for (const e of game.enemies) {
    if (!e.alive) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    switch (e.state) {
      case "entering": updateEntering(e, dt); break;
      case "formation": break; // positioned below, after telegraph handling
      case "diving": updateDiving(e, dt, px); break;
      case "returning": updateReturning(e, dt); break;
      case "capture": updateCapture(e, dt, px); break;
    }
  }

  // Position docked (and winding-up) enemies on the live formation grid.
  for (const e of game.enemies) {
    if (e.alive && (e.state === "formation")) {
      const tgt = slotTarget(e);
      e.x = tgt.x; e.y = tgt.y;
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) beginDive(e, px);
      }
    }
  }

  // Sortie scheduler.
  game.diveTimer -= dt;
  if (game.diveTimer <= 0) {
    game.diveTimer = game.diveInterval;
    scheduleSortie(px);
  }

  // Advance a freed (rescued) ship gliding down to dock into a dual fighter.
  updateFreedShip(dt);

  // Stage clear → next stage.
  if (game.state === S.PLAYING && countLiveEnemies() === 0 && !game.freedShip) {
    startStage();
  }
}

function countLiveEnemies() { return game.enemies.filter((e) => e.alive).length; }

function updateEntering(e, dt) {
  if (!e.started) {
    if (game.t >= e._launchBase + e.launchAt) e.started = true;
    else { e.x = e.p0.x; e.y = e.p0.y; return; }
  }
  e.pathT += dt / ENTER_DUR;
  if (e.pathT >= 1) {
    e.pathT = 1; e.state = "formation"; e.telegraph = 0;
    const tgt = slotTarget(e); e.x = tgt.x; e.y = tgt.y;
    return;
  }
  const pt = cbez(e.p0, e.p1, e.p2, e.p3, e.pathT);
  e.x = pt.x; e.y = pt.y;
}

function beginDive(e, px) {
  e.state = "diving";
  e.diveT = 0;
  e.diveCenterX = e.x;
  e.swoopDir = e.x < px ? 1 : -1;
  e.fireTimer = rand(0.2, 0.6);
}

function updateDiving(e, dt, px) {
  e.diveT += dt;
  e.y += game.diveSpeed * dt;
  e.diveCenterX += (px - e.diveCenterX) * Math.min(1, dt * 0.8);
  e.x = e.diveCenterX + Math.sin(e.diveT * SWOOP_FREQ) * SWOOP_AMP * e.swoopDir;
  e.x = clamp(e.x, PLAY_LEFT + e.size / 2, PLAY_RIGHT - e.size / 2);

  e.fireTimer -= dt;
  if (e.fireTimer <= 0 && e.y < H * 0.8) {
    e.fireTimer = rand(0.5, 1.2) / game.fireRate;
    enemyFire(e);
  }

  if (e.y > H + 24) {
    // Fly off the bottom and loop back to the top to rejoin formation.
    e.state = "returning";
    e.y = -24;
    e.x = clamp(W / 2 + e.slotOff, PLAY_LEFT + 20, PLAY_RIGHT - 20);
  }
}

function updateReturning(e, dt) {
  const tgt = slotTarget(e);
  const dx = tgt.x - e.x, dy = tgt.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const step = RETURN_SPEED * dt;
  if (d <= step) { e.x = tgt.x; e.y = tgt.y; e.state = "formation"; e.telegraph = 0; }
  else { e.x += (dx / d) * step; e.y += (dy / d) * step; }
}

// --- Sortie scheduling: pick divers; bosses may bring escorts / capture. ---
function scheduleSortie(px) {
  const docked = game.enemies.filter((e) => e.alive && e.state === "formation" && e.telegraph <= 0);
  if (docked.length === 0) return;
  const active = game.enemies.filter(
    (e) => e.alive && (e.state === "diving" || e.state === "returning" || e.state === "capture" || e.telegraph > 0)
  ).length;
  if (active >= MAX_ACTIVE_ATTACKERS) return;

  // Capture sortie: a boss occasionally tries to grab your ship.
  const bosses = docked.filter((e) => e.tier === "boss" && !e.carrying);
  if (!game.captureActive && !game.player.dual && game.lives >= 2 &&
      game.stage >= 2 && bosses.length && chance(0.28)) {
    beginCapture(pick(bosses), px);
    return;
  }

  // Normal dive, sometimes with two escorts if a boss leads.
  const leader = pick(docked);
  leader.telegraph = DIVE_TELEGRAPH;
  if (leader.tier === "boss") {
    const escorts = docked
      .filter((e) => e !== leader && e.tier !== "boss")
      .sort((a, b) => Math.abs(a.slotOff - leader.slotOff) - Math.abs(b.slotOff - leader.slotOff))
      .slice(0, 2);
    escorts.forEach((es, i) => { es.telegraph = DIVE_TELEGRAPH + (i + 1) * 0.18; });
  } else if (game.stage >= 3 && chance(0.4)) {
    const wing = pick(docked.filter((e) => e !== leader));
    if (wing) wing.telegraph = DIVE_TELEGRAPH + 0.18;
  }
}

/* ---------- Capture / tractor beam ---------- */
function beginCapture(boss, px) {
  game.captureActive = true;
  boss.state = "capture";
  boss.capPhase = "diveIn";
  boss.capT = 0;
  boss.beamOn = false;
  boss.diveCenterX = boss.x;
}

function updateCapture(e, dt, px) {
  e.capT += dt;
  if (e.capPhase === "diveIn") {
    // Descend to hover height, drifting over the player.
    e.y += game.diveSpeed * 0.8 * dt;
    e.diveCenterX += (px - e.diveCenterX) * Math.min(1, dt * 1.4);
    e.x = clamp(e.diveCenterX, PLAY_LEFT + 30, PLAY_RIGHT - 30);
    if (e.y >= BEAM_HOVER_Y) {
      e.y = BEAM_HOVER_Y; e.capPhase = "beam"; e.capT = 0; e.beamOn = true;
    }
  } else if (e.capPhase === "beam") {
    e.beamOn = true;
    if (e.capT >= BEAM_TIME) {
      e.beamOn = false;
      // Capture if the player is under the beam mouth and vulnerable.
      const p = game.player;
      const beamHalf = BEAM_MAX_W;
      if (!p.dual && !p.captured && p.invuln <= 0 && p.dying <= 0 &&
          Math.abs(p.x - e.x) < beamHalf && game.lives >= 2) {
        captureShip(e);
      }
      e.capPhase = "retreat";
    }
  } else if (e.capPhase === "retreat") {
    // Return to formation (carrying the ship if one was grabbed).
    const tgt = slotTarget(e);
    const dx = tgt.x - e.x, dy = tgt.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = RETURN_SPEED * dt;
    if (d <= step) {
      e.x = tgt.x; e.y = tgt.y; e.state = "formation"; e.capPhase = null;
      if (!e.carrying) game.captureActive = false; // failed grab → free the slot
    } else { e.x += (dx / d) * step; e.y += (dy / d) * step; }
  }
}

function captureShip(boss) {
  boss.carrying = true;
  const p = game.player;
  // Costs a life like a death, but leaves a ship to be rescued.
  game.lives -= 1;
  game.shake = 10;
  spawnBurst(p.x, PLAYER_Y, 14);
  p.x = W / 2;
  p.invuln = RESPAWN_INVULN;
  game.banner = { text: "SHIP CAPTURED", sub: "SHOOT THE CAPTOR TO RESCUE", timer: 2.0 };
}

// When the carrying boss dies, the held ship glides down and docks → dual.
function freeCapturedShip(boss) {
  game.freedShip = { x: boss.x, y: boss.y };
  game.captureActive = false;
  game.banner = { text: "FIGHTER RESCUED", sub: "DUAL FIGHTER", timer: 1.6 };
}

function updateFreedShip(dt) {
  const f = game.freedShip;
  if (!f) return;
  const p = game.player;
  const tx = p.x + DUAL_GAP, ty = PLAYER_Y;
  const dx = tx - f.x, dy = ty - f.y;
  const d = Math.hypot(dx, dy) || 1;
  const step = 220 * dt;
  if (d <= step) {
    game.freedShip = null;
    if (game.lives > 0) { p.dual = true; p.invuln = Math.max(p.invuln, 0.6); }
  } else { f.x += (dx / d) * step; f.y += (dy / d) * step; }
}

/* ---------- 11. CHALLENGING STAGE ---------- */
// Cubic paths that sweep enemies across the screen and off the far edge.
const CH_PATHS = [
  [{ x: -40, y: 90 }, { x: W * 0.3, y: -40 }, { x: W * 0.7, y: H * 0.7 }, { x: W + 40, y: H * 0.4 }],
  [{ x: W + 40, y: 90 }, { x: W * 0.7, y: -40 }, { x: W * 0.3, y: H * 0.7 }, { x: -40, y: H * 0.4 }],
  [{ x: W / 2, y: -40 }, { x: -60, y: H * 0.4 }, { x: W + 60, y: H * 0.5 }, { x: W / 2, y: H + 40 }],
  [{ x: -40, y: H * 0.55 }, { x: W * 0.4, y: -30 }, { x: W * 0.6, y: -30 }, { x: W + 40, y: H * 0.55 }],
];

function startChallenge() {
  game.state = S.CHALLENGE;
  game.ch = {
    flightTimer: 0.8,
    flightsLeft: CHALLENGE_FLIGHTS,
    spawned: 0,
    total: CHALLENGE_FLIGHTS * CHALLENGE_PER_FLIGHT,
    hits: 0,
    done: false,
    resultTimer: 0,
  };
  game.banner = { text: "CHALLENGING STAGE", sub: "STAGE " + pad(game.stage, 2), timer: 2.0 };
}

function updateChallenge(dt) {
  const c = game.ch;
  const px = game.player.x;

  updatePlayer(dt);
  updateBullets(dt);

  // Launch flights on a timer.
  if (c.flightsLeft > 0) {
    c.flightTimer -= dt;
    if (c.flightTimer <= 0) {
      c.flightTimer = 1.6;
      launchChallengeFlight();
      c.flightsLeft -= 1;
    }
  }

  // Move flight enemies along their shared path.
  for (const e of game.enemies) {
    if (!e.alive) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (!e.started) {
      if (game.t >= e._launchBase + e.launchAt) e.started = true;
      else { e.x = e.path[0].x; e.y = e.path[0].y; continue; }
    }
    e.pathT += dt / e.pathDur;
    if (e.pathT >= 1) { e.alive = false; continue; } // exited (missed)
    const pt = cbez(e.path[0], e.path[1], e.path[2], e.path[3], e.pathT);
    e.x = pt.x; e.y = pt.y;
  }
  game.enemies = game.enemies.filter((e) => e.alive);

  // Bullets vs challenge enemies (enemies are non-lethal here).
  for (const b of game.bullets) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < HIT_R) {
        e.alive = false; b.dead = true; c.hits += 1;
        game.score += e.pointsDive;
        spawnBurst(e.x, e.y, 8);
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
  game.enemies = game.enemies.filter((e) => e.alive);

  updateParticles(dt);

  // Finished when all flights spawned and cleared.
  if (!c.done && c.flightsLeft === 0 && game.enemies.length === 0) {
    c.done = true; c.resultTimer = 2.6;
    const perfect = c.hits >= c.total;
    const bonus = perfect ? CHALLENGE_PERFECT : c.hits * CHALLENGE_BONUS_PER_HIT;
    game.score += bonus;
    game.banner = {
      text: perfect ? "PERFECT!" : "HITS: " + c.hits + "/" + c.total,
      sub: "BONUS " + bonus,
      timer: 2.6,
    };
  }
  if (c.done) {
    c.resultTimer -= dt;
    if (c.resultTimer <= 0) startStage();
  }
}

function launchChallengeFlight() {
  const path = pick(CH_PATHS);
  const base = game.t + 0.0;
  for (let i = 0; i < CHALLENGE_PER_FLIGHT; i++) {
    const tier = pick(["goei", "zako", "zako"]);
    const d = TIER[tier];
    game.enemies.push({
      tier, glyph: d.glyph, size: d.size, hp: 1, maxHp: 1,
      pointsForm: d.form, pointsDive: d.dive,
      x: path[0].x, y: path[0].y,
      state: "challenge", started: false,
      _launchBase: base, launchAt: i * 0.18,
      path, pathT: 0, pathDur: rand(3.0, 3.8),
      hitFlash: 0, alive: true,
    });
  }
  game.ch.spawned += CHALLENGE_PER_FLIGHT;
}

/* ---------- 12. COLLISIONS (normal stages) ---------- */
function handleCollisions() {
  const p = game.player;

  // Player bullets vs enemies.
  for (const b of game.bullets) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (!e.started && e.state === "entering") continue;
      if (Math.hypot(b.x + BULLET_W / 2 - e.x, b.y - e.y) < HIT_R + e.size * 0.15) {
        b.dead = true;
        e.hp -= 1;
        if (e.hp > 0) { e.hitFlash = 0.12; spawnBurst(e.x, e.y, 4); }
        else killEnemy(e);
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);

  // Enemy bullets vs player.
  if (p.invuln <= 0 && !p.captured && p.dying <= 0) {
    for (const b of game.ebullets) {
      for (const cx of shipXs()) {
        if (Math.abs(b.x - cx) < PLAYER_W / 2 && Math.abs(b.y - (PLAYER_Y - PLAYER_H / 2)) < PLAYER_H) {
          b.dead = true; playerHit(); break;
        }
      }
      if (p.invuln > 0 || p.dying > 0) break;
    }
    game.ebullets = game.ebullets.filter((b) => !b.dead);
  }

  // Attacking enemy bodies vs player.
  if (p.invuln <= 0 && !p.captured && p.dying <= 0) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (e.state !== "diving" && e.state !== "capture" && e.state !== "returning") continue;
      for (const cx of shipXs()) {
        if (Math.hypot(e.x - cx, e.y - PLAYER_Y) < HIT_R + PLAYER_W / 2) {
          killEnemy(e); playerHit(); break;
        }
      }
      if (p.invuln > 0 || p.dying > 0) break;
    }
  }

  game.enemies = game.enemies.filter((e) => e.alive);
}

function killEnemy(e) {
  e.alive = false;
  const attacking = e.state === "diving" || e.state === "returning" || e.state === "capture";
  game.score += attacking ? e.pointsDive : e.pointsForm;
  spawnBurst(e.x, e.y, e.tier === "boss" ? 14 : 8);
  if (e.carrying) freeCapturedShip(e);
  else if (e.state === "capture") game.captureActive = false;
}

/* ---------- 13. PARTICLES / EFFECTS ---------- */
function spawnBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rand(0, 0.6);
    const s = rand(45, 130);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, size: 2, decay: 2.3 });
  }
}

// Galaga-style player explosion: a shock ring plus a big spray of white
// fragments that fling out and linger before fading.
function spawnExplosion(x, y) {
  game.particles.push({ x, y, vx: 0, vy: 0, life: 1, ring: true, r: 3, decay: 1.5 });
  const outer = 20;
  for (let i = 0; i < outer; i++) {
    const a = (Math.PI * 2 * i) / outer + rand(-0.22, 0.22);
    const s = rand(80, 200);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, size: Math.random() < 0.45 ? 3 : 2, decay: rand(0.9, 1.5),
    });
  }
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), s = rand(10, 70);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, size: 2, decay: rand(1.3, 2.0) });
  }
}

function updateParticles(dt) {
  for (const p of game.particles) {
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.ring) p.r += 130 * dt;
    p.life -= dt * (p.decay || 2.3);
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 34);
  if (game.banner) { game.banner.timer -= dt; if (game.banner.timer <= 0) game.banner = null; }
}

/* ---------- 14. RENDERING ---------- */
function draw() {
  ctx.fillStyle = COLOR.klein;
  ctx.fillRect(0, 0, W, H);
  drawStars();

  let ox = 0, oy = 0;
  if (game.shake > 0) { ox = rand(-1, 1) * game.shake; oy = rand(-1, 1) * game.shake; }
  ctx.save();
  ctx.translate(ox, oy);

  if (game.state === S.PLAYING || game.state === S.CHALLENGE) {
    drawEnemies();
    drawBeams();
    drawBullets();
    drawEbullets();
    drawParticles();
    drawFreedShip();
    drawPlayer();
  }
  ctx.restore();

  drawHUD();

  if (game.state === S.START) drawStart();
  else if (game.state === S.GAME_OVER) drawGameOver();
  else if (game.banner) drawBanner();
}

function drawStars() {
  for (const s of stars) {
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.tw));
    ctx.fillStyle = `rgba(255,255,255,${(0.15 + s.z * 0.12) * tw})`;
    const sz = s.z >= 3 ? 2 : 1;
    ctx.fillRect(s.x, s.y, sz, sz);
  }
}

function drawEnemies() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const e of game.enemies) {
    if (!e.alive) continue;
    if (!e.started && (e.state === "entering" || e.state === "challenge")) continue;
    const attacking = e.state === "diving" || e.state === "returning" || e.state === "capture";
    let color = attacking ? COLOR.white : COLOR.dim;
    if (e.telegraph > 0) color = Math.floor(e.telegraph * 20) % 2 === 0 ? COLOR.white : COLOR.dim;
    if (e.hitFlash > 0) color = COLOR.white;

    ctx.font = `${e.size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(e.glyph, e.x, e.y);

    // Boss keeps a faint box while it still has its extra HP.
    if (e.maxHp > 1 && e.hp > 1) {
      const sq = e.size + 6;
      ctx.strokeStyle = COLOR.faint; ctx.lineWidth = 1;
      ctx.strokeRect(e.x - sq / 2, e.y - sq / 2, sq, sq);
    }
    // A boss carrying your captured ship shows it docked above.
    if (e.carrying) drawShipGlyph(e.x, e.y - e.size, COLOR.dim);
  }
}

function drawBeams() {
  for (const e of game.enemies) {
    if (!e.alive || e.state !== "capture" || !e.beamOn) continue;
    const prog = clamp(e.capT / 0.4, 0, 1); // open quickly
    const half = BEAM_MAX_W * prog;
    const top = e.y + e.size / 2;
    const bottom = H - 60;
    ctx.strokeStyle = COLOR.faint; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x - 4, top); ctx.lineTo(e.x - half, bottom);
    ctx.moveTo(e.x + 4, top); ctx.lineTo(e.x + half, bottom);
    ctx.stroke();
    // Animated horizontal bands inside the cone.
    for (let i = 0; i < 6; i++) {
      const f = ((game.t * 0.9 + i / 6) % 1);
      const yy = top + (bottom - top) * f;
      const hw = 4 + (half - 4) * f;
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - f)})`;
      ctx.beginPath(); ctx.moveTo(e.x - hw, yy); ctx.lineTo(e.x + hw, yy); ctx.stroke();
    }
  }
}

function drawBullets() {
  ctx.fillStyle = COLOR.white;
  for (const b of game.bullets) ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
}
function drawEbullets() {
  ctx.fillStyle = COLOR.dim;
  for (const b of game.ebullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, EBULLET_SIZE / 2 + 0.5, 0, Math.PI * 2); ctx.fill();
  }
}
function drawParticles() {
  for (const p of game.particles) {
    const al = Math.max(0, p.life);
    if (p.ring) {
      ctx.strokeStyle = `rgba(255,255,255,${al * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    } else {
      const s = p.size || 2;
      ctx.fillStyle = `rgba(255,255,255,${al})`;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
}

function drawShipGlyph(cx, baseY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, baseY - PLAYER_H);
  ctx.lineTo(cx - PLAYER_W / 2, baseY);
  ctx.lineTo(cx + PLAYER_W / 2, baseY);
  ctx.closePath();
  ctx.fill();
}
function drawPlayer() {
  const p = game.player;
  if (p.captured || p.dying > 0) return; // hidden while exploding
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return; // blink
  for (const cx of shipXs()) drawShipGlyph(cx, PLAYER_Y, COLOR.white);
}
function drawFreedShip() {
  if (game.freedShip) drawShipGlyph(game.freedShip.x, game.freedShip.y, COLOR.white);
}

function drawHUD() {
  ctx.textBaseline = "top";
  ctx.font = `12px ${FONT}`;

  // 1UP + score (left), HIGH SCORE (right) — Galaga style.
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.white;
  ctx.fillText("1UP", MARGIN, 8);
  ctx.fillStyle = COLOR.dim;
  ctx.fillText(pad(game.score, 6), MARGIN, 22);

  ctx.textAlign = "right";
  ctx.fillStyle = COLOR.white;
  ctx.fillText("HIGH SCORE", W - MARGIN, 8);
  ctx.fillStyle = COLOR.dim;
  ctx.fillText(pad(Math.max(highScore, game.score), 6), W - MARGIN, 22);

  if (game.state === S.START || game.state === S.GAME_OVER) return;

  // Reserve ships (bottom-left).
  const reserve = Math.max(0, game.lives - 1);
  for (let i = 0; i < reserve; i++) {
    drawShipGlyph(MARGIN + 8 + i * 20, H - 8, COLOR.white);
  }

  // Stage flags (bottom-right): stack of small markers = current stage.
  drawStageFlags();
}

// Galaga-ish stage badges: greedily decompose the stage number into
// 50/30/20/10/5/1 flags (bigger denominations shown brighter). Capped so
// the bar never floods at very high stages.
function drawStageFlags() {
  const denoms = [50, 30, 20, 10, 5, 1];
  let n = game.stage;
  let x = W - MARGIN;
  const y = H - 14;
  let drawn = 0;
  for (const d of denoms) {
    while (n >= d && drawn < 12) {
      n -= d; drawn++; x -= 11;
      ctx.fillStyle = d >= 10 ? COLOR.white : COLOR.dim;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 3);
      ctx.lineTo(x, y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.fillStyle = COLOR.dim; ctx.font = `11px ${FONT}`;
  ctx.fillText("STAGE " + pad(game.stage, 2), W - MARGIN, y - 3);
}

/* ----- Overlays ----- */
function drawBanner() {
  const b = game.banner;
  const fade = clamp(b.timer, 0, 1);
  ctx.globalAlpha = fade < 1 ? fade : 1;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR.white; ctx.font = `26px ${FONT}`;
  ctx.fillText(b.text, W / 2, H / 2 - 10);
  if (b.sub) {
    ctx.fillStyle = COLOR.dim; ctx.font = `13px ${FONT}`;
    ctx.fillText(b.sub, W / 2, H / 2 + 20);
  }
  ctx.globalAlpha = 1;
}

function drawButton(label) {
  const b = buttonRect();
  ctx.strokeStyle = COLOR.white; ctx.lineWidth = 1;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = COLOR.white; ctx.font = `16px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, b.y + b.h / 2);
}

function drawStart() {
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR.white; ctx.font = `36px ${FONT}`;
  ctx.fillText("SIGNAL CORE", W / 2, H / 2 - 110);
  ctx.fillStyle = COLOR.dim; ctx.font = `13px ${FONT}`;
  ctx.fillText("A MINIMAL GALAGA-STYLE SHOOTER", W / 2, H / 2 - 76);

  // tiny legend of the enemy tiers
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = COLOR.dim;
  ctx.fillText("◈  ✦  ✧", W / 2, H / 2 - 40);

  drawButton(IS_TOUCH ? "[ TAP TO START ]" : "[ START ]");

  ctx.fillStyle = COLOR.dim; ctx.font = `12px ${FONT}`;
  if (IS_TOUCH) {
    ctx.fillText("DRAG TO MOVE", W / 2, H / 2 + 122);
    ctx.fillText("HOLD TO FIRE", W / 2, H / 2 + 142);
  } else {
    ctx.fillText("MOVE: A / D  OR  ARROWS", W / 2, H / 2 + 122);
    ctx.fillText("FIRE: SPACE", W / 2, H / 2 + 142);
  }
}

function drawGameOver() {
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR.white; ctx.font = `34px ${FONT}`;
  ctx.fillText("GAME OVER", W / 2, H / 2 - 96);
  ctx.fillStyle = COLOR.dim; ctx.font = `14px ${FONT}`;
  ctx.fillText("SCORE: " + pad(game.score, 6), W / 2, H / 2 - 44);
  ctx.fillText("STAGE: " + pad(game.stage, 2), W / 2, H / 2 - 22);
  if (game.score >= highScore) {
    ctx.fillStyle = COLOR.white;
    ctx.fillText("NEW HIGH SCORE", W / 2, H / 2 + 4);
  }
  drawButton(IS_TOUCH ? "[ TAP TO RESTART ]" : "[ RESTART ]");
  ctx.fillStyle = COLOR.dim; ctx.font = `12px ${FONT}`;
  ctx.fillText(IS_TOUCH ? "TAP ANYWHERE TO RESTART" : "PRESS R TO RESTART", W / 2, H / 2 + 122);
}

/* ---------- 15. GAME LOOP ---------- */
let lastTime = 0;
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  game.t += dt;

  updateStars(dt);

  if (game.state === S.PLAYING) {
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    handleCollisions();
    updateParticles(dt);
  } else if (game.state === S.CHALLENGE) {
    updateChallenge(dt);
  } else {
    updateParticles(dt);
  }

  // Keep the persisted high score current.
  if (game.score > highScore) { highScore = game.score; saveHigh(); }

  draw();
  requestAnimationFrame(loop);
}

/* ---------- 16. START / RESTART ---------- */
function startGame() {
  spaceHeld = false; // don't carry a held key into the new game
  touchFire = false; activeTouchId = null; pendingTouchDX = 0;
  requestWakeLock();
  game = newGame();
  startStage(); // stage 1: sets state + fly-in entrances (_launchBase set inside)
}
function restartGame() { startGame(); }
function gameOver() {
  if (game.score >= highScore) { highScore = game.score; saveHigh(); }
  game.state = S.GAME_OVER;
}

/* ---------- BOOT ---------- */
initStars();
game = newGame();
requestAnimationFrame((t) => { lastTime = t; loop(t); });
