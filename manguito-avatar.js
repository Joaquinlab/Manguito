/* ============================================================
   Manguito — Avatar 3D reutilizable para la web
   ------------------------------------------------------------
   Mascota: mango kawaii "Obsidian Mango Luminescence"
   (cuerpo con textura degradada naranja, sonrisa, cachetes
    ruborizados, tallito y hojita, halo/sombra cálida).

   Se monta automáticamente en:
     - #manguito-drop-avatar   (landing: la mascota "come" la factura)
     - cualquier [data-manguito-avatar]  (logo vivo en Portal / CRM)

   API global (instancia principal):
     window.ManguitoAvatar.chew()          -> abre la boca y se traga la factura
     window.ManguitoAvatar.setOpenMouth(b) -> abre/cierra la boca (anticipación)
     window.ManguitoAvatar.reject()        -> reacción de rechazo

   API por instancia:
     window.ManguitoAvatar.mount(el, opts) -> { chew, setOpenMouth, reject, destroy }

   Características "web-friendly":
     - Carga three.js de forma perezosa (solo si hay un avatar montado).
     - Fallback: muestra la imagen .manguito-avatar-fallback si no hay WebGL.
     - Pausa el render cuando el avatar no está visible (IntersectionObserver).
     - Respeta prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  if (window.ManguitoAvatar && window.ManguitoAvatar.__ready) return;

  var THREE_URL = 'vendor/three.min.js';
  var instances = [];
  var primary = null;
  var reducedMotion = false;
  try {
    reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { reducedMotion = false; }

  // ---------- Carga perezosa de three.js ----------
  function ensureThree(cb) {
    if (window.THREE) { cb(null); return; }
    var existing = document.querySelector('script[data-manguito-three]');
    if (existing) {
      if (window.THREE) { cb(null); return; }
      existing.addEventListener('load', function () { cb(null); });
      existing.addEventListener('error', function () { cb(new Error('three')); });
      return;
    }
    var s = document.createElement('script');
    s.src = THREE_URL;
    s.async = true;
    s.setAttribute('data-manguito-three', '1');
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error('three')); };
    document.head.appendChild(s);
  }

  // ---------- Fallback sin WebGL ----------
  function fallback(container) {
    var img = container.querySelector('.manguito-avatar-fallback');
    if (img) { img.style.display = ''; return; }
    container.innerHTML =
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' +
      '<div style="width:78%;height:78%;border-radius:50%;' +
      'background:radial-gradient(circle at 50% 35%, #fbbf24, #f97316 62%, rgba(249,115,22,0) 72%);' +
      'box-shadow:0 0 30px rgba(251,146,60,.45);"></div></div>';
  }

  // ---------- Fábrica de una instancia ----------
  function createAvatar(container, opts) {
    if (!container) return null;
    opts = opts || {};

    var pending = { open: false, sad: 0, chew: false };

    var api = {
      el: container,
      chew: function () { pending.chew = true; },
      setOpenMouth: function (v) { pending.open = !!v; },
      reject: function () { pending.sad = 1; },
      destroy: function () {}
    };

    container.style.pointerEvents = opts.pointerEvents || 'none';
    try { container.style.overflow = 'hidden'; } catch (e) {}

    ensureThree(function (err) {
      if (err || !window.THREE || !container.isConnected) { fallback(container); return; }
      build(container, opts, api, pending);
    });

    return api;
  }

  // ---------- Construcción de la escena (avatar del diseño) ----------
  function build(container, opts, api, pending) {
    var width = container.clientWidth || opts.size || 40;
    var height = container.clientHeight || opts.size || 40;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) { fallback(container); return; }
    if (!renderer || !renderer.getContext()) { fallback(container); return; }

    // Ocultar el fallback (imagen SVG) una vez que el canvas está listo
    var fb = container.querySelector('.manguito-avatar-fallback');
    if (fb) fb.style.display = 'none';
    container.style.position = container.style.position || 'relative';

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 4.2);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // ---------- Luces: radiancia cálida naranja ----------
    scene.add(new THREE.AmbientLight(0xff7722, 1.4));
    var mainLight = new THREE.DirectionalLight(0xff9933, 2.6); mainLight.position.set(2.2, 4.2, 3.2); scene.add(mainLight);
    var fillLight = new THREE.PointLight(0xea580c, 3.8, 12); fillLight.position.set(-2.2, -0.6, 2.2); scene.add(fillLight);
    var bottomRimLight = new THREE.PointLight(0xc2410c, 3.4, 9); bottomRimLight.position.set(0, -2, -1); scene.add(bottomRimLight);

    var manguitoGroup = new THREE.Group();
    scene.add(manguitoGroup);

    // ---------- 1. Textura del cuerpo (mango maduro) ----------
    var texCanvas = document.createElement('canvas');
    texCanvas.width = 512; texCanvas.height = 512;
    var ctx = texCanvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0.0, '#ff9e1a');
    grad.addColorStop(0.25, '#f97316');
    grad.addColorStop(0.55, '#ea580c');
    grad.addColorStop(0.80, '#c2410c');
    grad.addColorStop(1.0, '#9a3412');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);

    var sideLeft = ctx.createRadialGradient(40, 260, 20, 40, 260, 240);
    sideLeft.addColorStop(0, 'rgba(154, 52, 18, 0.45)'); sideLeft.addColorStop(1, 'rgba(154, 52, 18, 0)');
    ctx.fillStyle = sideLeft; ctx.fillRect(0, 0, 512, 512);
    var sideRight = ctx.createRadialGradient(470, 260, 20, 470, 260, 240);
    sideRight.addColorStop(0, 'rgba(194, 65, 12, 0.45)'); sideRight.addColorStop(1, 'rgba(194, 65, 12, 0)');
    ctx.fillStyle = sideRight; ctx.fillRect(0, 0, 512, 512);

    // Cachetes ruborizados
    ctx.fillStyle = 'rgba(234, 45, 20, 0.48)';
    ctx.beginPath(); ctx.ellipse(170, 290, 45, 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(342, 290, 45, 25, 0, 0, Math.PI * 2); ctx.fill();

    var bodyTexture = new THREE.CanvasTexture(texCanvas);

    // ---------- Cuerpo: esfera deformada tipo huevo/mango ----------
    var bodyGeo = new THREE.SphereGeometry(1.0, 48, 48);
    var posAttr = bodyGeo.attributes.position;
    for (var i = 0; i < posAttr.count; i++) {
      var x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      var normY = (y + 1) * 0.5;
      var taper = 0.85 + 0.35 * normY;
      x *= taper; z *= taper * 0.95;
      x += (1.0 - normY) * 0.08;
      posAttr.setXYZ(i, x, y * 1.15, z);
    }
    bodyGeo.computeVertexNormals();

    var bodyMat = new THREE.MeshStandardMaterial({
      map: bodyTexture, roughness: 0.22, metalness: 0.05,
      emissive: 0xc2410c, emissiveIntensity: 0.45
    });
    var bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    manguitoGroup.add(bodyMesh);

    // ---------- 2. Ojos kawaii + brillos ----------
    var eyeGroup = new THREE.Group();
    manguitoGroup.add(eyeGroup);

    var eyeGeo = new THREE.SphereGeometry(0.18, 32, 32);
    var eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 0.1, metalness: 0.1 });

    var leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.scale.set(1.0, 1.25, 0.4); leftEye.position.set(-0.34, 0.06, 0.92); leftEye.rotation.y = -0.15;
    eyeGroup.add(leftEye);
    var rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.scale.set(1.0, 1.25, 0.4); rightEye.position.set(0.34, 0.06, 0.92); rightEye.rotation.y = 0.15;
    eyeGroup.add(rightEye);

    var highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var bigPupilGeo = new THREE.CircleGeometry(0.065, 24);
    var smallPupilGeo = new THREE.CircleGeometry(0.03, 20);
    var lb = new THREE.Mesh(bigPupilGeo, highlightMat); lb.position.set(-0.30, 0.13, 0.98); eyeGroup.add(lb);
    var ls = new THREE.Mesh(smallPupilGeo, highlightMat); ls.position.set(-0.37, 0.01, 0.98); eyeGroup.add(ls);
    var rb = new THREE.Mesh(bigPupilGeo, highlightMat); rb.position.set(0.38, 0.13, 0.98); eyeGroup.add(rb);
    var rs = new THREE.Mesh(smallPupilGeo, highlightMat); rs.position.set(0.31, 0.01, 0.98); eyeGroup.add(rs);

    // ---------- 3. Boca: sonrisa en reposo + cavidad que se abre ----------
    var mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.14, 0.9);
    manguitoGroup.add(mouthGroup);

    var smileCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.09, 0.02, 0.09),
      new THREE.Vector3(-0.04, -0.03, 0.10),
      new THREE.Vector3(0.04, -0.03, 0.10),
      new THREE.Vector3(0.09, 0.02, 0.09)
    );
    var smileMesh = new THREE.Mesh(
      new THREE.TubeGeometry(smileCurve, 20, 0.022, 12, false),
      new THREE.MeshStandardMaterial({ color: 0x431407, roughness: 0.3 })
    );
    mouthGroup.add(smileMesh);

    // Cavidad oscura (boca abierta)
    var cavityMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x2a0e02 })
    );
    cavityMesh.position.set(0, 0, 0.02);
    cavityMesh.scale.set(0.16, 0.12, 0.5);
    cavityMesh.visible = false;
    mouthGroup.add(cavityMesh);

    // Lengua
    var tongueMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xd94a2a, roughness: 0.5, emissive: 0x5a1400, emissiveIntensity: 0.35 })
    );
    tongueMesh.position.set(0, -0.1, 0.05);
    tongueMesh.scale.setScalar(0.02);
    tongueMesh.visible = false;
    mouthGroup.add(tongueMesh);

    // Luz cálida dentro de la boca
    var mouthLight = new THREE.PointLight(0xffb45c, 0, 4);
    mouthLight.position.set(0, -0.1, 0.6);
    mouthGroup.add(mouthLight);

    // ---------- 4. Tallito ----------
    var stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.06, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a2d0c, roughness: 0.8 })
    );
    stemMesh.position.set(-0.04, 1.25, 0);
    stemMesh.rotation.z = -0.18;
    manguitoGroup.add(stemMesh);

    // ---------- 5. Hojita verde ----------
    var leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.25, 0.15, 0.45, 0.05);
    leafShape.quadraticCurveTo(0.2, -0.18, 0, 0);
    var leafMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(leafShape),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.3 })
    );
    leafMesh.position.set(0.02, 1.28, 0.02);
    leafMesh.rotation.set(-0.2, 0.3, 0.35);
    leafMesh.scale.set(1.2, 1.2, 1.2);
    manguitoGroup.add(leafMesh);

    // ---------- 6. Sombra / aura cálida inferior ----------
    var shadowMat = new THREE.MeshBasicMaterial({ color: 0xea580c, transparent: true, opacity: 0.52, side: THREE.DoubleSide });
    var shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, -1.25, 0);
    scene.add(shadowMesh);

    // ---------- 7. Factura que vuela y se traga ----------
    var billCanvas = document.createElement('canvas');
    billCanvas.width = 256; billCanvas.height = 340;
    var bctx = billCanvas.getContext('2d');
    bctx.fillStyle = '#ffffff'; bctx.fillRect(0, 0, 256, 340);
    bctx.fillStyle = '#f97316'; bctx.fillRect(20, 22, 92, 14);
    bctx.fillStyle = '#e7d8c6';
    bctx.fillRect(20, 52, 140, 8); bctx.fillRect(20, 68, 200, 8); bctx.fillRect(20, 92, 216, 3);
    bctx.fillStyle = '#cbb9a4';
    for (var row = 0; row < 6; row++) {
      bctx.fillRect(20, 118 + row * 24, 120, 8);
      bctx.fillRect(180, 118 + row * 24, 56, 8);
    }
    bctx.fillStyle = '#f59e0b'; bctx.fillRect(20, 282, 216, 28);
    bctx.fillStyle = '#ffffff'; bctx.font = 'bold 15px sans-serif'; bctx.fillText('TOTAL $14.280', 42, 302);

    var billTex = new THREE.CanvasTexture(billCanvas);
    var billMat = new THREE.MeshBasicMaterial({ map: billTex, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    var billMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.88, 8, 8), billMat);
    billMesh.position.set(0, 1.8, 0.9);
    scene.add(billMesh);

    // ---------- Estado / API real ----------
    var clock = new THREE.Clock();
    var st = { eating: false, eatStart: 0, hover: false, sad: 0, blinking: false, blinkStart: 0, nextBlink: 2.5, mouthStart: -10, nextMouth: 4 };
    var mouthOpen = 0;

    var EAT_DURATION = 1.9;   // duración total de "abrir + tragar + masticar"
    var FLY_START = 0.15;     // la boca empieza a abrirse
    var FLY_END = 0.85;       // la factura termina de entrar
    var eatInvoice = opts.eatInvoice === true;   // solo el avatar de la landing "se traga" la factura

    api.chew = function () {
      if (st.eating) return;
      st.eating = true;
      st.eatStart = clock.getElapsedTime();
      if (eatInvoice) {
        billMat.opacity = 0;
        billMesh.position.set(0, 1.8, 0.9);
        billMesh.scale.set(1, 1, 1);
      }
    };
    api.setOpenMouth = function (on) { st.hover = !!on; };
    api.reject = function () { st.sad = 1.2; };

    api.destroy = function () {
      running = false;
      if (ro) { try { ro.disconnect(); } catch (e) {} }
      if (io) { try { io.disconnect(); } catch (e) {} }
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      try { renderer.dispose(); } catch (e) {}
    };

    // Interacción web (hover / click) si está habilitada
    if (opts.interactive) {
      container.style.cursor = 'pointer';
      container.addEventListener('mouseenter', function () { api.setOpenMouth(true); });
      container.addEventListener('mouseleave', function () { api.setOpenMouth(false); });
      container.addEventListener('click', function (ev) { ev.preventDefault(); api.chew(); });
      container.addEventListener('touchstart', function () { api.setOpenMouth(true); }, { passive: true });
      container.addEventListener('touchend', function () { api.setOpenMouth(false); }, { passive: true });
    }

    // Pausa cuando no está visible
    var running = true, visible = true, io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        visible = entries[0] ? entries[0].isIntersecting : true;
      }, { threshold: 0.01 });
      io.observe(container);
    }

    // Redimensionado
    var ro = null;
    function applySize() {
      var w = container.clientWidth || width;
      var h = container.clientHeight || height;
      if (w > 0 && h > 0) {
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
    if ('ResizeObserver' in window) { ro = new ResizeObserver(applySize); ro.observe(container); }
    else { window.addEventListener('resize', applySize); }

    function animate() {
      if (!running) return;
      requestAnimationFrame(animate);
      if (!visible) return;

      var t = clock.getElapsedTime();
      var idleT = reducedMotion ? 0 : t;

      // Movimiento autónomo y contemplativo (sin seguir el mouse)
      var floatY = reducedMotion ? 0 : (Math.sin(idleT * 1.8) * 0.08 + Math.cos(idleT * 0.9) * 0.02);
      var breathScale = reducedMotion ? 1 : (1.0 + Math.sin(idleT * 2.2) * 0.02);
      var autoRotY = reducedMotion ? 0 : (Math.sin(idleT * 0.85) * 0.16 + Math.cos(idleT * 0.4) * 0.08);
      var autoRotX = reducedMotion ? 0 : (Math.sin(idleT * 1.1) * 0.06);
      var autoTiltZ = reducedMotion ? 0 : (Math.sin(idleT * 1.3) * 0.04);

      leafMesh.rotation.z = reducedMotion ? 0.35 : (0.35 + Math.sin(idleT * 2.8) * 0.09);

      // Parpadeo natural
      if (!reducedMotion && !st.eating && st.sad <= 0) {
        if (!st.blinking && t > st.nextBlink) { st.blinking = true; st.blinkStart = t; }
        if (st.blinking) {
          var bp = (t - st.blinkStart) / 0.18;
          if (bp >= 1.0) {
            st.blinking = false;
            leftEye.scale.y = 1.25; rightEye.scale.y = 1.25;
            st.nextBlink = t + 3.0 + Math.random() * 3.5;
          } else {
            var bs = Math.sin(bp * Math.PI);
            var cy = THREE.MathUtils.lerp(1.25, 0.08, bs);
            leftEye.scale.y = cy; rightEye.scale.y = cy;
          }
        }
      }

      if (st.sad > 0) { st.sad -= 0.016; if (st.sad < 0) st.sad = 0; }

      // Brillo según hover / alimentación
      var targetEmissive = (st.hover || st.eating) ? 0.8 : 0.45;
      bodyMat.emissiveIntensity += (targetEmissive - bodyMat.emissiveIntensity) * 0.12;

      // ---------- Objetivo de apertura de boca ----------
      var et = st.eating ? (t - st.eatStart) : 0;
      var mouthTarget = 0;
      if (st.eating) {
        if (et < FLY_START) mouthTarget = 0.75;                               // abre
        else if (et < FLY_END) mouthTarget = 1.0;                             // boca bien abierta
        else mouthTarget = 0.35 + Math.abs(Math.sin((et - FLY_END) * 12)) * 0.6; // mastica
      } else if (st.hover) {
        mouthTarget = 0.6;                                                    // anticipa
      }
      // Boca idle cada tanto (curiosidad): se abre y se cierra sola
      if (!reducedMotion && !st.eating && st.sad <= 0 && !st.hover && t > st.nextMouth) {
        st.mouthStart = t;
        st.nextMouth = t + 5 + Math.random() * 6;
      }
      if (!st.eating && t - st.mouthStart < 0.8) {
        mouthTarget = Math.max(mouthTarget, Math.sin(((t - st.mouthStart) / 0.8) * Math.PI) * 0.7);
      }
      mouthOpen += (mouthTarget - mouthOpen) * (reducedMotion ? 0.6 : 0.3);
      if (mouthOpen < 0.002) mouthOpen = 0;

      // Aplicar boca
      var mo = mouthOpen;
      cavityMesh.visible = mo > 0.03;
      cavityMesh.scale.set(0.16 + mo * 1.75, 0.12 + mo * 2.35, 0.5 + mo * 0.5);
      smileMesh.visible = mo < 0.42;
      smileMesh.scale.set(1, Math.max(0.05, 1 - mo * 1.6), 1);
      tongueMesh.visible = mo > 0.12;
      tongueMesh.scale.set(0.02 + mo * 0.85, 0.02 + mo * 0.9, 0.02 + mo * 0.6);
      mouthLight.intensity = mo * 1.8;

      // ---------- Movimiento del cuerpo ----------
      if (st.eating) {
        var crunch = 0, bodyY = floatY, rz = 0;
        if (et < FLY_START) {
          rz = -0.06 * (et / Math.max(0.001, FLY_START));      // se echa un poco hacia atrás
          bodyY = floatY + 0.04;
        } else if (et < FLY_END) {
          rz = Math.sin(et * 10) * 0.03;
          bodyY = floatY + Math.sin(et * 12) * 0.03;
        } else {
          var cp = (et - FLY_END) * 12;
          crunch = Math.abs(Math.sin(cp));
          rz = Math.sin(cp) * 0.13;
          bodyY = floatY + Math.sin(cp * 0.5) * 0.18;
        }
        manguitoGroup.position.y = bodyY;
        manguitoGroup.scale.set(1.0 + crunch * 0.16, 1.0 - crunch * 0.15, 1.0 + crunch * 0.16);
        manguitoGroup.rotation.z = rz;
        manguitoGroup.rotation.x = 0;
        manguitoGroup.rotation.y = 0;
        if (et > EAT_DURATION) {
          st.eating = false;
          manguitoGroup.scale.set(1, 1, 1);
          manguitoGroup.rotation.z = 0;
        }
      } else if (st.sad > 0) {
        manguitoGroup.position.y = floatY;
        manguitoGroup.scale.set(breathScale, breathScale, breathScale);
        manguitoGroup.rotation.z = Math.sin(t * 34) * 0.10 * Math.min(1, st.sad * 2);
        leftEye.scale.y = 0.35; rightEye.scale.y = 0.35;
      } else {
        var hs = st.hover ? 1.06 : 1.0;
        manguitoGroup.position.y = floatY;
        manguitoGroup.scale.set(breathScale * hs, breathScale * hs, breathScale * hs);
        manguitoGroup.rotation.y = autoRotY;
        manguitoGroup.rotation.x = autoRotX;
        manguitoGroup.rotation.z = autoTiltZ;
        if (!reducedMotion && !st.blinking) { leftEye.scale.y = 1.25; rightEye.scale.y = 1.25; }
      }

      // ---------- Factura voladora (solo si el avatar "come" facturas) ----------
      if (eatInvoice && st.eating && et < FLY_START) {
        billMat.opacity = 1;
        billMesh.position.set(0, 1.8, 0.9);
        billMesh.rotation.set(-0.3, 0.2, 0.1);
        billMesh.scale.set(1, 1, 1);
      } else if (eatInvoice && st.eating && et < FLY_END) {
        var p = (et - FLY_START) / (FLY_END - FLY_START);
        billMat.opacity = 1;
        billMesh.position.y = THREE.MathUtils.lerp(1.8, -0.14, p);
        billMesh.position.x = Math.sin(p * Math.PI) * 0.08;
        billMesh.position.z = THREE.MathUtils.lerp(0.9, 0.98, p);
        billMesh.rotation.x = -0.3 + p * 3.6;
        billMesh.rotation.y = 0.2 + p * 4.0;
        billMesh.rotation.z = Math.sin(p * 8) * 0.4;
        var s = Math.max(0.06, 1 - p * 0.9);
        billMesh.scale.set(s, s, s);
      } else if (billMat.opacity > 0) {
        billMat.opacity = Math.max(0, billMat.opacity - 0.12);
      }

      // Reacción de la sombra/aura
      shadowMesh.scale.set(1 - floatY * 0.8, 1 - floatY * 0.8, 1);
      shadowMat.opacity = 0.52 - floatY * 0.3;

      renderer.render(scene, camera);
    }
    animate();

    // Aplicar estado pendiente (por si llamaron chew() antes de construirse)
    if (pending.open) api.setOpenMouth(true);
    if (pending.sad > 0) api.reject();
    if (pending.chew) api.chew();
    api.__built = true;
  }

  // ---------- Montaje automático ----------
  function init() {
    var drop = document.getElementById('manguito-drop-avatar');
    if (drop && !drop.__mgAvatar) {
      primary = createAvatar(drop, { pointerEvents: 'none', interactive: false, size: 120, eatInvoice: true });
      drop.__mgAvatar = primary;
      instances.push(primary);
    }
    var nodes = document.querySelectorAll('[data-manguito-avatar]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.__mgAvatar) return;
      var size = parseInt(el.getAttribute('data-manguito-avatar'), 10) || 40;
      var inst = createAvatar(el, {
        pointerEvents: 'auto',
        interactive: el.getAttribute('data-manguito-interactive') !== 'false',
        size: size
      });
      el.__mgAvatar = inst;
      instances.push(inst);
      if (!primary) primary = inst;
    });
  }

  window.ManguitoAvatar = {
    __ready: true,
    instances: instances,
    mount: function (el, opts) {
      var inst = createAvatar(el, opts || {});
      if (inst) { instances.push(inst); if (!primary) primary = inst; }
      return inst;
    },
    chew: function () { if (primary) primary.chew(); },
    setOpenMouth: function (on) { if (primary) primary.setOpenMouth(on); },
    reject: function () { if (primary) primary.reject(); },
    refresh: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
