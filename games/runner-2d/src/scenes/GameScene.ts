import Phaser from 'phaser';
import {
  GAME_WIDTH,
  FLOOR_TOP,
  GROUND_HEIGHT,
  GAME_HEIGHT,
  PLAYER_HEIGHT,
  FONT_FAMILY,
  loadHighScore,
  saveHighScore,
} from '../constants';
import { AudioBox, addMuteButton } from '../audio';
import { buildBackground, hudPill, fadeStart, addFullscreenButton, Parallax } from '../ui';

const START_SPEED = 280;
const MAX_SPEED = 620;
const SPEED_PER_SEC = 9;
const JUMP_VELOCITY = -750;
const FEVER_COMBO = 15;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private bg!: Parallax;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private potatoes!: Phaser.Physics.Arcade.Group;
  private flowers: Phaser.GameObjects.Image[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private scoreIcon!: Phaser.GameObjects.Image;
  private distText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private feverTrail!: Phaser.GameObjects.Particles.ParticleEmitter;

  private speed = START_SPEED;
  private score = 0;
  private combo = 0;
  private distance = 0;
  private jumpsLeft = 2;
  private isOver = false;
  private isPaused = false;
  private pausedAt = 0;
  private speedLevel = 0;
  private wasAirborne = false;
  private nextStepDust = 0;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private trees: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    this.speed = START_SPEED;
    this.score = 0;
    this.combo = 0;
    this.distance = 0;
    // 開発用: ?dist=600&score=20 で状態を再現できる（時間帯やメダルの確認用）
    const qp = new URLSearchParams(window.location.search);
    this.distance = Number(qp.get('dist')) || 0;
    this.score = Number(qp.get('score')) || 0;
    this.jumpsLeft = 2;
    this.isOver = false;
    this.wasAirborne = false;
    this.nextStepDust = 0;
    this.flowers = [];

    this.isPaused = false;
    this.speedLevel = Math.floor(this.distance / 250);
    this.cameras.main.setZoom(1);
    this.bg = buildBackground(this, true);
    this.cameras.main.fadeIn(280, 255, 238, 245);

    // 背景の木（丘の手前をゆっくり流れる）
    this.trees = [];
    for (let i = 0; i < 2; i++) {
      const t = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH) + i * 480, FLOOR_TOP + 6, 'tree')
        .setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.9, 1.25))
        .setDepth(2);
      this.trees.push(t);
    }

    // 草地のかざり
    for (let i = 0; i < 5; i++) {
      const f = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH), FLOOR_TOP + Phaser.Math.Between(6, 20), Math.random() < 0.5 ? 'flower1' : 'flower2')
        .setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.75, 1.05))
        .setDepth(3);
      this.flowers.push(f);
    }

    const floor = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT);
    this.physics.add.existing(floor, true);

    this.playerShadow = this.add.image(180, FLOOR_TOP + 8, 'shadow').setDepth(4).setAlpha(0.4);
    this.player = this.physics.add.sprite(180, FLOOR_TOP - PLAYER_HEIGHT, 'player');
    this.player.setScale(PLAYER_HEIGHT / this.player.height);
    // 切り抜き画像の余白ぶん、当たり判定は少し内側に絞る
    this.player.body!.setSize(this.player.width * 0.55, this.player.height * 0.9, true);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    this.physics.add.collider(this.player, floor);

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.potatoes = this.physics.add.group({ allowGravity: false, immovable: true });

    this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver());
    this.physics.add.overlap(this.player, this.potatoes, (_p, potato) =>
      this.collect(potato as Phaser.Physics.Arcade.Sprite),
    );

    // パーティクル
    this.sparkles = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 90, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 },
      rotate: { min: 0, max: 360 },
      lifespan: 500,
      gravityY: 400,
      emitting: false,
    }).setDepth(14);
    this.dust = this.add.particles(0, 0, 'dust', {
      speed: { min: 40, max: 110 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 420,
      emitting: false,
    }).setDepth(9);
    this.feverTrail = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 10, max: 60 },
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xffb0c2, 0xffe28a, 0xa8e6a1, 0x9ed4ff, 0xd9b3ff],
      lifespan: 550,
      frequency: 45,
      emitting: false,
      follow: undefined,
    }).setDepth(9);

    // HUD
    hudPill(this, 16, 14, 190, 48);
    this.scoreIcon = this.add.image(46, 38, 'potato').setScale(0.3).setDepth(10);
    this.scoreText = this.add
      .text(74, 38, `× ${this.score}`, {
        fontFamily: FONT_FAMILY, fontSize: '28px', fontStyle: 'bold', color: '#8a5a44',
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    hudPill(this, GAME_WIDTH / 2 - 78, 14, 156, 44);
    this.distText = this.add
      .text(GAME_WIDTH / 2, 36, '0m', {
        fontFamily: FONT_FAMILY, fontSize: '22px', fontStyle: 'bold', color: '#7aa1c4',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.comboText = this.add
      .text(28, 78, '', {
        fontFamily: FONT_FAMILY, fontSize: '26px', fontStyle: 'bold', color: '#ff8fa8',
      })
      .setOrigin(0, 0.5)
      .setStroke('#ffffff', 8)
      .setDepth(10);

    const best = loadHighScore();
    if (best > 0) {
      hudPill(this, GAME_WIDTH - 264, 14, 180, 48);
      this.add
        .text(GAME_WIDTH - 174, 38, `👑 ベスト ${best}`, {
          fontFamily: FONT_FAMILY, fontSize: '21px', fontStyle: 'bold', color: '#c99b2e',
        })
        .setOrigin(0.5)
        .setDepth(10);
    }
    addMuteButton(this, GAME_WIDTH - 36, 38);
    addFullscreenButton(this, GAME_WIDTH - 36, 92);
    this.buildPauseButton();

    this.input.on('pointerdown', () => this.jump());
    this.input.keyboard?.on('keydown-SPACE', () => this.jump());
    this.input.keyboard?.on('keydown-UP', () => this.jump());
    this.input.keyboard?.on('keydown-P', () => this.togglePause());

    this.scheduleNextSpawn(600);
  }

  private buildPauseButton(): void {
    const x = GAME_WIDTH - 36;
    const y = 146;
    const bg = this.add.circle(x, y, 24, 0xffffff, 0.9).setDepth(60).setStrokeStyle(3, 0xf0b7c8);
    const g = this.add.graphics().setDepth(61);
    g.fillStyle(0x8a5a44).fillRoundedRect(x - 8, y - 9, 6, 18, 3).fillRoundedRect(x + 2, y - 9, 6, 18, 3);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.togglePause();
    });
  }

  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  private togglePause(): void {
    if (this.isOver) return;
    if (!this.isPaused) {
      this.isPaused = true;
      this.pausedAt = performance.now();
      AudioBox.play('click');
      this.physics.pause();
      this.time.paused = true;
      this.tweens.pauseAll();
      this.pauseOverlay = [
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x553a2e, 0.55).setDepth(70),
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'ポーズ', {
            fontFamily: FONT_FAMILY, fontSize: '52px', fontStyle: 'bold', color: '#ffffff',
          })
          .setOrigin(0.5).setStroke('#8a5a44', 10).setDepth(71),
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, 'タップで さいかい', {
            fontFamily: FONT_FAMILY, fontSize: '22px', color: '#ffe9d6',
          })
          .setOrigin(0.5).setDepth(71),
      ];
      const resume = (): void => {
        if (performance.now() - this.pausedAt < 300) {
          this.input.once('pointerdown', resume);
          return;
        }
        this.pauseOverlay.forEach((o) => o.destroy());
        this.pauseOverlay = [];
        this.physics.resume();
        this.time.paused = false;
        this.tweens.resumeAll();
        AudioBox.play('click');
        // 再開タップがジャンプ入力に化けないよう、少しだけ待ってから解除
        window.setTimeout(() => {
          this.isPaused = false;
        }, 60);
      };
      this.input.once('pointerdown', resume);
    }
  }

  private attachShadow(sprite: Phaser.Physics.Arcade.Sprite, scale: number, alpha: number): void {
    const sh = this.add.image(sprite.x, FLOOR_TOP + 8, 'shadow').setDepth(4).setScale(scale).setAlpha(alpha);
    sprite.setData('shadow', sh);
  }

  private jump(): void {
    if (this.isOver || this.isPaused) return;
    const onFloor = this.player.body!.blocked.down || this.player.body!.touching.down;
    if (onFloor) this.jumpsLeft = 2;
    if (this.jumpsLeft <= 0) return;
    this.jumpsLeft -= 1;
    this.player.setVelocityY(JUMP_VELOCITY);
    this.player.setTexture('player_jump');
    AudioBox.play('jump');
    this.dust.explode(6, this.player.x, FLOOR_TOP - 6);
    // ジャンプの「ぷにっ」とした伸び
    this.tweens.add({
      targets: this.player,
      scaleX: this.player.scale * 0.9,
      scaleY: this.player.scale * 1.1,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private scheduleNextSpawn(delayOverride?: number): void {
    // スピードが上がるほど間隔を詰める
    const factor = START_SPEED / this.speed;
    const delay = delayOverride ?? Phaser.Math.Between(750, 1250) * factor;
    this.spawnTimer = this.time.delayedCall(delay, () => {
      if (this.isOver) return;
      // 30%は「設計された配置チャンク」、残りはランダム
      if (Math.random() < 0.3) {
        this.spawnChunk();
        this.scheduleNextSpawn(Phaser.Math.Between(1400, 1800) * factor);
        return;
      }
      const roll = Math.random();
      if (roll < 0.48) this.spawnPotatoes();
      else if (roll < 0.8) this.spawnRock();
      else this.spawnBird();
      this.scheduleNextSpawn();
    });
  }

  /** 手作りの配置チャンク（ジャンプで取る/くぐって取る、を教える配置） */
  private spawnChunk(): void {
    const kind = Phaser.Math.Between(0, 3);
    if (kind === 0) {
      // 岩ごえアーチ: 岩の上にポテトの弧
      this.spawnRock(80);
      for (let i = 0; i < 5; i++) {
        this.spawnOnePotato(i * 62, FLOOR_TOP - 120 - Math.sin((i / 4) * Math.PI) * 140, i === 2);
      }
    } else if (kind === 1) {
      // とりの下をくぐると低空ラインがもらえる
      this.spawnBird(140);
      for (let i = 0; i < 3; i++) this.spawnOnePotato(60 + i * 70, FLOOR_TOP - 48, false);
    } else if (kind === 2) {
      // ダブル岩: あいだの空中にごほうび
      this.spawnRock(0);
      this.spawnRock(330);
      this.spawnOnePotato(165, FLOOR_TOP - 250, true);
    } else {
      // ポテトのかいだん
      for (let s = 0; s < 3; s++) {
        for (let i = 0; i < 2; i++) {
          this.spawnOnePotato(s * 170 + i * 70, FLOOR_TOP - 55 - s * 95, false);
        }
      }
    }
  }

  private spawnRock(xOff = 0): void {
    const scale = Phaser.Math.FloatBetween(0.55, 0.95);
    const rock = this.obstacles.create(GAME_WIDTH + 80 + xOff, 0, 'rock') as Phaser.Physics.Arcade.Sprite;
    rock.setScale(scale);
    rock.setY(FLOOR_TOP - (rock.height * scale) / 2 + 10);
    rock.body!.setSize(rock.width * 0.72, rock.height * 0.66, true);
    rock.setVelocityX(-this.speed);
    rock.setDepth(8);
    this.attachShadow(rock, 0.7 + scale * 0.5, 0.35);
  }

  private spawnBird(xOff = 0): void {
    // 頭の高さを飛ぶ「とり」: しゃがみ不要、走って くぐるか、タイミングよく跳び越える
    const bird = this.obstacles.create(GAME_WIDTH + 80 + xOff, FLOOR_TOP - 165, 'bird1') as Phaser.Physics.Arcade.Sprite;
    bird.setScale(0.9);
    bird.body!.setSize(bird.width * 0.6, bird.height * 0.6, true);
    bird.setVelocityX(-this.speed * 1.18);
    bird.setDepth(8);
    bird.setData('bird', true);
    bird.setData('baseY', bird.y);
    this.attachShadow(bird, 0.55, 0.16);
    const flap = this.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => {
        if (!bird.active) {
          flap.remove();
          return;
        }
        bird.setTexture(bird.texture.key === 'bird1' ? 'bird2' : 'bird1');
      },
    });
  }

  private spawnPotatoes(): void {
    // ポテトの並び: 一直線 / アーチ / ジグザグ。まれにゴールデンポテト（+5）
    const kind = Phaser.Math.Between(0, 2);
    const count = kind === 1 ? 5 : 3;
    const goldIdx = Math.random() < 0.12 ? Phaser.Math.Between(0, count - 1) : -1;
    const lineY = Phaser.Math.RND.pick([FLOOR_TOP - 50, FLOOR_TOP - 160, FLOOR_TOP - 250]);
    for (let i = 0; i < count; i++) {
      let y = lineY;
      if (kind === 1) y = FLOOR_TOP - 90 - Math.sin((i / (count - 1)) * Math.PI) * 170;
      if (kind === 2) y = lineY + (i % 2 === 0 ? 0 : -80);
      this.spawnOnePotato(i * 78, y, i === goldIdx);
    }
  }

  private spawnOnePotato(xOff: number, y: number, gold: boolean): void {
    const potato = this.potatoes.create(GAME_WIDTH + 80 + xOff, y, gold ? 'potato_gold' : 'potato') as Phaser.Physics.Arcade.Sprite;
    potato.setData('gold', gold);
    potato.setScale(gold ? 0.48 : 0.42);
    potato.body!.setSize(potato.width * 0.66, potato.height * 0.66, true);
    potato.setVelocityX(-this.speed);
    potato.setDepth(8);
    const h = FLOOR_TOP - y;
    this.attachShadow(potato, Phaser.Math.Clamp(0.62 - h / 900, 0.25, 0.62), Phaser.Math.Clamp(0.3 - h / 1600, 0.08, 0.3));
    this.tweens.add({
      targets: potato,
      angle: { from: -8, to: 8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** 250mごとのスピードアップ演出（バナー + ズームパルス + 流線） */
  private announceSpeedUp(): void {
    AudioBox.play('speedup');
    this.cameras.main.zoomTo(1.045, 130, 'Sine.easeOut', false, (_c, p) => {
      if (p === 1) this.cameras.main.zoomTo(1, 200, 'Sine.easeIn');
    });
    const banner = this.add.container(GAME_WIDTH + 160, 96).setDepth(30);
    const g = this.add.graphics();
    g.fillStyle(0x8a5a44, 0.2).fillRoundedRect(-127, -21, 254, 46, 23);
    g.fillStyle(0xffb84d, 1).fillRoundedRect(-130, -25, 254, 46, 23);
    const label = this.add
      .text(0, -2, '⚡ スピードアップ！', {
        fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
      })
      .setOrigin(0.5);
    banner.add([g, label]);
    this.tweens.add({
      targets: banner,
      x: GAME_WIDTH / 2,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          x: -220,
          delay: 900,
          duration: 280,
          ease: 'Sine.easeIn',
          onComplete: () => banner.destroy(),
        });
      },
    });
    for (let i = 0; i < 10; i++) {
      const y = Phaser.Math.Between(60, GAME_HEIGHT - 120);
      const line = this.add.image(GAME_WIDTH + 80, y, 'streak').setDepth(16).setAlpha(0.85);
      this.tweens.add({
        targets: line,
        x: -120,
        duration: Phaser.Math.Between(280, 450),
        delay: i * 35,
        ease: 'Linear',
        onComplete: () => line.destroy(),
      });
    }
  }

  private destroyWithShadow(obj: Phaser.Physics.Arcade.Sprite): void {
    (obj.getData('shadow') as Phaser.GameObjects.Image | undefined)?.destroy();
    obj.destroy();
  }

  private collect(potato: Phaser.Physics.Arcade.Sprite): void {
    if (this.isOver) return;
    const px = potato.x;
    const py = potato.y;
    const gold = potato.getData('gold') === true;
    const gain = gold ? 5 : 1;
    this.destroyWithShadow(potato);
    this.score += gain;
    this.combo += 1;
    this.scoreText.setText(`× ${this.score}`);
    AudioBox.coin(this.combo);
    if (gold) AudioBox.play('capture');
    this.sparkles.explode(gold ? 20 : 9, px, py);

    if (this.combo >= 2) {
      this.comboText.setText(`${this.combo} コンボ！`);
      this.comboText.setColor(this.combo >= FEVER_COMBO ? '#e5a715' : '#ff8fa8');
      this.tweens.add({
        targets: this.comboText,
        scale: { from: 1.35, to: 1 },
        duration: 160,
        ease: 'Back.easeOut',
      });
    }
    if (this.combo === FEVER_COMBO) {
      // フィーバー！ 虹色の軌跡がつく
      AudioBox.play('capture');
      this.feverTrail.startFollow(this.player, 0, 10);
      this.feverTrail.start();
    }

    const pop = this.add
      .text(px, py - 16, `+${gain}`, {
        fontFamily: FONT_FAMILY, fontSize: gold ? '34px' : '26px', fontStyle: 'bold',
        color: gold ? '#e5a715' : '#ff8fa8',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 6)
      .setDepth(15);
    this.tweens.add({ targets: pop, y: py - 70, alpha: 0, duration: 550, onComplete: () => pop.destroy() });
    this.tweens.add({
      targets: this.scoreIcon,
      scale: { from: 0.42, to: 0.3 },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  private breakCombo(): void {
    if (this.combo === 0) return;
    this.combo = 0;
    this.comboText.setText('');
    this.feverTrail.stop();
    this.feverTrail.stopFollow();
  }

  private gameOver(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.spawnTimer?.remove();
    this.physics.pause();
    this.feverTrail.stop();
    AudioBox.play('hit');

    // 集めたポテトがばら撒かれる（ソニック式の喪失感）
    const drops = Math.min(this.score, 8);
    for (let i = 0; i < drops; i++) {
      const p = this.add.image(this.player.x, this.player.y - 20, 'potato').setScale(0.3).setDepth(13);
      const dx = Phaser.Math.Between(-160, 160);
      const peak = Phaser.Math.Between(80, 190);
      const holder = { t: 0 };
      this.tweens.add({
        targets: holder,
        t: 1,
        duration: Phaser.Math.Between(550, 800),
        ease: 'Linear',
        onUpdate: () => {
          p.x = this.player.x + dx * holder.t;
          p.y = this.player.y - 20 - Math.sin(holder.t * Math.PI) * peak + holder.t * 120;
          p.angle = holder.t * dx;
          p.setAlpha(1 - holder.t * 0.9);
        },
        onComplete: () => p.destroy(),
      });
    }

    // ヒットストップ（一瞬止めてから吹き飛ぶ）
    this.time.delayedCall(90, () => {
      this.cameras.main.shake(250, 0.012);
      this.cameras.main.flash(200, 255, 160, 160);

      // 実況サムネ風の泣き顔カットイン
      const cutIn = this.add
        .image(Math.min(this.player.x + 170, GAME_WIDTH - 130), Math.max(this.player.y - 120, 130), 'face_cry')
        .setScale(0)
        .setDepth(20);
      this.tweens.add({
        targets: cutIn,
        scale: 0.75,
        angle: { from: -12, to: 0 },
        duration: 320,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: this.player,
        angle: -100,
        y: this.player.y - 30,
        duration: 400,
        ease: 'Sine.easeOut',
      });
    });

    const best = loadHighScore();
    const isNewBest = this.score > best;
    if (isNewBest) saveHighScore(this.score);

    this.time.delayedCall(1100, () => {
      fadeStart(this, 'GameOver', {
        score: this.score,
        best: Math.max(best, this.score),
        isNewBest,
        distance: Math.floor(this.distance),
      });
    });
  }

  update(time: number, delta: number): void {
    if (this.isOver || this.isPaused) return;
    const dt = delta / 1000;

    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_PER_SEC * dt);
    this.distance += this.speed * dt * 0.05; // 見た目に気持ちいい速さでメートルが進む
    this.distText.setText(`${Math.floor(this.distance)}m`);
    const level = Math.floor(this.distance / 250);
    if (level > this.speedLevel) {
      this.speedLevel = level;
      this.announceSpeedUp();
    }
    this.bg.ground.tilePositionX += this.speed * dt;
    this.bg.hillsNear.tilePositionX += this.speed * 0.28 * dt;
    this.bg.hillsFar.tilePositionX += this.speed * 0.12 * dt;
    this.bg.clouds.tilePositionX += this.speed * 0.05 * dt;
    if (this.bg.stars) this.bg.stars.tilePositionX += this.speed * 0.015 * dt;

    // 昼 → 夕焼け → 夜 → 昼 のサイクル（900mで一周）
    const cyc = this.distance % 900;
    const ramp = (a: number, b: number): number => Phaser.Math.Clamp((cyc - a) / (b - a), 0, 1);
    const sunsetA = Math.min(ramp(280, 360), 1 - ramp(520, 600));
    const nightA = Math.min(ramp(520, 600), 1 - ramp(800, 880));
    this.bg.skySunset?.setAlpha(sunsetA);
    this.bg.skyNight?.setAlpha(nightA);
    this.bg.stars?.setAlpha(nightA * 0.95);
    this.bg.moon?.setAlpha(nightA);
    this.bg.sun.setAlpha(1 - Math.max(sunsetA * 0.75, nightA));
    // 夜は景色を青暗く沈ませる
    const nr = Math.round(255 - (255 - 158) * nightA);
    const ng = Math.round(255 - (255 - 168) * nightA);
    const nb = Math.round(255 - (255 - 216) * nightA);
    const tint = (nr << 16) | (ng << 8) | nb;
    for (const o of [this.bg.ground, this.bg.hillsFar, this.bg.hillsNear, this.bg.clouds]) o.setTint(tint);
    for (const f of this.flowers) f.setTint(tint);

    for (const f of this.flowers) {
      f.x -= this.speed * dt;
      if (f.x < -40) {
        f.x = GAME_WIDTH + Phaser.Math.Between(20, 220);
        f.setTexture(Math.random() < 0.5 ? 'flower1' : 'flower2');
        f.setScale(Phaser.Math.FloatBetween(0.75, 1.05));
      }
    }
    for (const t of this.trees) {
      t.x -= this.speed * dt;
      if (t.x < -80) {
        t.x = GAME_WIDTH + Phaser.Math.Between(80, 500);
        t.setScale(Phaser.Math.FloatBetween(0.9, 1.25));
      }
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) {
      this.jumpsLeft = 2;
      if (this.wasAirborne) {
        // 着地の演出
        this.wasAirborne = false;
        AudioBox.play('thud');
        this.dust.explode(8, this.player.x, FLOOR_TOP - 4);
        this.tweens.add({
          targets: this.player,
          scaleX: this.player.scale * 1.08,
          scaleY: this.player.scale * 0.92,
          duration: 90,
          yoyo: true,
          ease: 'Sine.easeOut',
        });
      }
      if (this.player.texture.key !== 'player') this.player.setTexture('player'); // 着地で表情を戻す
      // 走りの「とてとて」感: ゆれ + 定期的な土ぼこり
      this.player.angle = Math.sin(time / 90) * 4;
      if (time > this.nextStepDust) {
        this.nextStepDust = time + 260;
        this.dust.explode(1, this.player.x - 26, FLOOR_TOP - 4);
      }
    } else {
      this.wasAirborne = true;
      // 空中では速度に応じて前傾/後傾
      this.player.angle = Phaser.Math.Clamp(body.velocity.y * 0.018, -14, 16);
    }

    // 接地影: 高く跳ぶほど小さく・薄く
    const airH = Phaser.Math.Clamp(FLOOR_TOP - (this.player.y + PLAYER_HEIGHT / 2), 0, 400);
    this.playerShadow.x = this.player.x;
    this.playerShadow.setScale(1 - airH / 700).setAlpha(0.4 - airH / 1400);

    for (const group of [this.obstacles, this.potatoes]) {
      for (const child of group.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        child.body!.velocity.x = -(child.getData('bird') ? this.speed * 1.18 : this.speed);
        if (child.getData('bird')) {
          child.y = (child.getData('baseY') as number) + Math.sin(time / 160) * 14;
        }
        const sh = child.getData('shadow') as Phaser.GameObjects.Image | undefined;
        if (sh) sh.x = child.x;
        if (child.x < -120) {
          if (group === this.potatoes) this.breakCombo(); // 取り逃したらコンボ終了
          this.destroyWithShadow(child);
        }
      }
    }
  }
}
