// p5.brush (standalone build) — drawing three animals from scratch.
// Deterministic: window.renderFrame(t) redraws the whole scene for time t
// (seconds), so a headless browser can capture any frame on demand.
// Scenes: 0 = fox in a forest clearing, 1 = owl on a branch at night,
// 2 = turtle in a pond. Each scene draws itself stroke by stroke, then holds.

const W = 800, H = 450;
const PAPER = "#f7f2e7";
const SCENE_LEN = 2.6;   // seconds per scene
const DRAW_LEN = 1.9;    // seconds of drawing inside a scene
const SCENES = 3;

brush.createCanvas(W, H, { parent: document.body });
brush.scaleBrushes(2.5);
brush.angleMode(brush.DEGREES);

// ── helpers ────────────────────────────────────────────────────────────────
const L = (a, b, f) => a + (b - a) * f;

function clearStroke() {
  brush.noStroke();
  brush.noFill();
  brush.noWash();
  brush.noHatch();
  brush.noField();
}

// A stroke: { s, e, fn } — drawn while scene progress p is in [s, e].
// fn(f) draws fraction f (0..1) of the stroke.
function lineS(x1, y1, x2, y2, bname, color, wgt, s, e) {
  return { s, e, fn: (f) => {
    if (f <= 0) return;
    brush.set(bname, color, wgt);
    brush.line(x1, y1, L(x1, x2, f), L(y1, y2, f));
    clearStroke();
  } };
}

function splineS(points, curv, bname, color, wgt, s, e) {
  return { s, e, fn: (f) => {
    if (f <= 0) return;
    const k = Math.max(2, Math.ceil(f * points.length));
    brush.set(bname, color, wgt);
    brush.spline(points.slice(0, k), curv);
    clearStroke();
  } };
}

// Watercolor shape that grows out from its centroid as it is drawn.
// Pass wash=[color, opacity] for a solid wash instead of watercolor.
function polyS(points, fillCol, fillOp, bname, color, wgt, s, e, hatch, wash) {
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
  const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
  return { s, e, fn: (f) => {
    if (f <= 0) return;
    const pts = points.map((p) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]);
    if (wash) brush.wash(wash[0], wash[1]);
    else if (fillCol) { brush.fill(fillCol, fillOp); brush.fillBleed(0.22); brush.fillTexture(0.35, 0.35); }
    if (bname) brush.set(bname, color, wgt);
    if (hatch) brush.hatch(hatch.dist, hatch.angle, { rand: 0.2 });
    brush.polygon(pts);
    clearStroke();
  } };
}

function circleS(cx, cy, r, irr, fillCol, fillOp, bname, color, wgt, s, e) {
  return { s, e, fn: (f) => {
    if (f <= 0) return;
    if (fillCol) { brush.fill(fillCol, fillOp); brush.fillBleed(0.25); brush.fillTexture(0.3, 0.3); }
    if (bname) brush.set(bname, color, wgt);
    brush.circle(cx, cy, Math.max(1, r * f), irr);
    clearStroke();
  } };
}

// Several tiny dots drawn at once (stars, grass seed heads, …).
function dotsS(points, r, color, s, e) {
  return { s, e, fn: (f) => {
    if (f <= 0) return;
    brush.set("marker", color, 0.9);
    const k = Math.max(1, Math.ceil(f * points.length));
    for (let i = 0; i < k; i++) brush.circle(points[i][0], points[i][1], r, 0.2);
    clearStroke();
  } };
}

// Spread N strokes evenly across the drawing window, in array order.
function spread(strokes) {
  const n = strokes.length;
  return strokes.map((st, i) => ({
    s: (i / n) * 0.9,
    e: (i / n) * 0.9 + 0.1,
    fn: st.fn,
  }));
}

function drawStrokes(strokes, p) {
  for (const st of strokes) {
    if (p <= st.s) continue;
    const f = Math.min(1, (p - st.s) / (st.e - st.s));
    st.fn(f);
  }
}

