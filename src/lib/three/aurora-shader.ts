/**
 * GLSL source for the hero/aside background: a slow-moving, domain-warped
 * noise field mixed across the brand's blue palette, replacing the flat
 * `navy-gradient-subtle` + drifting radial-gradient blobs previously used
 * behind `AnimatedGrid`.
 *
 * The noise function (`snoise`, 3D simplex) is Ian McEwan / Ashima Arts'
 * widely-used, MIT-licensed implementation — see
 * https://github.com/ashima/webgl-noise — reproduced verbatim rather than
 * written from scratch, since it's effectively the industry-standard
 * reference implementation and this project has no way to visually
 * preview a shader before shipping it.
 *
 * Two fragment shader variants are exported rather than one shader with a
 * runtime quality branch: `Low` has fewer octaves and no domain warp,
 * which — unlike a uniform-guarded `if` — actually compiles to a shorter
 * program, so low-tier devices pay less per pixel rather than merely
 * skipping some math at runtime.
 */

export const auroraVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const noiseFunctions = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

const sharedUniforms = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorDeep;
  uniform vec3 uColorBase;
  uniform vec3 uColorAccent;
  uniform vec3 uColorHighlight;
  uniform float uIntensity;
  uniform float uAspect;
`;

export const auroraFragmentShaderHigh = /* glsl */ `
  ${sharedUniforms}
  ${noiseFunctions}

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 3; i++) {
      sum += snoise(p) * amp;
      p *= 1.9;
      amp *= 0.55;
    }
    return sum;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = (uv - 0.5) * vec2(uAspect, 1.0);

    vec3 warpInput = vec3(uv * 1.8, uTime * 0.035);
    float warpX = fbm(warpInput + 4.0);
    float warpY = fbm(warpInput + 9.0);
    vec2 warped = uv + vec2(warpX, warpY) * 0.16;

    float n = fbm(vec3(warped * 2.1, uTime * 0.05));
    n = n * 0.5 + 0.5;

    vec3 color = mix(uColorDeep, uColorBase, smoothstep(0.15, 0.55, n));
    color = mix(color, uColorAccent, smoothstep(0.5, 0.85, n));
    color = mix(color, uColorHighlight, smoothstep(0.86, 1.05, n) * 0.55);

    float vignette = smoothstep(1.0, 0.1, length(centered) * 1.15);
    color *= mix(0.42, 1.0, vignette);
    color += uColorAccent * 0.02 * (1.0 - vignette);

    gl_FragColor = vec4(color * uIntensity, 1.0);
  }
`;

export const auroraFragmentShaderLow = /* glsl */ `
  ${sharedUniforms}
  ${noiseFunctions}

  void main() {
    vec2 uv = vUv;
    vec2 centered = (uv - 0.5) * vec2(uAspect, 1.0);

    float n = snoise(vec3(uv * 1.4, uTime * 0.04));
    n = n * 0.5 + 0.5;

    vec3 color = mix(uColorDeep, uColorBase, smoothstep(0.2, 0.6, n));
    color = mix(color, uColorAccent, smoothstep(0.55, 0.9, n) * 0.7);

    float vignette = smoothstep(1.0, 0.15, length(centered) * 1.1);
    color *= mix(0.48, 1.0, vignette);

    gl_FragColor = vec4(color * uIntensity, 1.0);
  }
`;
