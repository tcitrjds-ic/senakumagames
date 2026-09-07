/**
 * 絵画マニフェスト（public/assets/paintings/manifest.json）の型と正規化。
 *
 * 書き方は public/assets/paintings/README.md を参照。
 * - { "paintings": [ {image,title,laugh}, ... ] }
 * - { "rooms": [ { "paintings": [ ... ] } ] }  （旧形式。部屋は無視して順番に並べる）
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
}

export interface RawManifest {
  rooms?: { name?: string; paintings?: PaintingDef[] }[];
  paintings?: PaintingDef[];
}

/** マニフェストが空のときに並べる空きキャンバスの数 */
export const DEFAULT_SLOTS = 12;

export function normalizeManifest(raw: RawManifest | undefined): Painting[] {
  let defs: PaintingDef[] = [];
  if (raw?.paintings && raw.paintings.length > 0) defs = raw.paintings;
  else if (raw?.rooms) defs = raw.rooms.flatMap((r) => r.paintings ?? []);
  if (defs.length === 0) defs = Array.from({ length: DEFAULT_SLOTS }, () => ({}));
  return defs.map((p, i) => ({
    no: i + 1,
    image: p.image?.trim() || undefined,
    title: p.title?.trim() || undefined,
    laugh: p.laugh?.trim() || undefined,
  }));
}
