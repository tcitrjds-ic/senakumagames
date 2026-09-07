import Phaser from 'phaser';

/**
 * マリオ64の「絵に飛び込むと水面のように波打つ」効果を再現するポストFX。
 * WebGL のときだけ有効（Canvas 描画では何もしない）。
 */
const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uTime;
uniform vec2 uCenter;
uniform float uAmp;
uniform float uIdle;
uniform vec4 uRect; // 画像がフレームバッファ上で占める範囲 (u0, v0, u1, v1)
varying vec2 outTexCoord;
void main () {
  vec2 size = uRect.zw - uRect.xy;
  // 画像内のローカル座標 (0..1)
  vec2 l = (outTexCoord - uRect.xy) / size;
  if (l.x < 0.0 || l.x > 1.0 || l.y < 0.0 || l.y > 1.0) {
    gl_FragColor = texture2D(uMainSampler, outTexCoord);
    return;
  }
  vec2 d = l - uCenter;
  float r = length(d);
  // タップ点から広がる同心円の波（時間とともに減衰）
  float decay = max(0.0, 1.0 - uTime * 0.45);
  float wave = sin(r * 42.0 - uTime * 9.0) * uAmp * decay * exp(-r * 2.2);
  // 近づいたときの、ゆらゆらした常時の揺れ
  vec2 idle = vec2(sin(l.y * 26.0 + uTime * 3.0) * 0.004, sin(l.x * 22.0 - uTime * 2.3) * 0.003) * uIdle;
  vec2 dir = r > 0.0001 ? d / r : vec2(0.0);
  // 端では揺れを弱めて、絵の外（黒）を拾わないようにする
  float edge = smoothstep(0.0, 0.08, min(min(l.x, 1.0 - l.x), min(l.y, 1.0 - l.y)));
  vec2 ld = clamp(l + (dir * wave + idle) * edge, vec2(0.0), vec2(1.0));
  gl_FragColor = texture2D(uMainSampler, uRect.xy + ld * size);
}
`;

export class RipplePostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  time = 0;
  cx = 0.5;
  cy = 0.5;
  amp = 0;
  idle = 0;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: FRAG });
  }

  onPreRender(): void {
    // 付いている画像の画面上の範囲を 0..1 で渡す（ポストFXはフルフレームに描かれるため）
    const go = this.gameObject as Phaser.GameObjects.Image | undefined;
    if (go && typeof go.getBounds === 'function') {
      const b = go.getBounds();
      const w = this.renderer.width;
      const h = this.renderer.height;
      // フレームバッファは上下反転（v=0 が画面下）
      this.set4f('uRect', b.left / w, 1 - b.bottom / h, b.right / w, 1 - b.top / h);
    } else {
      this.set4f('uRect', 0, 0, 1, 1);
    }
    this.set1f('uTime', this.time);
    this.set2f('uCenter', this.cx, 1 - this.cy);
    this.set1f('uAmp', this.amp);
    this.set1f('uIdle', this.idle);
  }
}

export const RIPPLE_KEY = 'RipplePostFX';

const registered = new WeakSet<Phaser.Game>();

export function registerRipple(scene: Phaser.Scene): void {
  const r = scene.renderer;
  if (r.type !== Phaser.WEBGL || registered.has(scene.game)) return;
  (r as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.addPostPipeline(RIPPLE_KEY, RipplePostFX);
  registered.add(scene.game);
}

/** 画像にリップルFXを付けて、そのインスタンスを返す（Canvas時は undefined） */
export function attachRipple(obj: Phaser.GameObjects.Image): RipplePostFX | undefined {
  if (obj.scene.renderer.type !== Phaser.WEBGL) return undefined;
  obj.setPostPipeline(RIPPLE_KEY);
  const fx = obj.getPostPipeline(RIPPLE_KEY);
  return fx instanceof RipplePostFX ? fx : undefined;
}
