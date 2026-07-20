import Phaser from 'phaser';

/**
 * WebAudioでSEとBGMをその場で合成する小さなサウンドボックス。
 * 音声ファイル不要・オフラインでも鳴る。ミュート設定は保存される。
 */
export type SfxName =
  | 'jump' | 'coin' | 'hit' | 'click' | 'tick' | 'capture' | 'win' | 'lose' | 'thud' | 'speedup';

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

  // --- ボイス: assets/voice/<name>.ogg が配置されていれば再生、無ければ何もしない ---
  private voiceCache = new Map<string, HTMLAudioElement | null>();

  voice(name: string): void {
    if (this.muted) return;
    let a = this.voiceCache.get(name);
    if (a === null) return; // 以前ロードに失敗（未配置）
    if (a === undefined) {
      a = new Audio(`assets/voice/${name}.ogg`);
      a.volume = 0.9;
      a.addEventListener('error', () => this.voiceCache.set(name, null));
      this.voiceCache.set(name, a);
    }
    a.currentTime = 0;
    void a.play().catch(() => {
      /* 未配置・未対応環境では黙ってスキップ */
    });
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
      case 'thud': this.tone(95, 0.09, 'sine', 0.06); break;
      case 'speedup': this.tone(420, 0.24, 'square', 0.05, 0, 940); this.tone(1240, 0.12, 'triangle', 0.05, 0.2); break;
    }
  }

  // --- BGM: A-A-B-A 構成 + ベース + コードパッド + パーカッション（すべてその場で合成） ---
  private static MELODY_A = [523, 659, 784, 880, 784, 659, 523, 0, 587, 698, 880, 784, 659, 523, 587, 0];
  private static MELODY_B = [880, 784, 659, 784, 880, 1046, 880, 784, 698, 880, 784, 659, 587, 659, 523, 0];
  private static BASS = [131, 0, 196, 0, 220, 0, 165, 0, 175, 0, 220, 0, 196, 0, 196, 0];
  private static CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  private noiseBuf: AudioBuffer | null = null;

  /** ハイハット等のノイズ音 */
  private noise(dur: number, vol: number, at = 0): void {
    const ctx = this.ac();
    if (!ctx || this.muted) return;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  startMusic(): void {
    const ctx = this.ac();
    if (!ctx || this.musicTimer !== undefined) return;
    let next = ctx.currentTime + 0.1;
    const step = 0.22;
    this.musicTimer = window.setInterval(() => {
      const c = this.ac();
      if (!c) return;
      while (next < c.currentTime + 0.35) {
        const at = Math.max(0, next - c.currentTime);
        const i = this.beat % 16;
        const section = Math.floor(this.beat / 16) % 4; // A A B A
        const melody = section === 2 ? AudioBoxImpl.MELODY_B : AudioBoxImpl.MELODY_A;
        const m = melody[i];
        const b = AudioBoxImpl.BASS[i];
        if (m) this.tone(m, 0.2, 'triangle', 0.028, at);
        if (b) this.tone(b, 0.4, 'sine', 0.05, at);
        if (i % 4 === 0) {
          this.tone(150, 0.12, 'sine', 0.055, at, 45); // キック
          for (const f of AudioBoxImpl.CHORDS[Math.floor(i / 4)]) {
            this.tone(f, 1.35, 'triangle', 0.009, at); // コードパッド
          }
        }
        if (i % 2 === 1) this.noise(0.05, 0.015, at); // ハイハット
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
