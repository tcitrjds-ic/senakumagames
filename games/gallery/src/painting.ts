import * as THREE from 'three';
import type { Slot } from './castle';
import type { Painting } from './manifest';

/** マリオ64の「絵が水面のように波打つ」シェーダ。近づくとゆらゆら、触れると波紋 */
const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform sampler2D map;
uniform float uTime;
uniform float uT0;
uniform vec2 uCenter;
uniform float uAmp;
uniform float uNear;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  vec2 d = uv - uCenter;
  float r = length(d);
  float t = uTime - uT0;
  float decay = uAmp * max(0.0, 1.0 - t * 0.45);
  float wave = sin(r * 42.0 - t * 9.0) * decay * exp(-r * 2.2);
  vec2 idle = vec2(sin(uv.y * 18.0 + uTime * 2.5), sin(uv.x * 16.0 - uTime * 2.0)) * 0.006 * uNear;
  float edge = smoothstep(0.0, 0.08, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec2 dir = r > 0.0001 ? d / r : vec2(0.0);
  uv = clamp(uv + (dir * wave + idle) * edge, 0.0, 1.0);
  vec4 c = texture2D(map, uv);
  c.rgb += 0.05 * uNear * (0.5 + 0.5 * sin(uTime * 4.0));
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

const GOLD = 0xd9a93a;
const goldMat = new THREE.MeshPhongMaterial({ color: GOLD, specular: 0xfff0b0, shininess: 80 });
const goldDark = new THREE.MeshPhongMaterial({ color: 0x8a6420, specular: 0xffe0a0, shininess: 40 });
const boardMat = new THREE.MeshLambertMaterial({ color: 0x1a120a });

export class HungPainting {
  readonly group = new THREE.Group();
  readonly canvas: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly width: number;
  readonly height: number;
  near = 0;

  constructor(
    readonly slot: Slot,
    readonly painting: Painting,
    readonly texture: THREE.Texture,
    readonly hasImage: boolean,
  ) {
    const img = texture.image as { width: number; height: number };
    const s = Math.min(slot.maxW / img.width, slot.maxH / img.height);
    this.width = img.width * s;
    this.height = img.height * s;
    const w = this.width;
    const h = this.height;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        uTime: { value: 0 },
        uT0: { value: -100 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uAmp: { value: 0 },
        uNear: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.material);
    this.canvas.position.z = 0.03;
    this.canvas.userData.hung = this;
    this.group.add(this.canvas);

    // 裏板と金の額縁（4本の桟＋内側の暗い見切り）
    const bw = 0.16; // 縁の太さ
    const bd = 0.12; // 縁の奥行き
    const board = new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, h + bw * 2, 0.05), boardMat);
    board.position.z = -0.02;
    this.group.add(board);
    const bar = (bx: number, by: number, bz: number, sx: number, sy: number, sz: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      mesh.position.set(bx, by, bz);
      this.group.add(mesh);
    };
    bar(0, h / 2 + bw / 2, bd / 2, w + bw * 2, bw, bd, goldMat);
    bar(0, -h / 2 - bw / 2, bd / 2, w + bw * 2, bw, bd, goldMat);
    bar(-w / 2 - bw / 2, 0, bd / 2, bw, h, bd, goldMat);
    bar(w / 2 + bw / 2, 0, bd / 2, bw, h, bd, goldMat);
    // 内側の見切り（細い暗金）
    const inner = 0.04;
    bar(0, h / 2 - inner / 2, 0.04, w, inner, 0.03, goldDark);
    bar(0, -h / 2 + inner / 2, 0.04, w, inner, 0.03, goldDark);
    bar(-w / 2 + inner / 2, 0, 0.04, inner, h, 0.03, goldDark);
    bar(w / 2 - inner / 2, 0, 0.04, inner, h, 0.03, goldDark);
    // 四隅の飾り
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bar(sx * (w / 2 + bw / 2), sy * (h / 2 + bw / 2), bd / 2 + 0.03, bw * 1.5, bw * 1.5, 0.06, goldDark);
    // 番号プレート
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: plateTexture(painting.no), transparent: true }));
    plate.position.set(0, -h / 2 - bw - 0.22, 0.02);
    this.group.add(plate);

    this.group.position.copy(slot.pos);
    this.group.lookAt(slot.pos.clone().add(slot.normal));
  }

  update(time: number, playerPos: THREE.Vector3): number {
    const dist = playerPos.distanceTo(this.slot.pos);
    this.near = THREE.MathUtils.clamp(1 - (dist - 1.6) / 2.6, 0, 1);
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uNear.value = this.near;
    return dist;
  }

  /** 触れた場所（UV）から波紋を広げる */
  burst(u: number, v: number, amp = 0.05, time: number): void {
    const un = this.material.uniforms;
    un.uCenter.value.set(u, v);
    un.uAmp.value = amp;
    un.uT0.value = time;
  }
}

/** 番号プレート「No.n」の CanvasTexture */
function plateTexture(no: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 280;
  c.height = 104;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9a7230';
  roundRect(g, 0, 0, 280, 104, 18);
  g.fill();
  g.fillStyle = '#e8c56a';
  roundRect(g, 8, 8, 264, 88, 14);
  g.fill();
  g.fillStyle = '#5a3a10';
  g.font = '800 54px "M PLUS Rounded 1c", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`No.${no}`, 140, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 絵が未登録のときのキャンバス（麻布に「じゅんびちゅう」）*/
export function placeholderTexture(no: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 480;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ece2cc';
  g.fillRect(0, 0, 640, 480);
  g.strokeStyle = 'rgba(200,184,150,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 640; i += 6) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 480);
    g.stroke();
  }
  for (let i = 0; i < 480; i += 6) {
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(640, i);
    g.stroke();
  }
  g.fillStyle = '#a08a6a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 72px "M PLUS Rounded 1c", sans-serif';
  g.fillText(`No.${no}`, 320, 200);
  g.font = '700 48px "M PLUS Rounded 1c", sans-serif';
  g.fillText('じゅんびちゅう', 320, 290);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
