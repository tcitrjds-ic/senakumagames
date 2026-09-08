/**
 * WebAudio で SE と BGM をその場で合成する小さなサウンドボックス。
 * 笑い声などのユーザー提供ファイルは HTMLAudio で再生する。
 */
export type SfxName = 'click' | 'door' | 'warp' | 'chime' | 'pop' | 'back' | 'jump' | 'step';

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

  /** ユーザー操作の直後に呼んで AudioContext を起こす */
  unlock(): void {
    this.ac();
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

  play(name: SfxName): void {
    switch (name) {
      case 'click': this.tone(620, 0.06, 'triangle', 0.08); break;
      case 'back': this.tone(520, 0.07, 'triangle', 0.07); this.tone(390, 0.1, 'triangle', 0.06, 0.06); break;
      case 'jump': this.tone(300, 0.18, 'square', 0.04, 0, 700); break;
      case 'step': this.tone(140 + Math.random() * 40, 0.05, 'triangle', 0.03); break;
      case 'door':
        this.tone(180, 0.35, 'sawtooth', 0.03, 0, 240);
        this.tone(900, 0.05, 'square', 0.04, 0.32);
        break;
      case 'warp':
        this.tone(220, 0.7, 'sine', 0.09, 0, 1400);
        this.tone(330, 0.7, 'triangle', 0.05, 0.05, 1900);
        [1568, 1976, 2349, 2794].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.035, 0.45 + i * 0.07));
        break;
      case 'chime':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.06, i * 0.09));
        break;
      case 'pop': this.tone(500, 0.08, 'square', 0.05, 0, 900); break;
    }
  }

  // --- ユーザー提供の音声ファイル（笑い声など）: 見つからなければ黙ってスキップ ---
  private clipCache = new Map<string, HTMLAudioElement | null>();
  private current: HTMLAudioElement | null = null;

  clip(path: string): void {
    if (this.muted) return;
    let a = this.clipCache.get(path);
    if (a === null) return;
    if (a === undefined) {
      a = new Audio(path);
      a.volume = 0.95;
      a.addEventListener('error', () => this.clipCache.set(path, null));
      this.clipCache.set(path, a);
    }
    if (this.current && this.current !== a) this.current.pause();
    this.current = a;
    a.currentTime = 0;
    void a.play().catch(() => {
      /* 未配置・未対応環境では黙ってスキップ */
    });
  }

  stopClip(): void {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
    }
  }

  // --- BGM: お城のホールらしい 3拍子のオリジナル曲（その場で合成） ---
  private static MELODY = [
    659, 0, 784, 880, 0, 784, 659, 0, 523, 587, 0, 659, 523, 0, 0, 0,
    659, 0, 784, 988, 0, 880, 784, 0, 659, 698, 0, 784, 659, 0, 0, 0,
    880, 0, 988, 1047, 0, 988, 880, 0, 784, 659, 0, 784, 880, 0, 0, 0,
    784, 0, 698, 659, 0, 587, 523, 0, 587, 659, 0, 587, 523, 0, 0, 0,
  ];
  private static BASS = [262, 196, 220, 175];
  private static CHORDS = [[330, 392, 523], [294, 392, 494], [330, 440, 523], [349, 440, 523]];

  startMusic(): void {
    const ctx = this.ac();
    if (!ctx || this.musicTimer !== undefined) return;
    let next = ctx.currentTime + 0.1;
    const step = 0.2;
    this.musicTimer = window.setInterval(() => {
      const c = this.ac();
      if (!c) return;
      // タブが裏に回って setInterval が止まっていた間の拍は、まとめて鳴らさず飛ばす
      if (next < c.currentTime) {
        this.beat += Math.ceil((c.currentTime - next) / step);
        next = c.currentTime + 0.05;
      }
      while (next < c.currentTime + 0.35) {
        const at = Math.max(0, next - c.currentTime);
        const i = this.beat % 64;
        const bar = Math.floor(i / 16);
        const m = AudioBoxImpl.MELODY[i];
        if (m) this.tone(m, 0.32, 'triangle', 0.026, at);
        if (i % 12 === 0) this.tone(AudioBoxImpl.BASS[bar], 0.5, 'sine', 0.045, at);
        if (i % 12 === 4 || i % 12 === 8) {
          for (const f of AudioBoxImpl.CHORDS[bar]) this.tone(f, 0.3, 'triangle', 0.011, at);
        }
        next += step;
        this.beat += 1;
      }
    }, 120);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) this.stopClip();
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* noop */
    }
    return this.muted;
  }
}

export const AudioBox = new AudioBoxImpl();
