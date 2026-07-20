// Source model: ChatGPT 5.6 Sol
import { StormAudio } from './audio';
import { advanceCheckpoint, applyFall } from './checkpoint';
import { PHYSICS, WORLD_H, WORLD_W } from './config';
import { Input } from './input';
import { CHECKPOINTS, createCollectibles, createPlatforms, ROTORS, windAt, zoneAt, type Zone } from './level';
import { clamp, damp, distance } from './math';
import { chargeRatio, jumpImpulse, resolvePlatforms, rotorHit } from './physics';
import { Renderer, type RenderState } from './render';
import { isBetter, loadBest, saveBest } from './storage';
import type { BestScore, Checkpoint, Collectible, GameMode, Particle, Platform, Player, Pulse, RunStats } from './types';

const FIXED_STEP = 1 / 120;

export class Game {
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly audio = new StormAudio();
  private player!: Player;
  private platforms: Platform[] = [];
  private collectibles: Collectible[] = [];
  private particles: Particle[] = [];
  private pulses: Pulse[] = [];
  private mode: GameMode = 'intro';
  private stats!: RunStats;
  private best: BestScore | null;
  private checkpoint: Checkpoint = CHECKPOINTS[0];
  private cameraY = 0;
  private runTime = 0;
  private accumulator = 0;
  private previousTimestamp = 0;
  private toast = '';
  private toastUntil = 0;
  private lastZone: Zone = zoneAt(0);
  private standingPlatformId: string | null = null;
  private finishNewBest = false;
  private started = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(window);
    this.best = loadBest(window.localStorage);
    this.resetState(false);
    canvas.addEventListener('pointerdown', () => {
      this.audio.enable();
      if (this.mode === 'intro') this.startRun();
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    requestAnimationFrame(this.frame);
  }

  private createPlayer(): Player {
    return {
      x: 165, y: 82, prevX: 165, prevY: 82, vx: 0, vy: 0,
      width: 32, height: 65, grounded: true, groundKind: 'normal', facing: 1,
      charging: false, chargeStarted: 0, chargeRatio: 0, coyoteUntil: 0,
      airBudget: PHYSICS.airBudget, squish: 0, invulnerableUntil: 0,
    };
  }

  private resetState(playImmediately: boolean): void {
    this.player = this.createPlayer();
    this.platforms = createPlatforms();
    this.collectibles = createCollectibles();
    this.particles = [];
    this.pulses = [];
    this.stats = { startedAt: performance.now(), elapsedMs: 0, penaltyMs: 0, falls: 0, maxHeight: 82, collected: 0 };
    this.checkpoint = CHECKPOINTS[0];
    this.cameraY = 0;
    this.runTime = 0;
    this.accumulator = 0;
    this.toast = '';
    this.toastUntil = 0;
    this.lastZone = zoneAt(0);
    this.standingPlatformId = 'floor';
    this.finishNewBest = false;
    this.mode = playImmediately ? 'playing' : 'intro';
  }

  private startRun(): void {
    this.mode = 'playing';
    this.stats.startedAt = performance.now();
    this.audio.enable();
    this.setToast('登塔开始 · 找回十二枚报时齿轮', 2.4);
  }

  private frame = (timestamp: number): void => {
    const rawDelta = this.previousTimestamp ? (timestamp - this.previousTimestamp) / 1000 : 0;
    this.previousTimestamp = timestamp;
    const frameDelta = Math.min(rawDelta, 0.05);

    this.handleGlobalInput();
    if (this.mode === 'playing') {
      this.accumulator += frameDelta;
      let loops = 0;
      while (this.accumulator >= FIXED_STEP && loops < 8) {
        this.update(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        loops += 1;
      }
    } else {
      this.updateEffects(frameDelta);
    }

    this.renderer.render(this.renderState());
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  private handleGlobalInput(): void {
    if (this.mode === 'intro' && (this.input.wasPressed('jump') || this.input.wasPressed('Enter'))) this.startRun();
    if (this.input.wasPressed('KeyR')) {
      this.resetState(true);
      this.setToast('风暴线圈已重置', 1.4);
      return;
    }
    if (this.input.wasPressed('Escape') && this.mode !== 'intro' && this.mode !== 'complete') {
      this.mode = this.mode === 'paused' ? 'playing' : 'paused';
      this.toast = '';
    }
  }

  private update(dt: number): void {
    this.runTime += dt;
    this.stats.elapsedMs += dt * 1000;
    this.updateMovingPlatforms();
    this.updatePlayer(dt);
    this.updateCollectibles();
    this.updateRotors();
    this.updateCrumblePlatforms();
    this.updateCamera(dt);
    this.updateEffects(dt);
    this.updateProgress();
    const wind = Math.abs(windAt(this.player.y, this.runTime));
    this.audio.setWind(clamp(wind / 260, 0, 1));
  }

  private updateMovingPlatforms(): void {
    for (const platform of this.platforms) {
      if (platform.kind !== 'moving' || platform.baseX === undefined) continue;
      const oldX = platform.x;
      platform.x = platform.baseX + Math.sin(this.runTime * (platform.speed ?? 1) + (platform.phase ?? 0)) * (platform.range ?? 0);
      if (this.player.grounded && this.standingPlatformId === platform.id) {
        this.player.x += platform.x - oldX;
      }
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (![p.x, p.y, p.vx, p.vy].every(Number.isFinite) || Math.abs(p.x) > WORLD_W * 3 || p.y < -320 || p.y > WORLD_H + 500) {
      this.respawn('风暴将你送回最近的锚点');
      return;
    }

    const axis = this.input.axis();
    if (axis !== 0) p.facing = axis;

    if (p.grounded) {
      p.coyoteUntil = this.runTime + 0.09;
      p.airBudget = PHYSICS.airBudget;
      const maxSpeed = p.charging ? 110 : PHYSICS.groundSpeed;
      if (axis !== 0) {
        p.vx = damp(p.vx, axis * maxSpeed, p.charging ? 5.2 : 13, dt);
      } else {
        const friction = p.groundKind === 'ice' ? PHYSICS.iceFriction : PHYSICS.groundFriction;
        p.vx = damp(p.vx, 0, friction, dt);
      }
      if (this.input.held('jump')) {
        if (!p.charging) {
          p.charging = true;
          p.chargeStarted = this.runTime * 1000;
          this.audio.play('charge', .45);
        }
        p.chargeRatio = chargeRatio(this.runTime * 1000 - p.chargeStarted);
      }
    } else if (axis !== 0 && p.airBudget > 0) {
      const desired = axis * PHYSICS.airSpeed;
      const delta = clamp(desired - p.vx, -PHYSICS.airAcceleration * dt, PHYSICS.airAcceleration * dt);
      const applied = clamp(delta, -p.airBudget, p.airBudget);
      p.vx += applied;
      p.airBudget -= Math.abs(applied);
    }

    if (p.charging && this.input.wasReleased('jump')) this.releaseJump(axis);

    p.prevX = p.x;
    p.prevY = p.y;
    const wasGrounded = p.grounded;
    p.grounded = false;
    p.groundKind = null;
    this.standingPlatformId = null;
    const wind = windAt(p.y, this.runTime);
    if (!wasGrounded) p.vx += wind * dt;
    p.vy = Math.max(PHYSICS.maxFall, p.vy + PHYSICS.gravity * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x - p.width / 2 < 48) {
      p.x = 48 + p.width / 2; p.vx = Math.max(0, p.vx) * .25;
    } else if (p.x + p.width / 2 > WORLD_W - 48) {
      p.x = WORLD_W - 48 - p.width / 2; p.vx = Math.min(0, p.vx) * .25;
    }

    const impactSpeed = Math.abs(p.vy);
    const result = resolvePlatforms(p, this.platforms, this.runTime);
    if (result.landed) {
      this.standingPlatformId = result.landed.id;
      if (!wasGrounded) this.onLand(result.landed, impactSpeed);
      if (result.landed.kind === 'spring') {
        p.grounded = false;
        this.standingPlatformId = null;
        p.airBudget = PHYSICS.airBudget * .6;
        this.audio.play('jump', 1.2);
        this.burst(p.x, p.y + 2, COLORS_CYAN, 14, 220);
      }
      if (result.landed.kind === 'crumble' && result.landed.crumbleAt === undefined) result.landed.crumbleAt = this.runTime;
      if (result.landed.checkpoint) this.activateCheckpoint(result.landed.checkpoint);
    }
    if (result.hitCeiling) this.burst(p.x, p.y + p.height, COLORS_DUST, 5, 75);

    p.squish = Math.max(0, p.squish - dt * 4.5);
    if (p.y < this.cameraY - 430) this.respawn('失足坠落 · 计时 +8 秒');
  }

  private releaseJump(axis: -1 | 0 | 1): void {
    const p = this.player;
    const held = this.runTime * 1000 - p.chargeStarted;
    const direction = axis !== 0 ? axis : p.facing;
    const impulse = jumpImpulse(held, direction);
    p.vy = impulse.vy;
    p.vx = axis === 0 ? p.vx * .35 + impulse.vx * .34 : impulse.vx;
    p.grounded = false;
    p.charging = false;
    p.chargeRatio = 0;
    p.airBudget = PHYSICS.airBudget;
    this.standingPlatformId = null;
    this.audio.play('jump', .65 + impulse.ratio * .55);
    this.burst(p.x, p.y + 3, COLORS_CYAN, 7 + Math.round(impulse.ratio * 8), 115 + impulse.ratio * 160);
    this.pulses.push({ x: p.x, y: p.y + 2, life: .28, maxLife: .28, color: 'rgba(117,229,237,ALPHA)', maxRadius: 28 + impulse.ratio * 35 });
  }

  private onLand(platform: Platform, speed: number): void {
    const p = this.player;
    if (platform.kind !== 'spring') {
      p.squish = clamp(speed / 620, .15, 1);
      this.audio.play('land', clamp(speed / 700, .35, 1));
      this.burst(p.x, p.y + 1, COLORS_DUST, 5 + Math.round(speed / 150), 55 + speed * .13);
      this.pulses.push({ x: p.x, y: p.y, life: .3, maxLife: .3, color: 'rgba(219,202,162,ALPHA)', maxRadius: 24 + speed * .035 });
    }
  }

  private updateCrumblePlatforms(): void {
    for (const platform of this.platforms) {
      if (platform.kind !== 'crumble' || platform.crumbleAt === undefined) continue;
      if (this.runTime - platform.crumbleAt > .52) {
        platform.disabledUntil = this.runTime + 2.7;
        platform.crumbleAt = undefined;
        if (this.standingPlatformId === platform.id) {
          this.player.grounded = false;
          this.standingPlatformId = null;
        }
        this.burst(platform.x + platform.w / 2, platform.y, COLORS_STONE, 15, 150);
      }
    }
  }

  private updateCollectibles(): void {
    for (const item of this.collectibles) {
      if (item.collected || distance({ x: this.player.x, y: this.player.y + 30 }, item) > 42) continue;
      item.collected = true;
      this.stats.collected += 1;
      this.audio.play('collect', .9);
      this.burst(item.x, item.y, COLORS_GOLD, 18, 220);
      this.pulses.push({ x: item.x, y: item.y, life: .55, maxLife: .55, color: 'rgba(239,195,90,ALPHA)', maxRadius: 70 });
      this.setToast(`报时齿轮已回收 · ${this.stats.collected}/12`, 1.6);
    }
  }

  private updateRotors(): void {
    if (this.runTime < this.player.invulnerableUntil) return;
    for (const rotor of ROTORS) {
      const angle = rotor.phase + this.runTime * rotor.speed;
      if (rotorHit(this.player, rotor.x, rotor.y, rotor.radius, angle)) {
        this.respawn('被失控钟摆击落 · 计时 +8 秒');
        return;
      }
    }
  }

  private activateCheckpoint(id: number): void {
    const candidate = CHECKPOINTS.find((item) => item.id === id);
    if (!candidate || candidate.id <= this.checkpoint.id) return;
    this.checkpoint = advanceCheckpoint(this.checkpoint, candidate);
    this.audio.play('checkpoint', 1);
    this.burst(candidate.x, candidate.y + 30, COLORS_CYAN, 28, 300);
    this.pulses.push({ x: candidate.x, y: candidate.y, life: .9, maxLife: .9, color: 'rgba(117,229,237,ALPHA)', maxRadius: 145 });
    this.setToast(`风暴锚点 ${id} 已点亮`, 2.4);
  }

  private respawn(message: string): void {
    const result = applyFall(this.checkpoint, this.stats.falls, this.stats.penaltyMs);
    this.stats.falls = result.falls;
    this.stats.penaltyMs = result.penaltyMs;
    this.audio.play('fall', .8);
    this.burst(this.player.x, this.player.y + 30, COLORS_DANGER, 20, 280);
    this.player = this.createPlayer();
    this.player.x = result.checkpoint.x;
    this.player.y = result.checkpoint.y + 2;
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.player.invulnerableUntil = this.runTime + 1.1;
    this.cameraY = clamp(result.checkpoint.y - 145, 0, WORLD_H - 540);
    this.standingPlatformId = result.checkpoint.id === 0 ? 'floor' : result.checkpoint.id === 1 ? 'g03' : 'i02';
    this.setToast(message, 2.3);
  }

  private updateCamera(dt: number): void {
    const target = clamp(this.player.y - 178, 0, WORLD_H - 540);
    this.cameraY = damp(this.cameraY, target, target > this.cameraY ? 3.7 : 2.25, dt);
  }

  private updateProgress(): void {
    this.stats.maxHeight = Math.max(this.stats.maxHeight, clamp(this.player.y, 0, 4465));
    const zone = zoneAt(this.player.y);
    if (zone.name !== this.lastZone.name) {
      this.lastZone = zone;
      this.setToast(`${zone.name} · ${zone.subtitle}`, 2.5);
      this.pulses.push({ x: this.player.x, y: this.player.y, life: .7, maxLife: .7, color: 'rgba(159,134,255,ALPHA)', maxRadius: 110 });
    }
    if (this.player.y >= 4445 && this.mode === 'playing') this.complete();
  }

  private complete(): void {
    this.mode = 'complete';
    this.stats.maxHeight = 4465;
    this.finishNewBest = isBetter({
      timeMs: this.stats.elapsedMs + this.stats.penaltyMs,
      falls: this.stats.falls,
      collected: this.stats.collected,
      completedAt: new Date().toISOString(),
    }, this.best);
    this.best = saveBest(window.localStorage, this.stats, this.best);
    this.audio.play('complete', 1);
    this.burst(450, 4485, COLORS_GOLD, 65, 430);
    for (let i = 0; i < 4; i += 1) this.pulses.push({ x: 450, y: 4490, life: 1.4 + i * .18, maxLife: 1.4 + i * .18, color: 'rgba(239,195,90,ALPHA)', maxRadius: 110 + i * 55 });
  }

  private updateEffects(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const pulse of this.pulses) pulse.life -= dt;
    this.pulses = this.pulses.filter((pulse) => pulse.life > 0);
  }

  private burst(x: number, y: number, palette: string[], count: number, speed: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const force = speed * (.35 + Math.random() * .65);
      this.particles.push({
        x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force,
        life: .34 + Math.random() * .62, maxLife: .96,
        color: palette[i % palette.length], size: 2 + Math.random() * 5.5, gravity: -250,
      });
    }
  }

  private setToast(message: string, seconds: number): void {
    this.toast = message;
    this.toastUntil = this.runTime + seconds;
  }

  private renderState(): RenderState {
    return {
      mode: this.mode, time: this.runTime, cameraY: this.cameraY,
      player: this.player, platforms: this.platforms, collectibles: this.collectibles,
      rotors: ROTORS, particles: this.particles, pulses: this.pulses, stats: this.stats,
      best: this.best, activeCheckpoint: this.checkpoint.id, zone: zoneAt(this.player.y),
      wind: windAt(this.player.y, this.runTime), toast: this.toast, toastUntil: this.toastUntil,
      finishNewBest: this.finishNewBest,
    };
  }

  debugComplete(): void {
    if (this.mode === 'intro') this.startRun();
    this.player.x = 450;
    this.player.y = 4455;
    this.player.prevY = 4440;
    this.stats.elapsedMs = Math.max(this.stats.elapsedMs, 126430);
    this.stats.collected = Math.max(this.stats.collected, 10);
    this.stats.maxHeight = 4465;
    this.cameraY = WORLD_H - 540;
    this.complete();
  }

  debugAscend(height = 2380): void {
    if (this.mode === 'intro') this.startRun();
    this.player.x = 520;
    this.player.y = clamp(height, 100, 4400);
    this.player.prevY = this.player.y;
    this.player.vx = 80;
    this.player.vy = 120;
    this.player.grounded = false;
    this.stats.maxHeight = this.player.y;
    this.cameraY = clamp(this.player.y - 190, 0, WORLD_H - 540);
  }
}

const COLORS_CYAN = ['rgba(117,229,237,ALPHA)', 'rgba(216,252,255,ALPHA)'];
const COLORS_DUST = ['rgba(202,191,166,ALPHA)', 'rgba(116,128,145,ALPHA)'];
const COLORS_STONE = ['rgba(127,101,96,ALPHA)', 'rgba(71,67,77,ALPHA)'];
const COLORS_GOLD = ['rgba(239,195,90,ALPHA)', 'rgba(255,239,169,ALPHA)'];
const COLORS_DANGER = ['rgba(239,108,98,ALPHA)', 'rgba(166,69,79,ALPHA)'];
