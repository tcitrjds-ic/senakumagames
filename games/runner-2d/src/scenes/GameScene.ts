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
import { buildBackground, hudPill, Parallax } from '../ui';

const START_SPEED = 280;
const MAX_SPEED = 600;
const SPEED_PER_SEC = 9;
const JUMP_VELOCITY = -750;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private bg!: Parallax;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private potatoes!: Phaser.Physics.Arcade.Group;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreIcon!: Phaser.GameObjects.Image;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;

  private speed = START_SPEED;
  private score = 0;
  private jumpsLeft = 2;
  private isOver = false;
  private wasAirborne = false;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Game');
  }

  create(): void {
    this.speed = START_SPEED;
    this.score = 0;
    this.jumpsLeft = 2;
    this.isOver = false;
    this.wasAirborne = false;

    this.bg = buildBackground(this);

    const floor = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT);
    this.physics.add.existing(floor, true);

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

    // HUD
    hudPill(this, 16, 14, 190, 48);
    this.scoreIcon = this.add.image(46, 38, 'potato').setScale(0.3).setDepth(10);
    this.scoreText = this.add
      .text(74, 38, '× 0', {
        fontFamily: FONT_FAMILY, fontSize: '28px', fontStyle: 'bold', color: '#8a5a44',
      })
      .setOrigin(0, 0.5)
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

    this.input.on('pointerdown', () => this.jump());
    this.input.keyboard?.on('keydown-SPACE', () => this.jump());
    this.input.keyboard?.on('keydown-UP', () => this.jump());

    this.scheduleNextSpawn(600);
  }

  private jump(): void {
    if (this.isOver) return;
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
      if (Math.random() < 0.55) {
        this.spawnPotatoes();
      } else {
        this.spawnRock();
      }
      this.scheduleNextSpawn();
    });
  }

  private spawnRock(): void {
    const scale = Phaser.Math.FloatBetween(0.55, 0.95);
    const rock = this.obstacles.create(GAME_WIDTH + 80, 0, 'rock') as Phaser.Physics.Arcade.Sprite;
    rock.setScale(scale);
    rock.setY(FLOOR_TOP - (rock.height * scale) / 2 + 10);
    rock.body!.setSize(rock.width * 0.72, rock.height * 0.66, true);
    rock.setVelocityX(-this.speed);
    rock.setDepth(8);
  }

  private spawnPotatoes(): void {
    // 3本のポテトをアーチ状 or 一直線に並べる
    const lineY = Phaser.Math.RND.pick([FLOOR_TOP - 50, FLOOR_TOP - 160, FLOOR_TOP - 250]);
    const arc = Math.random() < 0.5;
    for (let i = 0; i < 3; i++) {
      const y = arc ? lineY - Math.sin((i / 2) * Math.PI) * 55 : lineY;
      const potato = this.potatoes.create(GAME_WIDTH + 80 + i * 78, y, 'potato') as Phaser.Physics.Arcade.Sprite;
      potato.setScale(0.42);
      potato.body!.setSize(potato.width * 0.66, potato.height * 0.66, true);
      potato.setVelocityX(-this.speed);
      potato.setDepth(8);
      this.tweens.add({
        targets: potato,
        angle: { from: -8, to: 8 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private collect(potato: Phaser.Physics.Arcade.Sprite): void {
    if (this.isOver) return;
    const px = potato.x;
    const py = potato.y;
    potato.destroy();
    this.score += 1;
    this.scoreText.setText(`× ${this.score}`);
    AudioBox.play('coin');
    this.sparkles.explode(9, px, py);
    const pop = this.add
      .text(px, py - 16, '+1', {
        fontFamily: FONT_FAMILY, fontSize: '26px', fontStyle: 'bold', color: '#ff8fa8',
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

  private gameOver(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.spawnTimer?.remove();
    this.physics.pause();
    AudioBox.play('hit');
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(200, 255, 160, 160);

    // 実況サムネ風の泣き顔カットイン
    const cutIn = this.add
      .image(this.player.x + 170, this.player.y - 120, 'face_cry')
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

    const best = loadHighScore();
    const isNewBest = this.score > best;
    if (isNewBest) saveHighScore(this.score);

    this.time.delayedCall(900, () => {
      this.scene.start('GameOver', { score: this.score, best: Math.max(best, this.score), isNewBest });
    });
  }

  update(time: number, delta: number): void {
    if (this.isOver) return;
    const dt = delta / 1000;

    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_PER_SEC * dt);
    this.bg.ground.tilePositionX += this.speed * dt;
    this.bg.hillsNear.tilePositionX += this.speed * 0.28 * dt;
    this.bg.hillsFar.tilePositionX += this.speed * 0.12 * dt;
    this.bg.clouds.tilePositionX += this.speed * 0.05 * dt;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) {
      this.jumpsLeft = 2;
      if (this.wasAirborne) {
        // 着地の演出
        this.wasAirborne = false;
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
      // 走りの「ゆらゆら」（切り抜き1枚でもそれっぽく見せる）
      this.player.angle = Math.sin(time / 90) * 4;
    } else {
      this.wasAirborne = true;
      // 空中では速度に応じて前傾/後傾
      this.player.angle = Phaser.Math.Clamp(body.velocity.y * 0.018, -14, 16);
    }

    for (const group of [this.obstacles, this.potatoes]) {
      for (const child of group.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        child.body!.velocity.x = -this.speed;
        if (child.x < -120) child.destroy();
      }
    }
  }
}
