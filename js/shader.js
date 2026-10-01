// フラグメントシェーダー（GLSL ES 1.0）
window.WARP_FRAG = `precision highp float;
uniform vec2  uRes, uOffset;
uniform float uTime, uScale, uWarp, uTwist, uFold, uOct, uStretch, uAngle, uContrast, uDot, uGrain, uHue, uSeed, uMode;
uniform vec3  uInk, uPaper;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2  grad(vec2 i){ float a = hash(i) * 6.2831853; return vec2(cos(a), sin(a)); }

// 勾配ノイズ（パーリン系）
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(dot(grad(i), f),                     dot(grad(i+vec2(1,0)), f-vec2(1,0)), u.x),
             mix(dot(grad(i+vec2(0,1)), f-vec2(0,1)), dot(grad(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
}
// fBm：オクターブを重ねたノイズ（uOctで細かさを調整）
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for(int i = 0; i < 6; i++){ if(float(i) >= uOct) break; v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
// ドメインワーピング：ノイズで座標をずらす処理を3段重ねる
float pattern(vec2 p, float t){
  vec2 q = vec2(fbm(p + t*0.10), fbm(p + vec2(5.2, 1.3) - t*0.08));
  vec2 r = vec2(fbm(p + uWarp*q + vec2(1.7, 9.2) + t*0.12),
                fbm(p + uWarp*q + vec2(8.3, 2.8) - t*0.10));
  vec2 s = p + uWarp*r;
  vec2 w = vec2(fbm(s*1.4 + vec2(3.1, 7.4) + t*0.07), fbm(s*1.4 + vec2(6.6, 2.2) - t*0.07));
  s += uTwist * w;
  return fbm(s);
}
vec3 rainbow(float t){ return 0.5 + 0.5*cos(6.2831853*(t + vec3(0.0, 0.33, 0.67))); }

// 網点：levelが大きいほど大きな点
float dotScreen(vec2 fc, float level, float ang, float size){
  float s = sin(ang), c = cos(ang);
  vec2 r = mat2(c, -s, s, c) * fc;
  float d = length(fract(r / size) - 0.5);
  float rad = sqrt(clamp(level, 0.0, 1.0)) * 0.72;
  float aa = 1.2 / size;
  return 1.0 - smoothstep(rad - aa, rad + aa, d);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = (fc - 0.5*uRes) / uRes.y + uOffset;      // uOffset：ドラッグで模様を動かす

  float ca = cos(uAngle), sa = sin(uAngle);
  vec2 p = mat2(ca, -sa, sa, ca) * uv * uScale;
  p.x *= uStretch;                                    // 一方向に引き伸ばす
  p += vec2(uSeed*13.1, uSeed*7.7);

  float f = pattern(p, uTime);
  // 折り返し：値をsinで折り返すと、等高線に沿った縞が何本も出る
  float v = mix(0.5 + f * 1.1, 0.5 + 0.5 * sin(f * 6.2831853 * uFold), step(0.01, uFold));
  v = (v - 0.5) * uContrast + 0.5;
  float n = hash(fc + fract(uTime*7.0)*91.0) - 0.5;
  v = clamp(v + n * uGrain * 1.4, 0.0, 1.0);          // ディザ：境界に粒が散ってスプレー状になる

  vec3 col;
  if(uMode < 0.5){
    // Holo：暗部=紫黒、明部=白、その境界の帯に虹色
    vec3 dark  = mix(vec3(0.07,0.05,0.12), vec3(0.32,0.26,0.62), smoothstep(0.1,0.45,v));
    vec3 base  = mix(dark, vec3(0.97,0.96,0.98), smoothstep(0.5,0.78,v));
    float band = exp(-pow((v - 0.55) / 0.13, 2.0));
    vec3 irid  = rainbow(v * 2.4 + uHue) * 0.9 + 0.15;
    col = mix(base, irid, band * 0.85);
  } else {
    // Mono：2色（uInk → uPaper）
    col = mix(uInk, uPaper, smoothstep(0.35, 0.65, v));
    float speck = step(0.9975, hash(floor(fc / 1.5) + uSeed));
    col = mix(col, uPaper + 0.05, speck * 0.6);
  }

  if(uDot > 0.5){
    vec3 ink = vec3(1.0) - col;  // CMYの3版を角度違いで重ねる
    vec3 cov = vec3(dotScreen(fc, ink.r, 0.26, uDot),
                    dotScreen(fc, ink.g, 1.31, uDot),
                    dotScreen(fc, ink.b, 0.79, uDot));
    col = mix(col, vec3(1.0) - cov, 0.85);
  }

  col += n * uGrain * 0.25;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
