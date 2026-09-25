// ==============================================================================
// HOMBRE OBSIDIAN CANYON FLIGHT — Ultra-Smooth 60FPS Low-Overhead Background
// Endless 3D perspective digital canyon flight in pitch black & liquid silver/cyan
// Zero-Lag Lightweight Canvas Engine (Butter-smooth 60+ FPS on all devices)
// ==============================================================================

(function () {
  'use strict';

  const canvas = document.getElementById('canyon-canvas') || 
                 document.getElementById('ravine-canvas') || 
                 document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0;
  let height = 0;
  let animId = null;

  // Flight simulation state
  let time = 0;
  let lastFrameTime = performance.now();
  const speed = 0.045; // Flight forward velocity
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  // Mouse steering & smooth parallax
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5);
    mouse.targetY = (e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  // Handle high-performance resize
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Floating ambient cyber dust particles
  const starsCount = 50;
  const stars = [];
  for (let i = 0; i < starsCount; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 2200,
      y: -Math.random() * 550 - 30,
      z: Math.random() * 1200 + 80,
      size: Math.random() * 1.4 + 0.6,
      alpha: Math.random() * 0.6 + 0.2
    });
  }

  // Canyon Terrain Elevation Function
  // Center is a deep carved canyon floor; left & right rise into rugged obsidian cliffs
  function getCanyonHeight(x, z, t) {
    const canyonCenter = Math.sin(z * 0.0025 + t * 0.4) * 160 + Math.sin(z * 0.0008) * 90;
    const distFromCenter = Math.abs(x - canyonCenter);

    // Canyon floor width
    const canyonFloorWidth = 240;
    let elevation = 0;

    if (distFromCenter > canyonFloorWidth) {
      const wallDist = distFromCenter - canyonFloorWidth;
      // Ridge peaks rising steeply on canyon walls
      elevation = Math.pow(wallDist * 0.05, 1.45) * 11.5;

      // Layered mountain ridge harmonics
      elevation += Math.sin(x * 0.012 + z * 0.007) * 32;
      elevation += Math.cos(x * 0.03 - z * 0.01) * 16;
      elevation += Math.sin(x * 0.07 + z * 0.018) * 7;
    } else {
      // Gentle textured canyon floor
      elevation = Math.sin(z * 0.025 + t) * 5 + Math.cos(x * 0.02) * 3;
    }

    return elevation;
  }

  // Grid Configuration for 3D Perspective Flight
  const gridRows = 36;      // Slices into the horizon
  const gridCols = 40;      // Span across canyon
  const gridSpacingZ = 36;  // Depth step
  const gridSpanX = 3000;   // Canyon width
  const fov = 350;          // Perspective focal length
  const cameraY = -130;     // Flight altitude above canyon floor

  function render(now) {
    const delta = Math.min((now - lastFrameTime) / 16.67, 2.0);
    lastFrameTime = now;
    time += delta;

    // Smooth mouse lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.05 * delta;
    mouse.y += (mouse.targetY - mouse.y) * 0.05 * delta;

    // 1. Pure Pitch Black Background
    ctx.fillStyle = '#010204';
    ctx.fillRect(0, 0, width, height);

    const horizonY = height * 0.45 + mouse.y * 40;
    const centerX = width * 0.5 - mouse.x * 80;

    // 2. Horizon Glow (Deep obsidian with subtle cyan/silver radiance)
    const horizonGrad = ctx.createLinearGradient(0, horizonY - 140, 0, horizonY + 70);
    horizonGrad.addColorStop(0, 'rgba(1, 2, 4, 0)');
    horizonGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.045)');
    horizonGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.02)');
    horizonGrad.addColorStop(1, 'rgba(1, 2, 4, 0)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, horizonY - 140, width, 210);

    // 3. Floating cyber stars / dust in deep night sky
    for (let i = 0; i < starsCount; i++) {
      const s = stars[i];
      s.z -= 1.8 * delta;
      if (s.z <= 20) s.z = 1200;

      const scale = fov / s.z;
      const px = centerX + s.x * scale;
      const py = horizonY + s.y * scale;

      if (px > 0 && px < width && py > 0 && py < horizonY) {
        const starAlpha = s.alpha * (1 - s.z / 1200);
        ctx.fillStyle = `rgba(226, 232, 240, ${starAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, s.size * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Continuous flight depth offset
    const zOffset = (time * speed * gridSpacingZ) % gridSpacingZ;
    const colStep = gridSpanX / (gridCols - 1);
    const startX = -gridSpanX * 0.5;

    // 4. Precalculate projected 3D terrain grid points
    const points = [];
    for (let r = 0; r < gridRows; r++) {
      points[r] = [];
      const worldZ = r * gridSpacingZ + (gridSpacingZ - zOffset) + 30;
      const depthFactor = fov / worldZ;

      // Distance fading (monochrome fog: close = crisp silver, horizon = fade to black)
      const distAlpha = Math.max(0, Math.min(1, 1.0 - (r / gridRows) * 1.04));
      const rowAlpha = Math.pow(distAlpha, 1.35);

      for (let c = 0; c < gridCols; c++) {
        const worldX = startX + c * colStep;
        const elev = getCanyonHeight(worldX, worldZ + time * speed * 25, time * 0.02);
        const worldY = cameraY + elev;

        const screenX = centerX + worldX * depthFactor;
        const screenY = horizonY - worldY * depthFactor;

        points[r][c] = {
          x: screenX,
          y: screenY,
          alpha: rowAlpha,
          worldX: worldX,
          elevation: elev
        };
      }
    }

    // 5. Draw Longitudinal Flight Lines (streaming down the canyon towards the horizon)
    ctx.lineWidth = 1.0;
    for (let c = 0; c < gridCols; c += 2) {
      ctx.beginPath();
      let started = false;

      for (let r = 0; r < gridRows - 1; r++) {
        const p1 = points[r][c];
        const p2 = points[r + 1][c];

        if (p1.y < height + 100 && p2.y > -50) {
          if (!started) {
            ctx.moveTo(p1.x, p1.y);
            started = true;
          }
          ctx.lineTo(p2.x, p2.y);
        }
      }

      // Center canyon floor gets subtle cyan luminescence, outer ridges get crisp silver
      const distFromCenter = Math.abs(points[0][c].worldX);
      const isFloor = distFromCenter < 300;

      if (isFloor) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      } else {
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.07)';
      }
      ctx.stroke();
    }

    // 6. Draw Transverse Geological Strata Lines (cross waves across the canyon)
    for (let r = 0; r < gridRows; r++) {
      const rowPoints = points[r];
      const baseAlpha = rowPoints[0].alpha;
      if (baseAlpha <= 0.01) continue;

      ctx.beginPath();
      ctx.moveTo(rowPoints[0].x, rowPoints[0].y);

      for (let c = 1; c < gridCols; c++) {
        ctx.lineTo(rowPoints[c].x, rowPoints[c].y);
      }

      // Silver monochrome gradient stroke
      const strokeAlpha = (baseAlpha * 0.26).toFixed(3);
      ctx.lineWidth = r < 12 ? 1.5 : 1.0;
      ctx.strokeStyle = `rgba(226, 232, 240, ${strokeAlpha})`;
      ctx.stroke();
    }

    // 7. Canyon Cliff Crest Highlights (sharp glowing silver/cyan ridge tops)
    ctx.lineWidth = 1.8;
    for (let c of [7, 8, 31, 32]) {
      if (c >= gridCols) continue;
      ctx.beginPath();
      let started = false;
      for (let r = 0; r < gridRows - 6; r++) {
        const p = points[r][c];
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
      ctx.stroke();
    }

    // 8. Distant Horizon Boundary Line
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    animId = requestAnimationFrame(render);
  }

  // Kick off animation loop
  animId = requestAnimationFrame(render);

  // Auto-pause when tab is hidden to save 100% CPU/GPU resources
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    } else {
      lastFrameTime = performance.now();
      if (!animId) animId = requestAnimationFrame(render);
    }
  });

  console.log('⚡ [HOMBRE] Obsidian Canyon Flight Engine Active (60 FPS Locked, 0 Lag).');
})();
