#!/usr/bin/env node
/**
 * 公開サイト（GitHub Pages）を実際にブラウザで開いて確認する。
 * デプロイのあとに必ず実行する（GitHub の「成功」表示だけでは、画面が正しいかは分からない）。
 *
 * 確認すること:
 *   ポータル … 3つのゲームへのリンクとサムネイル、紹介文に他社のタイトル・キャラ名が無いこと
 *   ラン     … 新しい主人公の素材を読み込み、エラーが無いこと
 *   マンカラ … 新しい盤・石・フェルトを読み込み、2倍解像度で描かれ、エラーが無いこと
 *   美術館   … 読み込む素材がオリジナルだけであること、← で左を向いてまっすぐ進みカメラが回り込むこと
 *
 * 使い方:
 *   node tools/verify_live.cjs                 # 結果だけ表示
 *   node tools/verify_live.cjs --shots 出力先   # 各画面のスクリーンショットも保存（目で確認する用）
 *   SITE_URL=https://example.com/senakumagames/ node tools/verify_live.cjs   # 別の場所を確認
 *
 * 必要なもの: Playwright と Chromium（クラウドの開発環境には入っている。手元では npx playwright install chromium）。
 * クラウド環境では、公開サイトのホストを環境の許可リストに入れておくこと（環境「senakumagames」は設定済み）。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.SITE_URL || 'https://tcitrjds-ic.github.io/senakumagames/';
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
/** スクリーンショットを保存する（--shots を指定したときだけ） */
const shot = async (page, name, opts = {}) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), ...opts }); };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const watch = (page, bag) => {
    page.on('pageerror', (e) => bag.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') bag.errors.push(m.text().slice(0, 160)); });
    page.on('response', (r) => { bag.urls.push(r.url()); if (r.status() >= 400) bag.bad.push(r.status() + ' ' + r.url().replace(BASE, '')); });
    page.on('requestfailed', (r) => bag.bad.push('failed ' + r.url().replace(BASE, '')));
  };
  const newBag = () => ({ errors: [], bad: [], urls: [] });
  const notVoice = (a) => a.filter((x) => !x.includes('/voice/') && !x.includes('Failed to load resource'));

  // ---- 1) ポータル ----
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }); const bag = newBag(); watch(page, bag);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
    const cards = await page.evaluate(() => [...document.querySelectorAll('.card')].map((c) => ({ title: c.querySelector('h2')?.textContent, href: c.querySelector('a.play')?.getAttribute('href'), img: (() => { const i = c.querySelector('img.shot'); return i ? i.naturalWidth : null; })() })));
    await shot(page, 'live_portal', { fullPage: true });
    const links = cards.map((c) => c.href);
    check('ポータル: 3つのゲームへのリンクがあり、サムネイルが読めている', ['runner/', 'mancala/', 'gallery/'].every((h) => links.includes(h)) && cards.filter((c) => c.img > 0).length >= 3 && notVoice(bag.bad).length === 0, cards.map((c) => `${c.title}→${c.href}(img ${c.img})`).join(' / ') + (bag.bad.length ? ' bad: ' + bag.bad.join(',') : ''));
    const text = await page.evaluate(() => document.body.innerText);
    check('ポータル: 紹介文に他社タイトル・キャラ名が無い', !/ピーチ|マリオ|ルイージ|キノピオ/.test(text), '');
    await page.close();
  }

  // ---- 2) せなくまラン ----
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); const bag = newBag(); watch(page, bag);
    await page.goto(BASE + 'runner/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 60000 });
    await page.waitForTimeout(5000);
    await shot(page, 'live_runner_title');
    await page.keyboard.press('Space'); await page.waitForTimeout(4000);
    await page.keyboard.down('Space'); await page.waitForTimeout(700); await page.keyboard.up('Space');
    await shot(page, 'live_runner_play');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(2500);
    await shot(page, 'live_runner_pause');
    const hero = bag.urls.some((u) => u.endsWith('assets/hero.png')) && bag.urls.some((u) => u.endsWith('assets/hero.json'));
    const oldPlayer = bag.urls.some((u) => /assets\/player(_run|_jump)?\.png$/.test(u));
    check('ラン: 新しい主人公の素材を読み込み、エラーなし', hero && !oldPlayer && bag.errors.filter((e) => !e.includes('Failed to load resource')).length === 0 && notVoice(bag.bad).length === 0, `hero=${hero} old=${oldPlayer} errors=${bag.errors.length} bad=${notVoice(bag.bad).join(',') || 'none'} (voice未配置の404 ${bag.bad.filter((x) => x.includes('/voice/')).length}件は仕様)`);
    await page.close();
  }

  // ---- 3) マンカラ ----
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 }); const bag = newBag(); watch(page, bag);
    await page.goto(BASE + 'mancala/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 60000 });
    await page.waitForTimeout(9000);
    await shot(page, 'live_mancala_title');
    await page.keyboard.press('Enter'); await page.waitForTimeout(20000);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(3000);
    await shot(page, 'live_mancala_play');
    const c = await page.evaluate(() => { const c = document.querySelector('canvas'); return c.width + 'x' + c.height; });
    const assets = ['board.png', 'seeds.png', 'felt.png'].every((n) => bag.urls.some((u) => u.endsWith('assets/' + n)));
    check('マンカラ: 新しい盤・石・フェルトを読み込み、2倍解像度で描画、エラーなし', assets && c === '1920x1080' && bag.errors.filter((e) => !e.includes('Failed to load resource')).length === 0 && notVoice(bag.bad).length === 0, `assets=${assets} canvas=${c} errors=${bag.errors.length} bad=${notVoice(bag.bad).join(',') || 'none'}`);
    await page.close();
  }

  // ---- 4) 美術館 ----
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); const bag = newBag(); watch(page, bag);
    await page.goto(BASE + 'gallery/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => { const b = document.getElementById('enter'); return b && !b.disabled; }, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    await shot(page, 'live_gallery_title');
    const names = bag.urls.filter((u) => /assets\/(char_|tex_|glass_)/.test(u)).map((u) => u.split('/').pop()).sort();
    const old = names.filter((n) => /mario|luigi|peach|toad|tex_sun|door_star|door_big/.test(n));
    check('美術館: 読み込む素材はオリジナルのものだけ', old.length === 0 && ['char_potato.png', 'char_curator.png', 'char_rabbit.png', 'char_chick.png', 'char_senakuma.png'].every((n) => names.includes(n)), names.join(', '));
    await page.click('#enter');
    await page.waitForFunction(() => window.__gallery && window.__gallery.started(), null, { timeout: 30000 });
    await page.waitForTimeout(7000);
    const hasNew = await page.evaluate(() => !!(window.__gallery.sprite && window.__gallery.facing));
    check('美術館: 公開されているのは今回の修正版（向き・カメラの修正入り）', hasNew, `__gallery.sprite / facing があるか = ${hasNew}`);
    if (hasNew) {
      const st = () => page.evaluate(() => { const g = window.__gallery; return { x: +g.pos.x.toFixed(2), z: +g.pos.z.toFixed(2), yaw: +g.camYaw().toFixed(3), view: g.sprite.view, flip: g.sprite.flip }; });
      const record = () => page.evaluate(() => { const g = window.__gallery; window.__seen = []; const f0 = g.frames; const h = () => { if (g.frames - f0 > 500) return; window.__seen.push(g.sprite.view + (g.sprite.flip ? ':flip' : '')); requestAnimationFrame(h); }; requestAnimationFrame(h); });
      await page.evaluate(() => { const g = window.__gallery; g.pos.set(4, 0, 9); g.facing.set(0, 0, 1); });
      await page.waitForTimeout(600);
      const s0 = await st(); await record();
      await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1200); await shot(page, 'live_gallery_left'); await page.waitForTimeout(3800);
      const s1 = await st(); await page.keyboard.up('ArrowLeft');
      const seen = await page.evaluate(() => [...new Set(window.__seen)]);
      check('美術館: ← で左向きになり、まっすぐ左へ進み、カメラが後ろへ回る', seen.includes('side:flip') && !seen.includes('side') && s1.x < s0.x - 3 && Math.abs(s1.z - s0.z) < 0.6 && s1.yaw - s0.yaw > 0.9, `見えた姿: ${seen.join(', ')} / (${s0.x},${s0.z})→(${s1.x},${s1.z}) / yaw ${s0.yaw}→${s1.yaw}`);
      await shot(page, 'live_gallery_after');
      await page.evaluate(() => { const g = window.__gallery; g.pos.set(0.4, 0, 9.2); const y = g.camYaw(); g.facing.set(Math.sin(y), 0, Math.cos(y)); });
      await page.waitForTimeout(1500);
      await shot(page, 'live_gallery_front');
    }
    check('美術館: エラー・読み込み失敗なし', bag.errors.length === 0 && bag.bad.length === 0, [...bag.errors, ...bag.bad].join(' | '));
    await page.close();
  }
  await browser.close();
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
