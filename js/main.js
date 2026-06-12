// jalur dan konstanta game
const LANE_X      = [-5, 0, 5];   // jarak X untuk tiap jalur (kiri, tengah, kanan)
const SWITCH_T    = 0.20;          // untuk pindah jalur (semakin kecil semakin cepat pindah)
const SPAWN_AHEAD = 80;            // jarak muncul nya objek
const DESPAWN     = 14;            // jarak di mana objek dihapus (sudah lewat jauh)

// jarak minimum dan maksimum antara rintangan (obstacle) dan kristal (crystal) yang muncul
const OBS_MIN_GAP = 30;
const OBS_MAX_GAP = 50;
const CRY_MIN_GAP = 12;
const CRY_MAX_GAP = 22;

// THREE.JS SETUP 
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x000008);
scene.fog = new THREE.FogExp2(0x00000f, 0.007);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 6, 16);
camera.lookAt(0, 0, -10);

// pencahayaan 
scene.add(new THREE.AmbientLight(0x1122aa, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(10, 30, 10);
sun.castShadow = true;
scene.add(sun);
const rimLight = new THREE.DirectionalLight(0x0033ff, 0.5);
rimLight.position.set(-15, -5, -30);
scene.add(rimLight);
const engLight = new THREE.PointLight(0xff5500, 3, 9);
scene.add(engLight);

// bintang-bintang di latar belakang
(function() {
  const geo = new THREE.BufferGeometry();
  const n = 3000;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 600;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28 })));
})();

// planet dekoratif
function mkPlanet(r, col, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 32, 32),
    new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.13 })
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}
const planets = [
  mkPlanet(14, 0x1a3366, -85, -15, -200),
  mkPlanet(8,  0x772233, 100,  10, -270),
  mkPlanet(5,  0x225544, -35,  26, -340)
];

//track jalanan (ilusi lewat)
const trackG = new THREE.Group();
scene.add(trackG);
(function() {
  const LEN = 600, HW = 7;
  // lantai jalan
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HW * 2, LEN, 14, 60),
    new THREE.MeshPhongMaterial({ color: 0x000a1a, emissive: 0x000510, transparent: true, opacity: 0.85 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.4, -LEN / 2 + 20);
  trackG.add(floor);
  // garis rel jalan
  const railMat = new THREE.MeshPhongMaterial({ color: 0x003399, emissive: 0x001166, emissiveIntensity: 0.6 });
  [-HW, HW].forEach(function(x) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, LEN), railMat);
    r.position.set(x, -1.35, -LEN / 2 + 20);
    trackG.add(r);
  });
  // garis putus putus di tengah jalan
  const dashMat = new THREE.MeshPhongMaterial({ color: 0x002255, emissive: 0x001133 });
  [-2.5, 2.5].forEach(function(x) {
    for (let i = 0; i < 60; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 4.5), dashMat);
      d.position.set(x, -1.38, -i * 10 - 5);
      trackG.add(d);
    }
  });
})();

//glb  objek
var SHIP_MODEL_PATH = 'ufo.glb';   

// warna untuk objek
var CLICK_COLORS = [
  0xffffff,  // putih  (warna awal / reset)
  0x00e5ff,  // cyan
  0xff4466,  // merah muda
  0xffe500,  // kuning
  0x00ff88,  // hijau
  0xbf80ff,  // ungu
  0xff8800,  // oranye
  0x44aaff,  // biru muda
];
var colorIndex = 0; // index warna saat ini

// Menyimpan semua mesh di dalam model
var shipMeshes = [];

// SHIP GROUP 
var ship = new THREE.Group();
scene.add(ship);

// LOAD MODEL gltf dengan THREE.GLTFLoader
var loader = new THREE.GLTFLoader();
loader.load(
  SHIP_MODEL_PATH,
  function(gltf) {
    var model = gltf.scene;

    // ukuran objek utama
    var box  = new THREE.Box3().setFromObject(model);
    var size = new THREE.Vector3();
    box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z);
    var scale  = 8.0 / maxDim;
    model.scale.setScalar(scale);

    // posisi objek utama
    var center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center.multiplyScalar(scale));

    // Kumpulkan mesh + aktifkan shadow
    model.traverse(function(child) {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.material      = child.material.clone(); // clone biar aman
        shipMeshes.push(child);
      }
    });

    ship.add(model);
    console.log('Model dimuat:', SHIP_MODEL_PATH);
  },
  undefined,
  function(err) { console.error('Gagal load model:', err); }
);

