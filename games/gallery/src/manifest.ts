/**
 * 絵画マニフェスト（public/assets/paintings/manifest.json）の型と正規化。
 *
 * 書き方は public/assets/paintings/README.md を参照。
 * - { "rooms": [ { "name": "...", "paintings": [ {image,title,laugh}, ... ] } ] }
 * - { "paintings": [ ... ] }  （部屋分けは自動: 3枚ずつ）
 */

export interface PaintingDef {
  /** assets/paintings/ からの相対ファイル名（png/jpg）。未指定なら準備中の空きキャンバス */
  image?: string;
  /** 2回目のタップで表示する題名 */
  title?: string;
  /** 3回目のタップで鳴らす笑い声ファイル（mp3/ogg/m4a など） */
  laugh?: string;
}

export interface Painting extends PaintingDef {
  /** 通し番号（1始まり）。COURSE 番号のように表示する */
  no: number;
  /** テクスチャキー（画像が読めたとき） */
  key: string;
}

export interface Room {
  name: string;
  paintings: Painting[];
}

export interface RawManifest {
  rooms?: { name?: string; paintings?: PaintingDef[] }[];
  paintings?: PaintingDef[];
}

export const PER_ROOM = 3;
export const DOORS_PER_FLOOR = 4;

/** マニフェストが無いときの既定の部屋割り（空きキャンバス） */
const DEFAULT_ROOM_NAMES = ['1F ひだりのへや', '1F みぎのへや', '2F ひだりのへや', '2F みぎのへや'];

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export function normalizeManifest(raw: RawManifest | undefined): Room[] {
  let counter = 0;
  const mk = (p: PaintingDef): Painting => {
    counter += 1;
    return { ...p, no: counter, key: `painting_${counter}` };
  };

  const rooms: Room[] = [];
  if (raw?.rooms && raw.rooms.length > 0) {
    raw.rooms.forEach((r, i) => {
      const defs = (r.paintings ?? []).map(mk);
      const parts = chunk(defs.length ? defs : [], PER_ROOM);
      if (parts.length === 0) parts.push([]);
      parts.forEach((part, j) => {
        const base = r.name ?? `へや ${i + 1}`;
        rooms.push({ name: parts.length > 1 ? `${base} その${j + 1}` : base, paintings: part });
      });
    });
  } else if (raw?.paintings && raw.paintings.length > 0) {
    chunk(raw.paintings.map(mk), PER_ROOM).forEach((part, i) => {
      rooms.push({ name: DEFAULT_ROOM_NAMES[i] ?? `へや ${i + 1}`, paintings: part });
    });
  }

  if (rooms.length === 0) {
    // 既定: 4部屋 × 3枚の空きキャンバス
    DEFAULT_ROOM_NAMES.forEach((name) => {
      rooms.push({ name, paintings: [mk({}), mk({}), mk({})] });
    });
  }
  return rooms;
}

/** 部屋を階ごとに分ける（1階あたり扉4つ）。星の扉で次の階へ */
export function floorsOf(rooms: Room[]): Room[][] {
  return chunk(rooms, DOORS_PER_FLOOR);
}

export function floorLabel(i: number): string {
  return `${i + 1}F`;
}
