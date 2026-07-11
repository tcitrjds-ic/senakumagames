import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_HEIGHT,
  FLOOR_TOP,
  PLAYER_HEIGHT,
  FONT_FAMILY,
  loadHighScore,
  saveHighScore,
} from '../constants';

const START_SPEED = 280;
const MAX_SPEED = 600;
const SPEED_PER_SEC = 9;
const JUMP_VELOCITY = -750;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private potatoes!: Phaser.Physics.Arcade.Group;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreIcon!: Phaser.GameObjects.Image;

  private speed = START_SPEED;
  private score = 0;
  private jumpsLeft = 2;
  private isOver = false;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Game');
  }

  create(): void {
    this.speed = START_SPEED;
    this.score = 0;
    this.jumpsLeft = 2;
    this.isOver = false;

    this.clouds = this.add
      .tileSprite(GAME_WIDTH / 2, 120, GAME_WIDTH, 128, 'cloud')
      .setAlpha(0.9);
    this.ground = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT - GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT,
      'ground',
    );

    // 床（見た目は ground タイル、当たり判定はこの不可視ゾーン）
    const floor = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT);
    this.physics.add.existing(floor, true);

    this.player = this.physics.add.sprite(180, FLOOR_TOP - PLAYER_HEIGHT, 'player');
    this.player.setScale(PLAYER_HEIGHT / this.player.height);
    // 切り抜き画像の余白ぶん、当たり判定は少し内側に絞る
    this.player.body!.setSize(this.player.width * 0.55, this.player.height * 0.9, true);
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, floor);

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.potatoes = this.physics.add.group({ allowGravity: false, immovable: true });

    this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver());
    this.physics.add.overlap(this.player, this.potatoes, (_p, potato) =>
      this.collect(potato as Phaser.Physics.Arcade.Sprite),
    );

    this.scoreIcon = this.add.image(36, 36, 'potato').setScale(0.4).setDepth(10);
    this.scoreText = this.add
      .text(64, 22, '× 0', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#8a5a44',
      })
      .setStroke('#ffffff', 8)
      .setDepth(10);

    const best = loadHighScore();
    this.add
      .text(GAME_WIDTH - 20, 22, best > 0 ? `ハイスコア ${best}` : '', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#b8860b',
      })
      .setOrigin(1, 0)
      .setStroke('#ffffff', 6)
      .setDepth(10);

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
    const rock = this.obstacles.create(
      GAME_WIDTH + 80,
      0,
      'rock',
    ) as Phaser.Physics.Arcade.Sprite;
    rock.setScale(scale);
    rock.setY(FLOOR_TOP - (rock.height * scale) / 2 + 6);
    rock.body!.setSize(rock.width * 0.8, rock.height * 0.75, true);
    rock.setVelocityX(-this.speed);
  }

  private spawnPotatoes(): void {
    // 3本のポテトをアーチ状 or 一直線に並べる
    const lineY = Phaser.Math.RND.pick([FLOOR_TOP - 50, FLOOR_TOP - 160, FLOOR_TOP - 250]);
    const arc = Math.random() < 0.5;
    for (let i = 0; i < 3; i++) {
      const y = arc ? lineY - Math.sin((i / 2) * Math.PI) * 55 : lineY;
      const potato = this.potatoes.create(
        GAME_WIDTH + 80 + i * 78,
        y,
        'potato',
      ) as Phaser.Physics.Arcade.Sprite;
      potato.setScale(0.45);
      potato.body!.setSize(potato.width * 0.7, potato.height * 0.7, true);
      potato.setVelocityX(-this.speed);
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
    potato.destroy();
    this.score += 1;
    this.scoreText.setText(`× ${this.score}`);
    this.tweens.add({
      targets: this.scoreIcon,
      scale: { from: 0.55, to: 0.4 },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  private gameOver(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.spawnTimer?.remove();
    this.player.setTexture('player_hit');
    this.physics.pause();
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(200, 255, 160, 160);
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

    this.time.delayedCall(700, () => {
      this.scene.start('GameOver', { score: this.score, best: Math.max(best, this.score), isNewBest });
    });
  }

  update(time: number, delta: number): void {
    if (this.isOver) return;
    const dt = delta / 1000;

    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_PER_SEC * dt);
    this.ground.tilePositionX += this.speed * dt;
    this.clouds.tilePositionX += this.speed * 0.15 * dt;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) {
      this.jumpsLeft = 2;
      if (this.player.texture.key !== 'player') this.player.setTexture('player'); // 着地で表情を戻す
      // 走りの「ゆらゆら」（切り抜き1枚でもそれっぽく見せる）
      this.player.angle = Math.sin(time / 90) * 4;
    } else {
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
