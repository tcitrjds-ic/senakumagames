import Phaser from 'phaser';

/**
 * WebAudioでSEとBGMをその場で合成する小さなサウンドボックス。
 * 音声ファイル不要・オフラインでも鳴る。ミュート設定は保存される。
 */
export type SfxName = 'jump' | 'coin' | 'hit' | 'click' | 'tick' | 'capture' | 'win' | 'lose';

const MUTE_KEY = 'senakuma:muted';

class AudioBoxImpl {
  private ctx: AudioContext | null = null;
  private musicTimer: number | undefined;
  private beat = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* 保存できない環境でも動かす */
    }
  }

  private ac(): AudioContext | null {
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(f0: number, dur: number, type: OscillatorType, vol: number, at = 0, f1?: number): void {
    const ctx = this.ac();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** コイン音。コンボが続くほど音程が上がる */
  coin(step = 0): void {
    const f = 880 * Math.pow(2, Math.min(step, 16) / 24);
    this.tone(f, 0.09, 'square', 0.05);
    this.tone(f * 1.5, 0.14, 'square', 0.05, 0.07);
  }

  play(name: SfxName): void {
    switch (name) {
      case 'jump': this.tone(320, 0.16, 'square', 0.045, 0, 660); break;
      case 'coin': this.tone(880, 0.09, 'square', 0.05); this.tone(1318, 0.14, 'square', 0.05, 0.07); break;
      case 'hit': this.tone(200, 0.32, 'sawtooth', 0.08, 0, 65); break;
      case 'click': this.tone(620, 0.06, 'triangle', 0.08); break;
      case 'tick': this.tone(640 + Math.random() * 180, 0.05, 'triangle', 0.06); break;
      case 'capture': [660, 880, 1108].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.06, i * 0.06)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, i * 0.13)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.06, i * 0.16)); break;
    }
  }

  // かわいい8分音符ループ（C-Am-F-G）
  private static MELODY = [523, 659, 784, 659, 880, 784, 659, 523, 587, 698, 880, 698, 784, 659, 587, 523];
  private static BASS = [262, 0, 196, 0, 220, 0, 165, 0, 175, 0, 131, 0, 196, 0, 196, 0];

  startMusic(): void {
    const ctx = this.ac();
    if (!ctx || this.musicTimer !== undefined) return;
    let next = ctx.currentTime + 0.1;
    const step = 0.24;
    this.musicTimer = window.setInterval(() => {
      const c = this.ac();
      if (!c) return;
      while (next < c.currentTime + 0.35) {
        const at = Math.max(0, next - c.currentTime);
        const m = AudioBoxImpl.MELODY[this.beat % 16];
        const b = AudioBoxImpl.BASS[this.beat % 16];
        if (m) this.tone(m, 0.21, 'triangle', 0.03, at);
        if (b) this.tone(b, 0.42, 'sine', 0.045, at);
        next += step;
        this.beat += 1;
      }
    }, 120);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* noop */
    }
    return this.muted;
  }
}

export const AudioBox = new AudioBoxImpl();

/** 右上のミュート切替ボタン（全シーン共通の見た目） */
export function addMuteButton(scene: Phaser.Scene, x: number, y: number): void {
  const bg = scene.add.circle(x, y, 24, 0xffffff, 0.9).setDepth(60).setStrokeStyle(3, 0xf0b7c8);
  const icon = scene.add
    .text(x, y, AudioBox.muted ? '🔇' : '🔊', { fontSize: '22px' })
    .setOrigin(0.5)
    .setDepth(61);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation(); // 下のジャンプ入力等を発火させない
    const muted = AudioBox.toggleMute();
    icon.setText(muted ? '🔇' : '🔊');
    AudioBox.play('click');
  });
}
