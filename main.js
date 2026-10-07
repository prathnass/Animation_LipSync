import * as THREE from 'three';

/* ========== 1. SETTINGS (edit these) ========== */
const AUDIO_FILE = 'rap.mp3';   // your rap track, same folder as index.html
const BPM = 90;                 // tempo of your track (tap it out to find it)

// Mouth shapes = Blender "shape keys". w = width, h = openness.
const SHAPES = {
  rest: { w: 1.0, h: 0.10 },
  A:    { w: 1.0, h: 1.00 },  // "ah"
  E:    { w: 1.6, h: 0.40 },  // "ee"
  O:    { w: 0.7, h: 0.80 },  // "oh"
  U:    { w: 0.5, h: 0.50 },  // "oo"
  MBP:  { w: 1.0, h: 0.02 },  // lips closed: M, B, P
  FV:   { w: 1.1, h: 0.20 },  // teeth on lip: F, V
};

// Lip-sync timeline = your keyframes. [time in seconds, shape].
// LISTEN to your track and replace these with the real timings.
// Leave the list EMPTY to get automatic volume-based mouth movement.
const TIMELINE = [
  [0.00, 'rest'], [0.20, 'MBP'], [0.30, 'A'], [0.50, 'E'], [0.70, 'MBP'],
  [0.85, 'O'],    [1.05, 'A'],   [1.25, 'FV'], [1.40, 'E'], [1.60, 'MBP'],
  [1.75, 'A'],    [1.95, 'U'],   [2.15, 'E'],  [2.35, 'rest'],
];

/* ========== 2. SCENE, CAMERA, LIGHTS ========== */
const W = 1280, H = 720;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1033);
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
camera.position.set(0, 1.4, 6.5);
camera.lookAt(0, 1.2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
document.getElementById('wrap').appendChild(renderer.domElement);

const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5);
const fill = new THREE.DirectionalLight(0x88aaff, 0.8); fill.position.set(-4, 1, 4);
const rim = new THREE.DirectionalLight(0xb040ff, 2.0); rim.position.set(0, 3, -5);
scene.add(key, fill, rim, new THREE.AmbientLight(0x404060, 0.6));

// simple graffiti-style backdrop
const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x2b1b55 }));
wall.position.z = -3; scene.add(wall);
[[-4, 2, 0xff3d81], [4, 1, 0x20e3b2], [3, 3, 0xffd400]].forEach(([x, y, c]) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: c }));
  b.position.set(x, y, -2.9); b.rotation.z = x * 0.1; scene.add(b);
});

/* ========== 3. CHARACTER ========== */
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
const char = new THREE.Group(); scene.add(char);

const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 32), mat(0x2f6bff));
body.position.y = 0.2; char.add(body);                       // blue hoodie

const head = new THREE.Group(); head.position.y = 1.6; char.add(head);
head.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 48), mat(0xf2b88c)));
const hood = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.18, 16, 48, Math.PI * 1.3), mat(0x2f6bff));
hood.rotation.z = Math.PI * 0.85; hood.position.z = -0.1; head.add(hood);

const eyes = [], pupils = [], brows = [];
[-1, 1].forEach((s) => {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 24), mat(0xffffff));
  eye.position.set(s * 0.3, 0.15, 0.74); head.add(eye); eyes.push(eye);
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), mat(0x111111));
  p.position.set(0, 0, 0.12); eye.add(p); pupils.push(p);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mat(0x3a2210));
  brow.position.set(s * 0.3, 0.42, 0.78); head.add(brow); brows.push(brow);
});

const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), mat(0x5a0f1c)); // mouth shape
mouth.position.set(0, -0.3, 0.84); head.add(mouth);

// arms pivot at the shoulders
const arms = [-1, 1].map((s) => {
  const pivot = new THREE.Group(); pivot.position.set(s * 1.1, 0.8, 0); char.add(pivot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.2, 16), mat(0x2f6bff));
  arm.position.y = -0.6; pivot.add(arm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), mat(0xf2b88c));
  hand.position.y = -1.25; pivot.add(hand);
  pivot.rotation.z = s * 0.2;
  return pivot;
});

/* ========== 4. LIP-SYNC ========== */
const cur = { w: 1, h: 0.1 };           // current (smoothed) mouth values
const smooth = (x) => x * x * (3 - 2 * x);