// ganti warna ketika di click
function cycleShipColor() {
  if (shipMeshes.length === 0) return;

  // Maju ke warna berikutnya, balik ke awal kalau sudah habis
  colorIndex = (colorIndex + 1) % CLICK_COLORS.length;
  var newColor = new THREE.Color(CLICK_COLORS[colorIndex]);

  shipMeshes.forEach(function(m) {
    m.material.color.set(newColor);
    // Emissive glow tipis dengan warna yang sama
    m.material.emissive.set(newColor);
    m.material.emissiveIntensity = 0.25;
  });
}

// status game dan variabel global
const G = {
  running: false, paused: false,
  score: 0, hi: 0, lives: 3,
  combo: 0, comboT: 0,
  tLane: 1,          // target jalur 0/1/2
  speed: 0.55,
  dist: 0,
  // jarak ke depan untuk munculnya rintangan dan crystal berikutnya, diinisialisasi saat reset
  nextObsDist: 0,    // set on reset
  nextCryDist: 0
};

//objects di game: rintangan (obstacles) dan kristal (crystals) 
const obstacles = [];
const crystals  = [];
const CRYS_COL  = [0x00e5ff, 0xbf80ff, 0xffe500, 0x00ff88, 0xff80bf];

// Spawn rintangan, bisa 1 atau 2 jalur yang terblokir, dengan bentuk dan ukuran acak
function spawnObstacleRow() {
  // 70 persen hanya 1 rintangan, 30 persen bisa 2 rintangan sekaligus (tapi gak pernah 3, biar selalu ada jalan)
  const count   = Math.random() < 0.70 ? 1 : 2;
  const shuffle = [0, 1, 2].sort(function() { return Math.random() - 0.5; });
  const blocked = shuffle.slice(0, count);

  blocked.forEach(function(lane) {
    const r   = 0.7 + Math.random() * 0.8;
    const geo = Math.random() > 0.5
      ? new THREE.DodecahedronGeometry(r, 0)
      : new THREE.SphereGeometry(r, 5, 5);
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(0.06 + Math.random() * 0.07, 0.44, 0.3),
      shininess: 18
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LANE_X[lane], -0.1 + Math.random() * 0.8, -SPAWN_AHEAD);
    mesh.castShadow = true;
    scene.add(mesh);
    obstacles.push({
      mesh: mesh,
      r: r,
      rx: (Math.random() - 0.5) * 0.04,
      ry: (Math.random() - 0.5) * 0.04,
      rz: (Math.random() - 0.5) * 0.04
    });
  });
}

function spawnCrystal() {
  const lane  = Math.floor(Math.random() * 3);
  const col   = CRYS_COL[Math.floor(Math.random() * CRYS_COL.length)];
  const geo   = Math.random() > 0.5
    ? new THREE.OctahedronGeometry(0.52, 0)
    : new THREE.IcosahedronGeometry(0.48, 0);
  const mat   = new THREE.MeshPhongMaterial({
    color: col, emissive: col, emissiveIntensity: 0.7,
    transparent: true, opacity: 0.92, shininess: 200
  });
  const mesh  = new THREE.Mesh(geo, mat);
  const baseY = 0.5;
  mesh.position.set(LANE_X[lane], baseY, -SPAWN_AHEAD);
  scene.add(mesh);
  crystals.push({ mesh: mesh, baseY: baseY, t: Math.random() * Math.PI * 2 });
}

// penyeleksian elemen UI untuk update skor, nyawa, kecepatan, dan efek lainnya
const scoreNum = document.getElementById('score-num');
const hiV      = document.getElementById('hv');
const spV      = document.getElementById('sv');
const flashEl  = document.getElementById('flash');
const comboEl  = document.getElementById('combo');
const ldots    = [0, 1, 2].map(function(i) { return document.getElementById('d' + i); });
const hearts   = [0, 1, 2].map(function(i) { return document.getElementById('h' + i); });
const ovS      = document.getElementById('os');
const ovO      = document.getElementById('oo');
const ovP      = document.getElementById('op');
const ovSc     = document.getElementById('osc');

// KEYBOARD 
const keys = { L: false, R: false };
window.addEventListener('keydown', function(e) {
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  keys.L = true;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.R = true;
});
window.addEventListener('keyup', function(e) {
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  keys.L = false;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.R = false;
});
var lWas = false, rWas = false;
function handleKeys() {
  if (keys.L && !lWas && G.tLane > 0) { G.tLane--; updateHUD(); }
  if (keys.R && !rWas && G.tLane < 2) { G.tLane++; updateHUD(); }
  lWas = keys.L;
  rWas = keys.R;
}

//  BUTTONS 
document.getElementById('bs').onclick  = startGame;
document.getElementById('bp').onclick  = togglePause;
document.getElementById('br').onclick  = restartGame;
document.getElementById('obs').onclick = startGame;
document.getElementById('obr').onclick = restartGame;
document.getElementById('opr').onclick = togglePause;

