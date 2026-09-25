// ==============================================================================
// RAVINE — Ray-Marched Endless Monochrome Canyon Background
// Adapted from React Bits Pro for HOMBRE High-Performance Architecture
// "A ray-marched flight down an endless monochrome canyon, its walls shaded by how far each ray had to travel"
// ==============================================================================

(function () {
  'use strict';

  const canvas = document.getElementById('ravine-canvas');
  if (!canvas) return;

  // Initialize WebGL context with fallback
  let gl = canvas.getContext('webgl', { antialias: false, alpha: true, depth: false }) ||
           canvas.getContext('experimental-webgl', { antialias: false, alpha: true, depth: false });

  if (!gl) {
    console.warn('[RAVINE] WebGL not supported on this browser/GPU. Falling back.');
    return;
  }

  // Vertex Shader: Fullscreen Clip Quad
  const vsSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment Shader: Ray-Marched Monochrome Canyon
  const fsSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    // Fast noise and hash functions
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(in vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(0.877, 0.479, -0.479, 0.877);
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = rot * p * 2.02 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }

    // Sinuous canyon meandering path
    vec2 canyonPath(float z) {
      return vec2(
        sin(z * 0.08) * 3.2 + sin(z * 0.035) * 1.8,
        sin(z * 0.045) * 0.9
      );
    }

    // Canyon Distance Estimator
    float mapScene(vec3 p) {
      vec2 center = canyonPath(p.z);
      vec2 localP = p.xy - center;

      // Variable width gorge
      float canyonHalfWidth = 2.4 + 0.6 * sin(p.z * 0.06);
      float wallDist = canyonHalfWidth - abs(localP.x);

      // Stratified cliff geological formations
      float cliffFbm = fbm(vec2(localP.y * 0.5, p.z * 0.22));
      float strata = sin(localP.y * 7.0 + fbm(p.xz * 0.4) * 3.5) * 0.14;
      float bumps = noise(p.xz * 1.4 + localP.y * 1.8) * 0.1;

      float walls = wallDist + (cliffFbm * 0.85 + strata + bumps);

      // Rugged canyon floor
      float floorDist = localP.y + 1.8 - fbm(p.xz * 0.35) * 0.45;
      float ceilDist = 4.5 - localP.y;

      float scene = min(floorDist, ceilDist);
      scene = min(scene, walls);
      return scene;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

      // Flight time along the canyon
      float speed = 2.3;
      float time = u_time * speed;

      // Camera position following the canyon path
      vec2 camXY = canyonPath(time);
      vec3 ro = vec3(camXY, time);

      // Look-ahead target
      vec2 targetXY = canyonPath(time + 4.5);
      vec3 target = vec3(targetXY, time + 4.5);

      // Mouse parallax influence
      vec2 m = u_mouse * 0.35;
      ro.x += m.x * 0.7;
      ro.y += m.y * 0.4;

      // Camera orientation matrix
      vec3 forward = normalize(target - ro);
      vec3 worldUp = vec3(sin(time * 0.04) * 0.12 + m.x * 0.08, 1.0, 0.0);
      vec3 right = normalize(cross(forward, worldUp));
      vec3 up = cross(right, forward);

      // Ray direction with dynamic perspective
      vec3 rd = normalize(forward * 1.05 + right * uv.x + up * uv.y);

      // Ray marching loop
      float t = 0.12;
      float maxDist = 36.0;
      int steps = 0;
      float hitDist = 0.0;

      for (int i = 0; i < 88; i++) {
        vec3 p = ro + rd * t;
        float d = mapScene(p);
        steps = i;
        if (d < 0.009 || t >= maxDist) {
          hitDist = d;
          break;
        }
        t += d * 0.72;
      }

      // MONOCHROME RAY-TRAVEL SHADING
      // "its walls shaded by how far each ray had to travel"
      float travelFactor = clamp(t / maxDist, 0.0, 1.0);
      float distShading = 1.0 - travelFactor;
      distShading = pow(distShading, 1.35);

      // Ambient occlusion step decay
      float stepAO = 1.0 - (float(steps) / 88.0);
      stepAO = clamp(stepAO * 1.3, 0.0, 1.0);

      // Monochrome edge luminance
      float luminance = (distShading * 0.72 + stepAO * 0.28);
      luminance = clamp(luminance, 0.0, 1.0);

      // Soft vignette for high-end depth
      float vignette = 1.0 - length(uv) * 0.42;
      luminance *= clamp(vignette, 0.0, 1.0);

      // Monochrome palette: Deep Obsidian Void to Silver Moonlight
      vec3 darkVoid = vec3(0.015, 0.024, 0.045);
      vec3 silverMist = vec3(0.72, 0.78, 0.88);
      vec3 highlightWhite = vec3(0.96, 0.98, 1.0);

      vec3 color = mix(darkVoid, silverMist, luminance);
      color = mix(color, highlightWhite, pow(luminance, 2.8) * 0.35);

      // Atmospheric fog vanishing at the canyon horizon
      color = mix(color, darkVoid, smoothstep(maxDist * 0.78, maxDist, t));

      gl_FragColor = vec4(color, 0.88);
    }
  `;

  // Shader compiler helper
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[RAVINE] Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[RAVINE] Program link error:', gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  // Setup fullscreen quad buffer
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]),
    gl.STATIC_DRAW
  );

  const aPosition = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Uniform locations
  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uMouse = gl.getUniformLocation(program, 'u_mouse');

  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2.0;
    mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2.0;
  });

  // Smooth resize handler with DPR scaling for performance & sharpness
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // cap at 1.5 for ultra 60fps
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // Animation render loop
  let startTime = performance.now();
  let animationFrameId;

  function render(currentTime) {
    const elapsed = (currentTime - startTime) * 0.001;

    // Smooth mouse interpolation
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uMouse, mouse.x, mouse.y);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  // Visibility optimization: pause when tab is inactive to save battery & CPU
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      startTime = performance.now() - (performance.now() - startTime);
      animationFrameId = requestAnimationFrame(render);
    }
  });

  console.log('🌌 [RAVINE] React Bits Pro Ray-Marched Endless Canyon Engine Initialized.');
})();