// ── hand-drawn charcoal frame ──────────────────────────────────────────────
// Deterministic wobble (seeded RNG) so the frame is identical on every frame.
// A paper mat clears a margin first, so the charcoal reads on every scene,
// including the dark night scene. Two wobbly lines, corners overshooting
// like a real hand-drawn sketchbook frame.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wobblyRectPoints(inset, wob, over) {
  const rnd = mulberry32(77 + inset);
  const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
  const pts = [];
  const edge = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    const n = Math.max(2, Math.round(len / 45));
    const nx = -dy / len, ny = dx / len; // perpendicular
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const j = (rnd() - 0.5) * 2 * wob;
      pts.push([ax + dx * f + nx * j, ay + dy * f + ny * j]);
    }
  };
  edge(x0 - over, y0, x1 + over, y0);   // top, overshooting both corners
  edge(x1, y0 - over, x1, y1 + over);   // right
  edge(x1 + over, y1, x0 - over, y1);   // bottom
  edge(x0, y1 + over, x0, y0 - over);   // left
  return pts;
}

const BORDER_OUTER = wobblyRectPoints(9, 2.2, 7);
const BORDER_INNER = wobblyRectPoints(19, 1.6, 4);

function washPoly(points, color, op) {
  brush.wash(color, op);
  brush.polygon(points);
  clearStroke();
}

function drawBorder() {
  // paper mat: 26px margin strips
  washPoly([[0, 0], [W, 0], [W, 26], [0, 26]], PAPER, 255);
  washPoly([[0, H - 26], [W, H - 26], [W, H], [0, H]], PAPER, 255);
  washPoly([[0, 26], [26, 26], [26, H - 26], [0, H - 26]], PAPER, 255);
  washPoly([[W - 26, 26], [W, 26], [W, H - 26], [W - 26, H - 26]], PAPER, 255);
  // charcoal double frame
  brush.set("charcoal", "#2b2118", 2.4);
  brush.spline(BORDER_OUTER, 0.9);
  clearStroke();
  brush.set("charcoal", "#2b2118", 1.1);
  brush.spline(BORDER_INNER, 0.9);
  clearStroke();
}

