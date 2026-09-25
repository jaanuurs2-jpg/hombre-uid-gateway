// Liquid Silver & Obsidian Dynamic Waves Animation
// High-fidelity procedural wave ribbons with luminous silver crests and floating stardust

(function() {
  const canvas = document.getElementById('waves-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let animationFrameId;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  // Listen to subtle mouse movement for organic parallax
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 40;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 30;
  });

  // Metallic Silver & Platinum Wave Layers (Bigger, more fluid, layered depth)
  const waves = [
    {
      amplitude: 110,
      frequency: 0.0014,
      speed: 0.012,
      phase: 0,
      baseHeightRatio: 0.52,
      strokeWidth: 2.2,
      strokeColor: 'rgba(255, 255, 255, 0.45)',
      glowColor: 'rgba(248, 250, 252, 0.35)',
      glowBlur: 14,
      fillTop: 'rgba(226, 232, 240, 0.07)',
      fillBottom: 'rgba(7, 9, 13, 0.0)'
    },
    {
      amplitude: 135,
      frequency: 0.0010,
      speed: 0.009,
      phase: Math.PI / 2.5,
      baseHeightRatio: 0.62,
      strokeWidth: 1.8,
      strokeColor: 'rgba(226, 232, 240, 0.35)',
      glowColor: 'rgba(203, 213, 225, 0.25)',
      glowBlur: 10,
      fillTop: 'rgba(148, 163, 184, 0.05)',
      fillBottom: 'rgba(7, 9, 13, 0.0)'
    },
    {
      amplitude: 95,
      frequency: 0.0018,
      speed: 0.015,
      phase: Math.PI * 0.8,
      baseHeightRatio: 0.42,
      strokeWidth: 1.5,
      strokeColor: 'rgba(241, 245, 249, 0.30)',
      glowColor: 'rgba(255, 255, 255, 0.2)',
      glowBlur: 8,
      fillTop: 'rgba(203, 213, 225, 0.04)',
      fillBottom: 'rgba(7, 9, 13, 0.0)'
    },
    {
      amplitude: 150,
      frequency: 0.0008,
      speed: 0.007,
      phase: Math.PI * 1.3,
      baseHeightRatio: 0.74,
      strokeWidth: 2.0,
      strokeColor: 'rgba(203, 213, 225, 0.25)',
      glowColor: 'rgba(148, 163, 184, 0.2)',
      glowBlur: 12,
      fillTop: 'rgba(100, 116, 139, 0.04)',
      fillBottom: 'rgba(7, 9, 13, 0.0)'
    },
    {
      amplitude: 80,
      frequency: 0.0022,
      speed: 0.018,
      phase: Math.PI * 1.7,
      baseHeightRatio: 0.35,
      strokeWidth: 1.2,
      strokeColor: 'rgba(255, 255, 255, 0.22)',
      glowColor: 'rgba(255, 255, 255, 0.15)',
      glowBlur: 6,
      fillTop: 'rgba(248, 250, 252, 0.03)',
      fillBottom: 'rgba(7, 9, 13, 0.0)'
    }
  ];

  // Floating Silver Ambient Particles for Depth & Attraction
  const particles = [];
  const PARTICLE_COUNT = 38;

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.6 + 0.6,
        alpha: Math.random() * 0.5 + 0.2,
        speedX: (Math.random() - 0.5) * 0.4 + 0.2,
        speedY: (Math.random() - 0.5) * 0.3,
        pulseSpeed: 0.02 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(dpr, dpr);
    initParticles();
  }

  let step = 0;

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Smooth mouse lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    step += 1;

    // 1. Draw Waves with glowing silver crests & metallic translucent fills
    waves.forEach((w, idx) => {
      ctx.save();
      ctx.beginPath();

      const baseY = height * w.baseHeightRatio + (mouse.y * (idx + 1) * 0.2);
      ctx.moveTo(0, baseY);

      // Multi-harmonic sine curve for dynamic organic ribbon motion
      const stepIncrement = 3;
      for (let x = 0; x <= width + 10; x += stepIncrement) {
        const adjustedX = x + mouse.x * (idx * 0.15 + 0.1);
        const y = baseY +
          Math.sin(adjustedX * w.frequency + step * w.speed + w.phase) * w.amplitude +
          Math.cos(adjustedX * w.frequency * 0.6 + step * w.speed * 0.8) * (w.amplitude * 0.42) +
          Math.sin(adjustedX * w.frequency * 1.8 + step * w.speed * 1.2) * (w.amplitude * 0.18);

        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();

      // Metallic Liquid Silver Gradient Fill
      const grad = ctx.createLinearGradient(0, baseY - w.amplitude, 0, height);
      grad.addColorStop(0, w.fillTop);
      grad.addColorStop(0.35, 'rgba(148, 163, 184, 0.025)');
      grad.addColorStop(1, w.fillBottom);

      ctx.fillStyle = grad;
      ctx.fill();

      // Luminous Silver Crest with Glow
      ctx.shadowColor = w.glowColor;
      ctx.shadowBlur = w.glowBlur;
      ctx.strokeStyle = w.strokeColor;
      ctx.lineWidth = w.strokeWidth;
      ctx.stroke();

      ctx.restore();
    });

    // 2. Draw Floating Silver Specular Particles
    ctx.save();
    particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.phase += p.pulseSpeed;

      // Wrap around edges seamlessly
      if (p.x > width + 10) p.x = -10;
      if (p.x < -10) p.x = width + 10;
      if (p.y > height + 10) p.y = -10;
      if (p.y < -10) p.y = height + 10;

      const dynamicAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(241, 245, 249, ${dynamicAlpha})`;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 6;
      ctx.fill();
    });
    ctx.restore();

    animationFrameId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();
