// 그래비티풍 지구 배경 렌더러 (의존성 없는 raw WebGL).
// 풀스크린 삼각형 하나에 프래그먼트 셰이더로 구를 레이트레이싱하고
// NASA Blue Marble 등장방형(equirectangular) 텍스처를 입힌다.
// uLat/uLon(줍스의 지상 직하점)에 맞춰 구를 회전시켜
// 궤도 비행에 따라 지구가 아래에서 회전하는 효과를 낸다.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uLat;   // 직하점 위도 (rad)
uniform float uLon;   // 직하점 경도 (rad)
uniform float uHasTex;
uniform sampler2D uDay;
uniform sampler2D uClouds;

const float PI = 3.14159265;
// 카메라(원점)에서 본 구의 중심과 반지름 — 화면 하단 1/3에 수평선이 걸리는 저궤도 뷰
const vec3 SPH_C = vec3(0.0, -3.05, -2.35);
const float SPH_R = 2.9;
// 직하점이 원시 좌표계에서 갖는 위도 = atan(3.05, 2.35)
const float BASE_LAT = 0.9143;

float hash13(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

vec3 rotX(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
}

vec3 stars(vec3 rd) {
  vec3 col = vec3(0.0);
  // 별 두 층
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 260.0 : 520.0;
    vec3 id = floor(rd * scale);
    float h = hash13(id);
    float thr = layer == 0 ? 0.9965 : 0.9985;
    if (h > thr) {
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
      float b = (h - thr) / (1.0 - thr);
      col += vec3(0.9, 0.95, 1.0) * b * tw * (layer == 0 ? 0.9 : 0.5);
    }
  }
  // 몽환적인 성운 기운
  float n1 = pow(max(0.0, 1.0 - abs(dot(rd, normalize(vec3(0.7, 0.3, -0.5))))), 3.0);
  float n2 = pow(max(0.0, 1.0 - abs(dot(rd, normalize(vec3(-0.5, 0.6, -0.4))))), 4.0);
  col += vec3(0.10, 0.05, 0.16) * n1 * 0.5;
  col += vec3(0.03, 0.10, 0.14) * n2 * 0.45;
  col += vec3(0.012, 0.016, 0.032) * (0.6 + 0.4 * rd.y);
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  // 살짝 기울어진 수평선 (영화적 롤)
  float roll = 0.10;
  uv = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;
  vec3 rd = normalize(vec3(uv, -1.4));

  vec3 sun = normalize(vec3(0.55, 0.38, 0.45));

  // 레이–구 교차 (ro = 0)
  float b = dot(rd, SPH_C);
  float disc = b * b - (dot(SPH_C, SPH_C) - SPH_R * SPH_R);

  // 구 실루엣까지의 최근접 거리 → 대기 글로우
  float dmin = length(SPH_C - max(b, 0.0) * rd);
  float rim = max(dmin - SPH_R, 0.0);

  vec3 col;
  if (disc > 0.0 && b > 0.0) {
    float t = b - sqrt(disc);
    vec3 p = rd * t;
    vec3 n = normalize(p - SPH_C);

    // 구를 회전시켜 직하점이 (uLat, uLon)이 되게 한다
    vec3 n1 = rotX(n, BASE_LAT - uLat);
    float lat = asin(clamp(n1.y, -1.0, 1.0));
    float lon = atan(n1.x, n1.z) + uLon;
    vec2 tuv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);

    vec3 day = uHasTex > 0.5
      ? texture2D(uDay, tuv).rgb
      : vec3(0.02, 0.07, 0.16);
    float cloud = uHasTex > 0.5
      ? texture2D(uClouds, tuv + vec2(uTime * 0.00006, 0.0)).r
      : 0.0;

    float diff = clamp(dot(n, sun), 0.0, 1.0);
    float dusk = smoothstep(0.0, 0.35, diff);

    vec3 surface = mix(day, vec3(0.95, 0.97, 1.0), cloud * 0.85);

    // 바다 반짝임 (구름 없는 곳)
    float oceanMask = smoothstep(0.04, 0.18, day.b - day.r);
    vec3 h = normalize(sun - rd);
    float spec = pow(max(dot(n, h), 0.0), 70.0) * oceanMask * (1.0 - cloud);

    col = surface * (diff * 1.25 + 0.03);
    col += vec3(0.9, 0.95, 1.0) * spec * dusk * 0.55;
    // 밤면의 신비로운 청록 잔광
    col += vec3(0.012, 0.045, 0.075) * (1.0 - dusk);

    // 지구 가장자리 대기 프레넬
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.8);
    col += vec3(0.25, 0.5, 1.0) * fres * (0.25 + 0.75 * dusk) * 0.85;

    // 수평선 부근에서 별이 비치지 않도록 그대로 종료
  } else {
    col = stars(rd);
  }

  // 대기 글로우 (수평선 바깥 파란 띠 + 얇은 에어글로우 라인)
  float sunSide = 0.45 + 0.55 * clamp(dot(rd, sun) * 0.5 + 0.5, 0.0, 1.0);
  col += vec3(0.22, 0.45, 0.95) * exp(-rim * 7.0) * 0.55 * sunSide;
  col += vec3(0.35, 0.9, 0.9) * exp(-rim * 60.0) * 0.35;

  // 밴딩 방지 디더
  col += (hash13(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class EarthRenderer {
  private gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private texDay: WebGLTexture | null = null;
  private texClouds: WebGLTexture | null = null;
  private hasTex = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl =
      canvas.getContext("webgl", { antialias: false, alpha: false }) ||
      (canvas.getContext("experimental-webgl", {
        antialias: false,
        alpha: false,
      }) as WebGLRenderingContext | null);
    if (this.gl) this.setup(this.gl);
  }

  get ok(): boolean {
    return this.gl !== null && this.program !== null;
  }

  private setup(gl: WebGLRenderingContext): void {
    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("[joops] shader error:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[joops] link error:", gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;
    gl.useProgram(prog);

    // 풀스크린 삼각형
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of ["uRes", "uTime", "uLat", "uLon", "uHasTex", "uDay", "uClouds"]) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform1i(this.uniforms.uDay, 0);
    gl.uniform1i(this.uniforms.uClouds, 1);
  }

  /** 텍스처 이미지 로드 (public/feature-3/*.jpg) */
  loadTextures(dayUrl: string, cloudUrl: string): void {
    const gl = this.gl;
    if (!gl) return;
    let day: HTMLImageElement | null = null;
    let clouds: HTMLImageElement | null = null;

    const tryBind = () => {
      if (!day || !clouds || !this.gl) return;
      this.texDay = this.makeTexture(day);
      this.texClouds = this.makeTexture(clouds);
      this.hasTex = this.texDay !== null && this.texClouds !== null;
    };

    const load = (url: string, cb: (img: HTMLImageElement) => void) => {
      const img = new Image();
      img.onload = () => {
        cb(img);
        tryBind();
      };
      img.onerror = () => {
        console.warn("[joops] 텍스처 로드 실패:", url);
      };
      img.src = url;
    };
    load(dayUrl, (img) => (day = img));
    load(cloudUrl, (img) => (clouds = img));
  }

  private makeTexture(img: HTMLImageElement): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) return null;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    // 2048x1024 (2의 거듭제곱)이므로 밉맵 + 경도 방향 REPEAT 가능
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  resize(cssW: number, cssH: number): void {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  /** 매 프레임 호출. latDeg/lonDeg = 줍스 직하점 */
  render(timeSec: number, latDeg: number, lonDeg: number): void {
    const gl = this.gl;
    if (!gl || !this.program || gl.isContextLost()) return;
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.uTime, timeSec);
    gl.uniform1f(this.uniforms.uLat, (latDeg * Math.PI) / 180);
    gl.uniform1f(this.uniforms.uLon, (lonDeg * Math.PI) / 180);
    gl.uniform1f(this.uniforms.uHasTex, this.hasTex ? 1 : 0);
    if (this.hasTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texDay);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texClouds);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.texDay) gl.deleteTexture(this.texDay);
    if (this.texClouds) gl.deleteTexture(this.texClouds);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
  }
}
