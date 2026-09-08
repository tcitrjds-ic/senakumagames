import * as THREE from 'three';
import { AudioBox } from './audio';
import type { HungPainting } from './painting';

type State = 'closed' | 'zooming' | 'zoomed' | 'titled' | 'laughed';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** 額をタップ → 拡大 → 題名 → 笑い声 → 閉じる、の4段階を DOM で演出する */
export class Viewer {
  private state: State = 'closed';
  private root = $('viewer');
  private zoomed = $('zoomed');
  private img = $<HTMLImageElement>('zimg');
  private band = $('band');
  private course = $('course');
  private ttl = $('ttl');
  private face = $('face');
  private vhint = $('vhint');
  private current?: HungPainting;
  private lastTap = 0;
  private lastKeyAt = -1e9;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly getTime: () => number,
    private readonly resolveAsset: (u: string) => string = (u) => u,
  ) {
    $('backdrop').addEventListener('pointerup', () => this.tap());
    this.zoomed.addEventListener('pointerup', () => this.tap());
    $('close').addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (this.state === 'closed') return;
      if (e.code !== 'Escape' && e.code !== 'Space' && e.code !== 'Enter') return;
      this.lastKeyAt = performance.now();
      if (e.code === 'Escape') this.close();
      else this.tap();
    });
  }

  get isOpen(): boolean {
    return this.state !== 'closed';
  }

  /** 操作を横取りしている間（閉じた直後の数フレームも含む）は true */
  get blocksInput(): boolean {
    return this.isOpen || performance.now() - this.lastKeyAt < 250;
  }

  open(hp: HungPainting, hitUv?: THREE.Vector2): void {
    if (this.state !== 'closed') return;
    this.state = 'zooming';
    this.current = hp;
    const t = this.getTime();
    hp.burst(hitUv?.x ?? 0.5, hitUv?.y ?? 0.5, 0.06, t);
    AudioBox.play('warp');

    // 画面上の額の位置と大きさを求め、そこから中央へ拡大する
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const center = hp.slot.pos.clone().project(this.camera);
    const right = new THREE.Vector3().crossVectors(hp.slot.normal, new THREE.Vector3(0, 1, 0)).normalize();
    const edge = hp.slot.pos.clone().addScaledVector(right, hp.width / 2).project(this.camera);
    const sx = ((center.x + 1) / 2) * vw;
    const sy = ((1 - center.y) / 2) * vh;
    const projW = Math.max(20, Math.abs(edge.x - center.x) * vw);

    const img = hp.texture.image as { width: number; height: number };
    const maxW = Math.min(vw * 0.86, 1000);
    const maxH = vh * 0.7;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = Math.round(img.width * s);
    const h = Math.round(img.height * s);
    this.img.src = hp.texture.image instanceof HTMLImageElement ? hp.texture.image.src : (hp.texture.image as HTMLCanvasElement).toDataURL();
    this.img.width = w;
    this.img.height = h;
    this.img.style.width = `${w}px`;
    this.img.style.height = `${h}px`;

    this.root.hidden = false;
    this.root.classList.remove('open');
    this.band.classList.remove('on');
    this.face.classList.remove('on');
    this.zoomed.classList.remove('shake');
    this.zoomed.style.transition = 'none';
    const s0 = projW / w;
    this.zoomed.style.transform = `translate(calc(-50% + ${sx - vw / 2}px), calc(-50% + ${sy - vh / 2 - 8}px)) scale(${s0})`;
    this.vhint.textContent = '';
    // 次のフレームで中央へ
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.zoomed.style.transition = '';
        this.root.classList.add('open');
        this.zoomed.style.transform = 'translate(-50%, calc(-50% - 8px)) scale(1)';
        window.setTimeout(() => {
          if (this.state === 'zooming') {
            this.state = 'zoomed';
            this.vhint.textContent = 'タップすると だいめいが でるよ';
          }
        }, 720);
      });
    });
  }

  private tap(): void {
    const now = performance.now();
    if (now - this.lastTap < 250) return; // 二重発火防止
    this.lastTap = now;
    switch (this.state) {
      case 'zoomed':
        this.showTitle();
        break;
      case 'titled':
        this.laugh();
        break;
      case 'laughed':
        this.close();
        break;
      default:
        break;
    }
  }

  private showTitle(): void {
    if (!this.current) return;
    this.state = 'titled';
    AudioBox.play('chime');
    const p = this.current.painting;
    const title = p.title ?? (this.current.hasImage ? '（むだい）' : 'じゅんびちゅう');
    this.course.textContent = `COURSE ${p.no}`;
    this.ttl.innerHTML = `<span class="star">★</span>${escapeHtml(title)}<span class="star">★</span>`;
    this.band.classList.add('on');
    this.vhint.textContent = p.laugh ? 'もういちど タップすると…？' : 'タップして とじる';
  }

  private laugh(): void {
    if (!this.current) return;
    this.state = 'laughed';
    const p = this.current.painting;
    if (p.laugh) AudioBox.clip(this.resolveAsset(`assets/paintings/${p.laugh}`));
    else AudioBox.play('pop');
    this.face.classList.add('on');
    this.zoomed.classList.add('shake');
    this.current.burst(0.5, 0.5, 0.05, this.getTime());
    const vh = window.innerHeight;
    for (let i = 0; i < 7; i++) {
      const el = document.createElement('div');
      el.className = 'lol';
      el.textContent = i % 2 ? 'ｗｗｗ' : 'あはは';
      el.style.left = `${10 + Math.random() * 70}vw`;
      el.style.top = `${vh * 0.55 + Math.random() * vh * 0.2}px`;
      el.style.fontSize = `${22 + Math.random() * 18}px`;
      el.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
      el.style.animationDelay = `${i * 0.14}s`;
      this.root.appendChild(el);
      window.setTimeout(() => el.remove(), 1900 + i * 140);
    }
    this.vhint.textContent = p.laugh ? 'タップして とじる' : '（わらいごえは まだ じゅんびちゅう）タップして とじる';
  }

  close(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    AudioBox.stopClip();
    AudioBox.play('back');
    this.root.classList.remove('open');
    this.band.classList.remove('on');
    this.face.classList.remove('on');
    this.zoomed.style.transform = 'translate(-50%, -50%) scale(0.2)';
    const cur = this.current;
    window.setTimeout(() => {
      if (this.state === 'closed' && this.current === cur) {
        this.root.hidden = true;
        this.current = undefined;
      }
    }, 450);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