// ── Scene 0 · a fox in a forest clearing ───────────────────────────────────
function foxStrokes() {
  const S = [];
  // sky wash + sun
  S.push(polyS([[0, 0], [800, 0], [800, 300], [0, 300]], "#bcd9e8", 110, null, null, 0));
  S.push(circleS(660, 78, 44, 0.15, "#fcd34d", 210, "marker", "#e8a13c", 1.2));
  S.push(splineS([[120, 90], [180, 70], [250, 88]], 0.8, "marker", "#ffffff", 1.4));
  S.push(splineS([[480, 60], [540, 44], [600, 58]], 0.8, "marker", "#ffffff", 1.4));
  // distant hills + ground
  S.push(polyS([[0, 300], [200, 258], [400, 296], [600, 256], [800, 292], [800, 450], [0, 450]], "#9dbb7a", 120, null, null, 0));
  S.push(polyS([[0, 350], [220, 330], [430, 352], [640, 332], [800, 350], [800, 450], [0, 450]], "#a8c686", 150, null, null, 0));
  // pine trees
  S.push(lineS(92, 380, 92, 292, "charcoal", "#5d4128", 1.6));
  S.push(polyS([[92, 210], [48, 300], [136, 300]], "#3f6b3a", 190, "HB", "#2c4f2a", 1));
  S.push(polyS([[92, 255], [58, 325], [126, 325]], "#4a7a44", 190, "HB", "#2c4f2a", 1));
  S.push(lineS(712, 380, 712, 300, "charcoal", "#5d4128", 1.6));
  S.push(polyS([[712, 225], [672, 305], [752, 305]], "#3f6b3a", 190, "HB", "#2c4f2a", 1));
  S.push(polyS([[712, 265], [682, 330], [742, 330]], "#4a7a44", 190, "HB", "#2c4f2a", 1));
  // bush + grass tufts
  S.push(circleS(150, 372, 34, 0.4, "#5d8a48", 170, "HB", "#3c5a2e", 0.9));
  S.push(lineS(240, 400, 232, 372, "marker", "#4a7a44", 1.1));
  S.push(lineS(250, 400, 252, 370, "marker", "#4a7a44", 1.1));
  S.push(lineS(560, 405, 552, 378, "marker", "#4a7a44", 1.1));
  S.push(lineS(580, 405, 586, 376, "marker", "#4a7a44", 1.1));
  // ── the fox (sitting, facing left) ──
  // bushy tail first, so the body overlaps its base
  S.push(splineS([[438, 352], [500, 378], [545, 348], [540, 300], [495, 292]], 0.9, "marker", "#e07830", 2.6));
  S.push(splineS([[540, 300], [522, 288], [500, 292]], 0.9, "marker", "#fdf6ec", 2.2));
  // body + white chest
  S.push(polyS([[352, 384], [350, 306], [388, 272], [438, 290], [448, 384]], "#e07830", 205, "HB", "#8a4a1d", 1.1));
  S.push(polyS([[372, 384], [376, 314], [398, 300], [416, 384]], "#fdf6ec", 200, null, null, 0));
  // head + ears
  S.push(circleS(394, 252, 42, 0.12, "#e07830", 205, "HB", "#8a4a1d", 1.1));
  S.push(polyS([[364, 224], [354, 188], [386, 210]], "#e07830", 205, "HB", "#8a4a1d", 1));
  S.push(polyS([[366, 218], [362, 198], [378, 210]], "#7a3d16", 220, null, null, 0));
  S.push(polyS([[418, 222], [432, 190], [442, 218]], "#e07830", 205, "HB", "#8a4a1d", 1));
  S.push(polyS([[422, 216], [430, 198], [436, 214]], "#7a3d16", 220, null, null, 0));
  // snout, nose, eyes
  S.push(polyS([[374, 268], [414, 268], [394, 292]], "#fdf6ec", 200, null, null, 0));
  S.push(circleS(394, 288, 6, 0.1, "#2b2118", 255, null, null, 0));
  S.push(circleS(378, 246, 5, 0.1, "#2b2118", 255, null, null, 0));
  S.push(circleS(410, 246, 5, 0.1, "#2b2118", 255, null, null, 0));
  // front legs
  S.push(lineS(372, 384, 372, 344, "charcoal", "#8a4a1d", 1.6));
  S.push(lineS(414, 384, 414, 344, "charcoal", "#8a4a1d", 1.6));
  // butterfly
  S.push(splineS([[540, 210], [528, 196], [540, 186]], 0.9, "marker", "#e8912d", 1.1));
  S.push(splineS([[540, 210], [552, 196], [540, 186]], 0.9, "marker", "#e8912d", 1.1));
  S.push(lineS(540, 210, 540, 224, "HB", "#33302a", 0.8));
  return spread(S);
}