function shapeAt(t) {
  let i = TIMELINE.length - 1;
  while (i > 0 && TIMELINE[i][0] > t) i--;
  const a = SHAPES[TIMELINE[i][1]];
  const next = TIMELINE[i + 1];
  if (!next || t < TIMELINE[i][0]) return a;
  const b = SHAPES[next[1]];
  const p = (t - TIMELINE[i][0]) / (next[0] - TIMELINE[i][0]);
  const k = smooth(Math.min(1, Math.max(0, (p - 0.3) / 0.7)));  // hold, then move quickly
  return { w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}

/* ========== 5. AUDIO + RECORDING ========== */
const audio = new Audio(AUDIO_FILE);
audio.crossOrigin = 'anonymous';
let ac, analyser, dest, data;
function initAudio() {
  if (ac) return;
  ac = new AudioContext();
  const src = ac.createMediaElementSource(audio);
  analyser = ac.createAnalyser(); analyser.fftSize = 256;
  data = new Uint8Array(analyser.frequencyBinCount);
  dest = ac.createMediaStreamDestination();
  src.connect(analyser); analyser.connect(ac.destination); analyser.connect(dest);
}
const status = document.getElementById('status');
document.getElementById('play').onclick = () => {
  initAudio(); ac.resume();
  audio.paused ? audio.play() : audio.pause();
};
audio.onerror = () => (status.textContent = 'Could not load ' + AUDIO_FILE + ' (use Live Server)');

let recorder, chunks = [];
document.getElementById('rec').onclick = () => {
  initAudio(); ac.resume();
  const stream = renderer.domElement.captureStream(24);              // 24 FPS
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 8e6 });
  chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
    a.download = 'output.webm'; a.click();
    status.textContent = 'Saved output.webm. Convert: ffmpeg -i output.webm -c:v libx264 -c:a aac final.mp4';
  };
  audio.currentTime = 0; audio.play(); recorder.start();
  status.textContent = 'Recording...';
  audio.onended = () => recorder.state === 'recording' && recorder.stop();
};

/* ========== 6. BODY ANIMATION ========== */
// spring = smooth motion with overshoot (follow-through)
const spring = (k = 0.15, d = 0.7) => ({ v: 0, x: 0, k, d, to(t) { this.v = (this.v + (t - this.x) * this.k) * this.d; this.x += this.v; return this.x; } });
const nodX = spring(0.2, 0.65), nodY = spring(0.05, 0.85), armR = spring(0.12, 0.72), armL = spring(0.12, 0.72);
let nextBlink = 2, blink = 0;

function animateBody(t) {
  const beat = (t * BPM) / 60;
  const ph = beat % 1;

  // Nod: head dips on every beat, strong accent on bar start (spacing + timing)
  const accent = Math.floor(beat) % 4 === 0 ? 0.22 : 0.1;
  head.rotation.x = nodX.to(ph < 0.25 ? accent : 0);
  head.rotation.y = nodY.to(Math.sin(beat * 0.5 * Math.PI) * 0.18);
  body.position.y = 0.2 - (ph < 0.2 ? 0.04 : 0);

  // Arm gesture every 4 beats: ANTICIPATION (pull back) then swing up
  const bar = beat % 4;
  let r = 0;
  if (bar > 3 && bar < 3.5) r = -0.4;          // anticipation
  else if (bar >= 3.5 || bar < 0.5) r = 1.5;   // big gesture
  arms[1].rotation.z = 0.2 + armR.to(r);
  arms[0].rotation.z = -0.2 - armL.to(Math.floor(beat / 4) % 2 ? 0 : 0.6 * Math.sin(beat * Math.PI));

  // Eyebrows rise on the accent beat (exaggeration)
  brows.forEach((b) => (b.position.y = 0.42 + (accent > 0.15 && ph < 0.3 ? 0.06 : 0)));

  // Eyes look at camera with tiny drift; random blinks
  pupils.forEach((p) => p.position.x = Math.sin(t * 0.7) * 0.02);
  if (t > nextBlink) { blink = 1; nextBlink = t + 1.5 + Math.random() * 2.5; }
  blink = Math.max(0, blink - 0.2);
  eyes.forEach((e) => (e.scale.y = 1 - 0.9 * Math.sin(blink * Math.PI)));
}

/* ========== 7. MAIN LOOP ========== */
function tick() {
  requestAnimationFrame(tick);
  const t = audio.currentTime;

  let target;
  if (TIMELINE.length) target = shapeAt(t);
  else if (analyser) {                       // fallback: volume-driven mouth
    analyser.getByteFrequencyData(data);
    const vol = data.slice(2, 40).reduce((s, v) => s + v, 0) / 38 / 255;
    target = { w: 1, h: Math.min(1, vol * 2.2) };
  } else target = SHAPES.rest;

  cur.w += (target.w - cur.w) * 0.6;
  cur.h += (target.h - cur.h) * 0.6;
  mouth.scale.set(0.22 * cur.w, 0.02 + 0.2 * cur.h, 0.08);

  animateBody(t);
  renderer.render(scene, camera);
}
tick();
