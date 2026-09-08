/** スマホ向けバーチャルスティック・カメラ回転ドラッグ・ボタン・キーボードをまとめる */
export interface ControlState {
  /** スティック（画面基準: 右が +x、上が +y。長さ 0〜1） */
  stickX: number;
  stickY: number;
  /** 直近フレームでのカメラ回転量（ラジアン） */
  orbitDelta: number;
  /** このフレームでジャンプが押された */
  jumpPressed: boolean;
  /** 「みる」が押された */
  lookPressed: boolean;
  /** タップ（短い押し離し）の画面座標 */
  tap: { x: number; y: number } | null;
  /** ユーザーがカメラを操作してからの秒数（自動追従の抑制に使う） */
  sinceOrbit: number;
}

const KEYS = new Set<string>();

export interface ControlsOptions {
  /** true の間はキー・ボタン・タップを無視する（絵の拡大表示中など） */
  isBlocked?: () => boolean;
}

export class Controls {
  private stick = { x: 0, y: 0 };
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private orbitId: number | null = null;
  private orbitLast = 0;
  private orbitAccum = 0;
  private jumpQueued = false;
  private lookQueued = false;
  private tapQueued: { x: number; y: number } | null = null;
  private sinceOrbit = 999;
  private downInfo = new Map<number, { x: number; y: number; t: number; moved: boolean }>();
  private readonly isBlocked: () => boolean;
  /** このフレームの途中で一度でも「無視する状態」だったか（キーを押した瞬間に閉じた場合の対策） */
  private blockedInFrame = false;

  constructor(
    joyArea: HTMLElement,
    joyBase: HTMLElement,
    private readonly joyKnob: HTMLElement,
    orbitArea: HTMLElement,
    jumpBtn: HTMLElement,
    lookBtn: HTMLElement,
    opts: ControlsOptions = {},
  ) {
    this.isBlocked = opts.isBlocked ?? (() => false);
    const R = 65;
    const down = (e: PointerEvent) => {
      this.downInfo.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
    };
    const trackMove = (e: PointerEvent) => {
      const d = this.downInfo.get(e.pointerId);
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) d.moved = true;
    };
    const up = (e: PointerEvent) => {
      const d = this.downInfo.get(e.pointerId);
      if (d && !d.moved && performance.now() - d.t < 300) this.tapQueued = { x: e.clientX, y: e.clientY };
      this.downInfo.delete(e.pointerId);
    };

    // --- スティック（左半分のどこを触っても、そこが中心になる）---
    joyArea.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      joyArea.setPointerCapture(e.pointerId);
      const rect = joyArea.getBoundingClientRect();
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      joyBase.style.left = `${e.clientX - rect.left - R}px`;
      joyBase.style.top = `${e.clientY - rect.top - R}px`;
      joyBase.style.bottom = 'auto';
      joyBase.style.opacity = '1';
      this.setKnob(0, 0);
      down(e);
    });
    joyArea.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      trackMove(e);
      let dx = e.clientX - this.stickOrigin.x;
      let dy = e.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      const max = R - 10;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      this.setKnob(dx, dy);
      this.stick.x = dx / max;
      this.stick.y = -dy / max;
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stick.x = this.stick.y = 0;
      this.setKnob(0, 0);
      joyBase.style.opacity = '0.6';
      up(e);
    };
    joyArea.addEventListener('pointerup', endStick);
    joyArea.addEventListener('pointercancel', endStick);

    // --- カメラ回転（右半分をドラッグ）---
    orbitArea.addEventListener('pointerdown', (e) => {
      if (this.orbitId !== null) return;
      this.orbitId = e.pointerId;
      orbitArea.setPointerCapture(e.pointerId);
      this.orbitLast = e.clientX;
      down(e);
    });
    orbitArea.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.orbitId) return;
      trackMove(e);
      const dx = e.clientX - this.orbitLast;
      this.orbitLast = e.clientX;
      this.orbitAccum -= dx * 0.006;
      if (Math.abs(dx) > 0) this.sinceOrbit = 0;
    });
    const endOrbit = (e: PointerEvent) => {
      if (e.pointerId !== this.orbitId) return;
      this.orbitId = null;
      up(e);
    };
    orbitArea.addEventListener('pointerup', endOrbit);
    orbitArea.addEventListener('pointercancel', endOrbit);

    // --- ボタン ---
    const press = (el: HTMLElement, fn: () => void) => {
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        fn();
      });
    };
    press(jumpBtn, () => (this.jumpQueued = true));
    press(lookBtn, () => (this.lookQueued = true));

    // --- キーボード ---
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      KEYS.add(e.code);
      // 拡大表示中の Enter / Space / F はビューア側のもの（閉じた勢いで再び開かない）
      const blocked = this.isBlocked();
      if (blocked) this.blockedInFrame = true;
      if (!blocked) {
        if (e.code === 'Space') this.jumpQueued = true;
        if (e.code === 'Enter' || e.code === 'KeyF') this.lookQueued = true;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => KEYS.delete(e.code));
    window.addEventListener('blur', () => KEYS.clear());
  }

  private setKnob(dx: number, dy: number): void {
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** 1フレーム分の入力を取り出す（押下フラグはここでリセット） */
  poll(dt: number): ControlState {
    this.sinceOrbit += dt;
    // このフレームのどこかで拡大表示中だったなら、たまった押下は捨てる
    if (this.isBlocked() || this.blockedInFrame) {
      this.jumpQueued = false;
      this.lookQueued = false;
      this.tapQueued = null;
      this.orbitAccum = 0;
    }
    this.blockedInFrame = false;
    let sx = this.stick.x;
    let sy = this.stick.y;
    const k = (a: string, b?: string) => KEYS.has(a) || (b !== undefined && KEYS.has(b));
    if (k('ArrowLeft', 'KeyA')) sx -= 1;
    if (k('ArrowRight', 'KeyD')) sx += 1;
    if (k('ArrowUp', 'KeyW')) sy += 1;
    if (k('ArrowDown', 'KeyS')) sy -= 1;
    const len = Math.hypot(sx, sy);
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    let orbit = this.orbitAccum;
    this.orbitAccum = 0;
    if (k('KeyQ')) {
      orbit += 1.8 * dt;
      this.sinceOrbit = 0;
    }
    if (k('KeyE')) {
      orbit -= 1.8 * dt;
      this.sinceOrbit = 0;
    }
    const state: ControlState = {
      stickX: sx,
      stickY: sy,
      orbitDelta: orbit,
      jumpPressed: this.jumpQueued,
      lookPressed: this.lookQueued,
      tap: this.tapQueued,
      sinceOrbit: this.sinceOrbit,
    };
    this.jumpQueued = false;
    this.lookQueued = false;
    this.tapQueued = null;
    return state;
  }
}