// ── Scene 1 · an owl on a branch at night ──────────────────────────────────
function owlStrokes() {
  const S = [];
  // night sky — solid dark wash so the scene reads as night
  S.push(polyS([[0, 0], [800, 0], [800, 450], [0, 450]], null, 0, null, null, 0, undefined, undefined, undefined, ["#22344d", 235]));
  // moon + stars
  S.push(circleS(640, 82, 42, 0.1, "#f5eeda", 225, null, null, 0));
  S.push(circleS(626, 72, 8, 0.2, "#d8cdb2", 200, null, null, 0));
  S.push(circleS(652, 94, 6, 0.2, "#d8cdb2", 200, null, null, 0));
  S.push(dotsS([[90, 70], [180, 48], [300, 90], [420, 52], [520, 110], [730, 60], [120, 160], [250, 140], [470, 170], [700, 180], [60, 250], [760, 250]], 3, "#ffe9a8"));
  // branch + leaves
  S.push(splineS([[40, 372], [280, 336], [540, 356], [780, 322]], 0.6, "marker", "#6b4a2f", 2.6));
  S.push(splineS([[300, 342], [330, 306], [360, 292]], 0.8, "charcoal", "#6b4a2f", 1.2));
  S.push(polyS([[330, 306], [318, 288], [342, 290]], "#4a7a44", 200, null, null, 0));
  S.push(polyS([[356, 296], [348, 276], [368, 282]], "#4a7a44", 200, null, null, 0));
  S.push(polyS([[620, 344], [606, 324], [632, 326]], "#3f6b3a", 200, null, null, 0));
  // ── the owl ──
  S.push(polyS([[352, 344], [346, 272], [376, 226], [424, 226], [454, 272], [448, 344]], "#8a6a44", 215, "HB", "#4a3520", 1.1));
  S.push(polyS([[370, 344], [372, 288], [400, 276], [428, 288], [430, 344]], "#cbb08a", 190, null, null, 0, { dist: 9, angle: 90 }));
  // ear tufts
  S.push(polyS([[362, 198], [350, 164], [378, 186]], "#8a6a44", 215, "HB", "#4a3520", 1));
  S.push(polyS([[438, 198], [450, 164], [422, 186]], "#8a6a44", 215, "HB", "#4a3520", 1));
  // head
  S.push(circleS(400, 226, 48, 0.1, "#8a6a44", 215, "HB", "#4a3520", 1.1));
  // eyes: white, pupils, highlights
  S.push(circleS(382, 220, 17, 0.05, "#fdf6ec", 240, "HB", "#4a3520", 1));
  S.push(circleS(418, 220, 17, 0.05, "#fdf6ec", 240, "HB", "#4a3520", 1));
  S.push(circleS(382, 220, 7, 0.05, "#1d2733", 255, null, null, 0));
  S.push(circleS(418, 220, 7, 0.05, "#1d2733", 255, null, null, 0));
  S.push(circleS(379, 217, 2.5, 0.05, "#ffffff", 255, null, null, 0));
  S.push(circleS(415, 217, 2.5, 0.05, "#ffffff", 255, null, null, 0));
  // beak + wings + feet
  S.push(polyS([[392, 238], [408, 238], [400, 254]], "#e8912d", 230, null, null, 0));
  S.push(splineS([[352, 280], [344, 320], [356, 338]], 0.8, "charcoal", "#4a3520", 1.4));
  S.push(splineS([[448, 280], [456, 320], [444, 338]], 0.8, "charcoal", "#4a3520", 1.4));
  S.push(lineS(384, 344, 384, 356, "charcoal", "#e8912d", 1.2));
  S.push(lineS(416, 344, 416, 356, "charcoal", "#e8912d", 1.2));
  // a moth by the moon
  S.push(circleS(560, 130, 4, 0.1, "#f5eeda", 230, null, null, 0));
  S.push(splineS([[560, 130], [550, 122], [556, 114]], 0.9, "marker", "#f5eeda", 0.8));
  S.push(splineS([[560, 130], [570, 122], [564, 114]], 0.9, "marker", "#f5eeda", 0.8));
  return spread(S);
}