//  RAYCASTER (mouse hover / click on crystals) 
const ray   = new THREE.Raycaster();
const mouse = new THREE.Vector2(-9, 0);
window.addEventListener('mousemove', function(e) {
  mouse.x =  (e.clientX / innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
});
canvas.addEventListener('click', function() {
  if (!G.running || G.paused) return;
  ray.setFromCamera(mouse, camera);

  //  Klik objek ganti warna 
  if (shipMeshes.length > 0) {
    var shipHits = ray.intersectObjects(shipMeshes, false);
    if (shipHits.length > 0) {
      cycleShipColor();
      return; // klik hanya untuk ganti warna objek, gak untuk collect crystal, jadi return setelah ganti warna
    }
  }

  // Klik pada CRYSTAL 
  var hits = ray.intersectObjects(crystals.map(function(c) { return c.mesh; }));
  if (hits.length) {
    var found = null;
    for (var i = 0; i < crystals.length; i++) {
      if (crystals[i].mesh === hits[0].object) { found = crystals[i]; break; }
    }
    if (found) collectCrystal(found);
  }
});

// kontrol game: start, restart, pause
function startGame()   { ovS.classList.add('hide'); ovO.classList.add('hide'); ovP.classList.add('hide'); resetAll(); G.running = true;  G.paused = false; }
function restartGame() { ovO.classList.add('hide'); ovP.classList.add('hide'); resetAll(); G.running = true;  G.paused = false; }
function togglePause() {
  if (!G.running) return;
  G.paused = !G.paused;
  ovP.classList.toggle('hide', !G.paused);
}

function resetAll() {
  G.score = 0; G.lives = 3; G.combo = 0; G.comboT = 0;
  G.tLane = 1; G.speed = 0.55; G.dist = 0;
  // jarak rintangan dan objek ketika awal game, biar gak langsung muncul pas start
  G.nextObsDist = OBS_MIN_GAP;
  G.nextCryDist = CRY_MIN_GAP;

  ship.position.set(0, 0, 0);
  ship.rotation.set(0, 0, 0);

  for (var i = obstacles.length - 1; i >= 0; i--) {
    scene.remove(obstacles[i].mesh);
    obstacles[i].mesh.geometry.dispose();
  }
  obstacles.length = 0;

  for (var j = crystals.length - 1; j >= 0; j--) {
    scene.remove(crystals[j].mesh);
    crystals[j].mesh.geometry.dispose();
  }
  crystals.length = 0;

  updateHUD();
}

function updateHUD() {
  scoreNum.textContent = G.score;
  hiV.textContent      = G.hi;
  spV.textContent      = G.speed.toFixed(1);
  hearts.forEach(function(h, i) { h.classList.toggle('dead', i >= G.lives); });
  ldots.forEach(function(d, i)  { d.classList.toggle('on', i === G.tLane); });
}

// pengambilan crystal, dipanggil saat klik pada crystal atau auto-collect saat ship mendekat
function collectCrystal(c) {
  scene.remove(c.mesh);
  var idx = crystals.indexOf(c);
  if (idx > -1) crystals.splice(idx, 1);

  G.combo++;
  G.comboT = 100;
  var pts = 10 * Math.min(G.combo, 5);
  G.score += pts;
  if (G.score > G.hi) G.hi = G.score;
  updateHUD();

  var pop = document.createElement('div');
  pop.className   = 'spop';
  pop.textContent = '+' + pts + (G.combo > 1 ? ' ×' + G.combo : '');
  pop.style.left  = (innerWidth / 2 - 28) + 'px';
  pop.style.top   = (innerHeight * 0.45) + 'px';
  document.body.appendChild(pop);
  setTimeout(function() { pop.remove(); }, 900);

  if (G.combo > 1) {
    comboEl.textContent = 'COMBO ×' + G.combo + '!';
    comboEl.style.opacity = '1';
    setTimeout(function() { comboEl.style.opacity = '0'; }, 700);
  }
}

// damage function, dipanggil saat tabrakan dengan asteroid
var dmgCd = 0;
function takeDamage() {
  if (dmgCd > 0) return;
  dmgCd = 90;
  G.lives--;
  G.combo = 0;
  updateHUD();
  flashEl.style.opacity = '1';
  setTimeout(function() { flashEl.style.opacity = '0'; }, 160);
  ship.rotation.z = 0.3;
  setTimeout(function() { ship.rotation.z = 0; }, 220);
  if (G.lives <= 0) {
    G.running = false;
    ovSc.textContent = G.score;
    ovO.classList.remove('hide');
  }
}

// perulangan utama
var clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  var t = clock.getElapsedTime();

  if (G.running && !G.paused) {

    // jangan langsung pindah lane saat tombol ditekan, biar lebih smooth dan ada animasi lerp nya
    handleKeys();

  // pergerakan kiri kanan dengan lerp (bukan langsung pindah, biar lebih smooth)
    var tx = LANE_X[G.tLane];
    ship.position.x += (tx - ship.position.x) * SWITCH_T;
    ship.rotation.z  = -(tx - ship.position.x) * 0.11;
    ship.position.y  =  Math.sin(t * 1.6) * 0.06; // micro hover

    // semakin jauh, semakin cepat (skala kecepatan berdasarkan jarak tempuh)
    G.dist  += G.speed;
    G.speed  = 0.55 + Math.min(G.dist * 0.00012, 1.0);
    spV.textContent = G.speed.toFixed(1);

  // Gerakin track (ilusi jalanan lewat)
    trackG.position.z = (trackG.position.z + G.speed) % 10;

   // Jarak antara rintangan dan objek lain nya
    if (G.dist >= G.nextObsDist) {
      spawnObstacleRow();
      G.nextObsDist = G.dist + OBS_MIN_GAP + Math.random() * (OBS_MAX_GAP - OBS_MIN_GAP);
    }
    if (G.dist >= G.nextCryDist) {
      spawnCrystal();
      G.nextCryDist = G.dist + CRY_MIN_GAP + Math.random() * (CRY_MAX_GAP - CRY_MIN_GAP);
    }

    // Cooldown untuk damage, biar gak langsung kena lagi pas masih di jalur yang sama
    if (dmgCd > 0) dmgCd--;

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.mesh.position.z += G.speed;
      o.mesh.rotation.x += o.rx;
      o.mesh.rotation.y += o.ry;
      o.mesh.rotation.z += o.rz;

      if (o.mesh.position.z > DESPAWN) {
        scene.remove(o.mesh);
        o.mesh.geometry.dispose();
        obstacles.splice(i, 1);
        continue;
      }

      // tabrakan antara ufo dg asteroid
      var dz = o.mesh.position.z - ship.position.z;
      if (dz > -2.0 && dz < 1.5) {
        var dx = o.mesh.position.x - ship.position.x;
        var dy = o.mesh.position.y - ship.position.y;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < o.r + 0.72) {
          takeDamage();
          o.mesh.position.z = ship.position.z + 6; // pelan-pelan keluar dari jalur, biar gak langsung kena lagi
        }
      }
    }

    // efek csystal hover
    ray.setFromCamera(mouse, camera);
    var hovHits = ray.intersectObjects(crystals.map(function(c) { return c.mesh; }));
    var hovMesh = hovHits.length > 0 ? hovHits[0].object : null;

    for (var j = crystals.length - 1; j >= 0; j--) {
      var c = crystals[j];
      c.t += 0.038;
      c.mesh.position.z += G.speed;
      c.mesh.position.y  = c.baseY + Math.sin(c.t) * 0.2;
      c.mesh.rotation.x += 0.022;
      c.mesh.rotation.y += 0.028;

      if (c.mesh.position.z > DESPAWN) {
        scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        crystals.splice(j, 1);
        continue;
      }

      // Transformasi Skala csystal
      var isHov   = c.mesh === hovMesh;
      var tScale  = isHov ? 1.6 : 1.0;
      c.mesh.scale.lerp(new THREE.Vector3(tScale, tScale, tScale), 0.13);
      c.mesh.material.emissiveIntensity = isHov
        ? 1.3 + Math.sin(t * 7) * 0.35
        : 0.5 + Math.sin(t * 2.5 + j) * 0.12;

      // Auto ambil crystal kalau ship mendekat (bisa diambil tanpa klik)
      var sameLane = Math.abs(c.mesh.position.x - ship.position.x) < 1.6;
      if (sameLane && Math.abs(c.mesh.position.z - ship.position.z) < 1.3) {
        collectCrystal(c);
      }
    }

    // waktu kombo
    if (G.comboT > 0) { G.comboT--; } else { G.combo = 0; }

    // cahaya kedip kedip
    engLight.intensity = 3 + Math.sin(t * 10) * 0.8;
    engLight.position.set(ship.position.x, ship.position.y - 0.8, 0.2);

    // Rotasi planet 
    for (var p = 0; p < planets.length; p++) {
      planets[p].rotation.y += 0.0004 * (p + 1);
    }

    //Skor berdasarkan jarak tempuh
    if (Math.floor(G.dist) % 10 === 0) {
      G.score++;
      if (G.score > G.hi) G.hi = G.score;
      scoreNum.textContent = G.score;
      hiV.textContent      = G.hi;
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', function() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

animate();