// ── Scene 2 · a turtle in a pond ───────────────────────────────────────────
function turtleStrokes() {
  const S = [];
  // sky wash + sun
  S.push(polyS([[0, 0], [800, 0], [800, 250], [0, 250]], "#cfe6ef", 110, null, null, 0));
  S.push(circleS(140, 70, 36, 0.15, "#fcd34d", 210, "marker", "#e8a13c", 1.2));
  S.push(splineS([[560, 80], [620, 62], [680, 78]], 0.8, "marker", "#ffffff", 1.4));
  // pond
  S.push(polyS([[0, 250], [800, 250], [800, 450], [0, 450]], "#7fb3a0", 165, null, null, 0));
  S.push(splineS([[0, 252], [200, 242], [420, 254], [640, 244], [800, 252]], 0.7, "marker", "#4e8a76", 1.4));
  // reeds
  S.push(splineS([[70, 400], [62, 300], [74, 220]], 0.7, "marker", "#4a7a44", 1.6));
  S.push(splineS([[100, 410], [106, 310], [96, 240]], 0.7, "marker", "#5d8a48", 1.6));
  S.push(circleS(74, 212, 8, 0.2, "#7a5a34", 230, null, null, 0));
  S.push(splineS([[712, 400], [720, 300], [710, 230]], 0.7, "marker", "#4a7a44", 1.6));
  S.push(splineS([[742, 410], [736, 320], [748, 250]], 0.7, "marker", "#5d8a48", 1.6));
  S.push(circleS(710, 222, 8, 0.2, "#7a5a34", 230, null, null, 0));
  // lily pads + flower
  S.push(circleS(220, 396, 32, 0.25, "#4e8a4a", 200, "HB", "#2f5a30", 1));
  S.push(circleS(590, 404, 38, 0.25, "#4e8a4a", 200, "HB", "#2f5a30", 1));
  S.push(circleS(648, 372, 24, 0.25, "#5d8a48", 200, "HB", "#2f5a30", 1));
  S.push(circleS(220, 386, 10, 0.2, "#f2a7c3", 220, "marker", "#d97a9e", 1));
  // ripples around the turtle
  S.push(splineS([[300, 396], [360, 410], [430, 398]], 0.8, "marker", "#dcefe8", 1.1));
  S.push(splineS([[290, 414], [380, 428], [470, 412]], 0.8, "marker", "#dcefe8", 1.1));
  // ── the turtle ──
  // shell dome with hatch texture
  S.push(polyS([[318, 366], [328, 302], [368, 272], [432, 272], [472, 302], [482, 366]], "#5a8a3c", 215, "HB", "#334d1e", 1.2, { dist: 11, angle: 45 }));
  // shell plates
  S.push(splineS([[400, 276], [400, 360]], 0.6, "charcoal", "#334d1e", 1));
  S.push(splineS([[360, 288], [352, 360]], 0.6, "charcoal", "#334d1e", 1));
  S.push(splineS([[440, 288], [448, 360]], 0.6, "charcoal", "#334d1e", 1));
  // head + eye
  S.push(circleS(492, 318, 22, 0.12, "#7fae56", 210, "HB", "#334d1e", 1));
  S.push(circleS(498, 312, 4, 0.05, "#1d2733", 255, null, null, 0));
  // flippers
  S.push(polyS([[330, 362], [312, 388], [342, 392]], "#7fae56", 210, "HB", "#334d1e", 1));
  S.push(polyS([[470, 362], [488, 388], [458, 392]], "#7fae56", 210, "HB", "#334d1e", 1));
  S.push(polyS([[352, 366], [344, 392], [368, 390]], "#6a9a48", 210, "HB", "#334d1e", 1));
  S.push(polyS([[448, 366], [456, 392], [432, 390]], "#6a9a48", 210, "HB", "#334d1e", 1));
  // tail
  S.push(polyS([[318, 350], [300, 360], [318, 366]], "#7fae56", 210, "HB", "#334d1e", 1));
  // dragonfly
  S.push(lineS(180, 200, 196, 216, "HB", "#33302a", 0.9));
  S.push(splineS([[186, 206], [170, 196], [164, 186]], 0.9, "marker", "#bcd9e8", 1));
  S.push(splineS([[186, 206], [202, 196], [208, 186]], 0.9, "marker", "#bcd9e8", 1));
  return spread(S);
}

// ── render one moment ──────────────────────────────────────────────────────
const SCENE_FNS = [foxStrokes, owlStrokes, turtleStrokes];
let sceneCache = {};

function renderFrame(t) {
  brush.seed(1234);
  brush.noiseSeed(1234);
  const si = Math.min(SCENES - 1, Math.floor(t / SCENE_LEN));
  const lt = t - si * SCENE_LEN;
  const p = Math.min(1, lt / DRAW_LEN);
  brush.clear(PAPER);
  brush.push();
  brush.translate(-W / 2, -H / 2);
  brush.wiggle(1.2);
  if (!sceneCache[si]) sceneCache[si] = SCENE_FNS[si]();
  drawStrokes(sceneCache[si], p);
  drawBorder();
  brush.pop();
  brush.render();
  return document.querySelector("canvas").toDataURL("image/png");
}

window.renderFrame = renderFrame;
window.SCENE_LEN = SCENE_LEN;
window.SCENES = SCENES;
