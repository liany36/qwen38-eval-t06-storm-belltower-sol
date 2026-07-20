// Source model: ChatGPT 5.6 Sol
import { COLORS, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config';
import { clamp, formatTime, seededNoise } from './math';
import type { BestScore, Collectible, GameMode, Particle, Platform, Player, Pulse, Rotor, RunStats } from './types';
import type { Zone } from './level';

export interface RenderState {
  mode: GameMode;
  time: number;
  cameraY: number;
  player: Player;
  platforms: Platform[];
  collectibles: Collectible[];
  rotors: Rotor[];
  particles: Particle[];
  pulses: Pulse[];
  stats: RunStats;
  best: BestScore | null;
  activeCheckpoint: number;
  zone: Zone;
  wind: number;
  toast: string;
  toastUntil: number;
  finishNewBest: boolean;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.scale = Math.min(width / VIEW_W, height / VIEW_H);
    this.offsetX = (width - VIEW_W * this.scale) / 2;
    this.offsetY = (height - VIEW_H * this.scale) / 2;
  };

  private beginLogical(): void {
    this.ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.offsetX, this.dpr * this.offsetY);
  }

  private sy(worldY: number, cameraY: number): number { return VIEW_H - (worldY - cameraY); }
  private sx(worldX: number): number { return (VIEW_W - WORLD_W) / 2 + worldX; }

  render(state: RenderState): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#02050b';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.beginLogical();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();
    this.drawBackground(state);
    this.drawTower(state);
    this.drawParticles(state, false);
    this.drawWorld(state);
    this.drawParticles(state, true);
    this.drawWeather(state);
    this.drawHud(state);
    if (state.mode === 'intro') this.drawIntro(state);
    if (state.mode === 'paused') this.drawPause();
    if (state.mode === 'complete') this.drawResult(state);
    ctx.restore();
  }

  private drawBackground(state: RenderState): void {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, '#0c1730');
    gradient.addColorStop(0.46, '#10192a');
    gradient.addColorStop(1, '#050914');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const flash = Math.max(0, Math.sin(state.time * 0.39 - 1.3) - 0.985) * 35;
    if (flash > 0) {
      ctx.fillStyle = `rgba(190,220,255,${Math.min(.22, flash)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.strokeStyle = 'rgba(218,233,255,.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(766, 0); ctx.lineTo(735, 73); ctx.lineTo(767, 63); ctx.lineTo(720, 154);
      ctx.stroke();
    }

    // Far storm clouds — first parallax layer.
    for (let i = 0; i < 13; i += 1) {
      const drift = (state.time * (6 + i % 3) + i * 103) % 1200;
      const x = drift - 120;
      const y = 55 + (i % 5) * 78 + (state.cameraY * 0.05) % 55;
      ctx.fillStyle = `rgba(80,99,130,${0.07 + (i % 3) * .025})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 115, 26, -0.08, 0, Math.PI * 2);
      ctx.ellipse(x + 70, y - 8, 90, 22, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant ruined city — second parallax layer.
    const cityShift = (state.cameraY * 0.11) % 140;
    ctx.fillStyle = '#0a1020';
    for (let i = 0; i < 18; i += 1) {
      const x = i * 61 - 30;
      const h = 80 + seededNoise(i + 31) * 170;
      ctx.fillRect(x, VIEW_H - h + cityShift, 45, h + 80);
      if (i % 3 === 0) {
        ctx.beginPath(); ctx.moveTo(x - 4, VIEW_H - h + cityShift); ctx.lineTo(x + 21, VIEW_H - h - 36 + cityShift); ctx.lineTo(x + 49, VIEW_H - h + cityShift); ctx.fill();
      }
      ctx.fillStyle = 'rgba(210,164,78,.1)';
      for (let w = 0; w < 3; w += 1) ctx.fillRect(x + 8 + w * 12, VIEW_H - h + 25 + cityShift, 4, 8);
      ctx.fillStyle = '#0a1020';
    }

    // Mid-distance flying buttresses — third parallax layer.
    const buttressShift = (state.cameraY * 0.28) % 230;
    ctx.strokeStyle = 'rgba(28,42,65,.85)';
    ctx.lineWidth = 18;
    for (let i = -1; i < 6; i += 1) {
      const y = i * 160 + buttressShift;
      ctx.beginPath(); ctx.arc(95, y, 155, 0.1, 1.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(VIEW_W - 95, y + 45, 155, 1.85, 3.02); ctx.stroke();
    }
  }

  private drawTower(state: RenderState): void {
    const ctx = this.ctx;
    const left = this.sx(0);
    const right = this.sx(WORLD_W);
    const masonry = ctx.createLinearGradient(left, 0, right, 0);
    masonry.addColorStop(0, '#172033');
    masonry.addColorStop(.08, '#222e43');
    masonry.addColorStop(.16, 'rgba(16,25,41,.68)');
    masonry.addColorStop(.5, 'rgba(8,14,27,.28)');
    masonry.addColorStop(.84, 'rgba(16,25,41,.68)');
    masonry.addColorStop(.92, '#222e43');
    masonry.addColorStop(1, '#172033');
    ctx.fillStyle = masonry;
    ctx.fillRect(left, 0, WORLD_W, VIEW_H);

    const brickOffset = (state.cameraY % 52 + 52) % 52;
    ctx.strokeStyle = 'rgba(130,151,170,.055)';
    ctx.lineWidth = 1;
    for (let row = -1; row < 13; row += 1) {
      const y = VIEW_H - row * 52 + brickOffset;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      const offset = row % 2 ? 30 : 0;
      for (let x = left + offset; x < right; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 52); ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(2,5,12,.48)';
    ctx.fillRect(left, 0, 42, VIEW_H);
    ctx.fillRect(right - 42, 0, 42, VIEW_H);
    ctx.strokeStyle = 'rgba(199,163,82,.2)';
    ctx.lineWidth = 3;
    ctx.strokeRect(left + 42, -10, WORLD_W - 84, VIEW_H + 20);

    // Tall arched windows track world space.
    for (let y = 520; y < WORLD_H; y += 720) {
      const sy = this.sy(y, state.cameraY);
      if (sy < -180 || sy > VIEW_H + 100) continue;
      ctx.save();
      ctx.translate(this.sx(y % 1440 === 520 ? 92 : 668), sy);
      const g = ctx.createLinearGradient(0, -110, 0, 75);
      g.addColorStop(0, 'rgba(82,125,176,.3)'); g.addColorStop(1, 'rgba(23,36,62,.08)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, -45); ctx.arc(70, -45, 70, Math.PI, 0); ctx.lineTo(140, 70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(137,167,195,.2)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(70, -112); ctx.lineTo(70, 70); ctx.moveTo(4, -32); ctx.lineTo(136, -32); ctx.stroke();
      ctx.restore();
    }
  }

  private drawWorld(state: RenderState): void {
    for (const platform of state.platforms) this.drawPlatform(platform, state);
    for (const rotor of state.rotors) this.drawRotor(rotor, state);
    for (const collectible of state.collectibles) if (!collectible.collected) this.drawCollectible(collectible, state);
    this.drawFinish(state);
    this.drawPlayer(state.player, state);
  }

  private drawPlatform(platform: Platform, state: RenderState): void {
    const sy = this.sy(platform.y, state.cameraY);
    if (sy < -60 || sy > VIEW_H + 50 || (platform.disabledUntil && platform.disabledUntil > state.time)) return;
    const ctx = this.ctx;
    const x = this.sx(platform.x);
    const y = sy;
    ctx.save();
    ctx.translate(x, y);
    if (platform.kind === 'moving') {
      ctx.strokeStyle = 'rgba(215,169,75,.35)'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.moveTo(-(platform.range ?? 0), 9); ctx.lineTo(platform.w + (platform.range ?? 0), 9); ctx.stroke(); ctx.setLineDash([]);
    }
    if (platform.kind === 'oneway') {
      ctx.fillStyle = 'rgba(117,229,237,.2)'; ctx.fillRect(0, -4, platform.w, 8);
      ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(platform.w, 0); ctx.stroke();
      for (let px = 12; px < platform.w; px += 26) { ctx.beginPath(); ctx.moveTo(px - 5, 4); ctx.lineTo(px, -2); ctx.lineTo(px + 5, 4); ctx.stroke(); }
      ctx.restore(); return;
    }
    const colors: Record<Platform['kind'], [string, string]> = {
      normal: ['#596578', '#202b3d'], moving: ['#8b754b', '#3b3227'], crumble: ['#7d6260', '#32262c'],
      spring: ['#567a68', '#20362f'], oneway: ['#426f73', '#1c353b'], ice: ['#9bdbea', '#305c70'], checkpoint: ['#8e7442', '#322b22'],
    };
    const [top, side] = colors[platform.kind];
    ctx.fillStyle = side; ctx.beginPath(); ctx.roundRect(0, 0, platform.w, platform.h, 4); ctx.fill();
    ctx.fillStyle = top; ctx.beginPath(); ctx.roundRect(0, -5, platform.w, 9, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(242,235,210,.16)'; ctx.lineWidth = 1; ctx.strokeRect(4, 5, platform.w - 8, platform.h - 9);
    if (platform.kind === 'crumble') {
      ctx.strokeStyle = '#c9938f'; ctx.lineWidth = 2;
      for (let i = 24; i < platform.w; i += 45) { ctx.beginPath(); ctx.moveTo(i, -3); ctx.lineTo(i - 8, 8); ctx.lineTo(i + 3, 15); ctx.stroke(); }
    }
    if (platform.kind === 'spring') {
      ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 3;
      for (let i = 16; i < platform.w - 10; i += 28) { ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i + 7, -14); ctx.lineTo(i + 14, -5); ctx.stroke(); }
    }
    if (platform.kind === 'ice') {
      ctx.fillStyle = 'rgba(214,249,255,.32)'; ctx.fillRect(8, -5, platform.w - 16, 4);
      ctx.strokeStyle = 'rgba(210,248,255,.5)'; ctx.beginPath(); ctx.moveTo(30, 6); ctx.lineTo(55, 14); ctx.lineTo(77, 5); ctx.stroke();
    }
    if (platform.kind === 'moving') {
      ctx.fillStyle = COLORS.brass; ctx.beginPath(); ctx.arc(14, 11, 5, 0, Math.PI * 2); ctx.arc(platform.w - 14, 11, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (platform.kind === 'checkpoint') {
      const active = (platform.checkpoint ?? 0) <= state.activeCheckpoint;
      ctx.strokeStyle = active ? COLORS.cyan : '#8d96a4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(platform.w / 2, -5); ctx.lineTo(platform.w / 2, -65); ctx.stroke();
      ctx.fillStyle = active ? 'rgba(117,229,237,.75)' : 'rgba(110,119,135,.65)';
      ctx.beginPath(); ctx.moveTo(platform.w / 2 + 2, -62); ctx.lineTo(platform.w / 2 + 38, -50); ctx.lineTo(platform.w / 2 + 2, -37); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  private drawRotor(rotor: Rotor, state: RenderState): void {
    const sy = this.sy(rotor.y, state.cameraY);
    if (sy < -rotor.radius - 30 || sy > VIEW_H + rotor.radius + 30) return;
    const ctx = this.ctx;
    const x = this.sx(rotor.x);
    const angle = rotor.phase + state.time * rotor.speed;
    ctx.save(); ctx.translate(x, sy); ctx.rotate(-angle);
    ctx.strokeStyle = '#7f6d50'; ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(239,108,98,.45)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(-rotor.radius, 0); ctx.lineTo(rotor.radius, 0); ctx.stroke();
    ctx.fillStyle = COLORS.danger;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * rotor.radius, 0); ctx.rotate(side < 0 ? Math.PI : 0);
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(22, 0); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.fillStyle = '#c6a860'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20293a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawCollectible(item: Collectible, state: RenderState): void {
    const y = this.sy(item.y + Math.sin(state.time * 3 + item.phase) * 7, state.cameraY);
    if (y < -40 || y > VIEW_H + 40) return;
    const x = this.sx(item.x);
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(state.time * .9 + item.phase);
    ctx.shadowColor = COLORS.brass; ctx.shadowBlur = 18; ctx.fillStyle = '#e2bd62';
    ctx.beginPath();
    for (let i = 0; i < 16; i += 1) { const r = i % 2 ? 14 : 20; const a = i * Math.PI / 8; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#30291e'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff2bd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  private drawFinish(state: RenderState): void {
    const y = this.sy(4515, state.cameraY);
    if (y < -180 || y > VIEW_H + 190) return;
    const ctx = this.ctx;
    const x = this.sx(450);
    ctx.save(); ctx.translate(x, y);
    const glow = .18 + Math.sin(state.time * 2.5) * .06;
    ctx.fillStyle = `rgba(255,210,89,${glow})`; ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#665534'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-55, -78); ctx.quadraticCurveTo(0, -112, 55, -78); ctx.stroke();
    ctx.fillStyle = '#bd8d39'; ctx.beginPath(); ctx.moveTo(-63, -70); ctx.quadraticCurveTo(-65, 10, -78, 50); ctx.quadraticCurveTo(0, 82, 78, 50); ctx.quadraticCurveTo(65, 10, 63, -70); ctx.closePath(); ctx.fill();
    const bellG = ctx.createLinearGradient(-50, 0, 60, 0); bellG.addColorStop(0, '#73501f'); bellG.addColorStop(.5, '#f1c65f'); bellG.addColorStop(1, '#6d491c');
    ctx.fillStyle = bellG; ctx.beginPath(); ctx.moveTo(-55, -66); ctx.quadraticCurveTo(0, -93, 55, -66); ctx.lineTo(73, 44); ctx.quadraticCurveTo(0, 68, -73, 44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e5b84f'; ctx.beginPath(); ctx.arc(0, 61, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.cream; ctx.textAlign = 'center'; ctx.font = '600 12px "Segoe UI"'; ctx.letterSpacing = '3px'; ctx.fillText('唤 醒 风 暴 之 钟', 0, 108); ctx.restore();
  }

  private drawPlayer(player: Player, state: RenderState): void {
    const ctx = this.ctx;
    const x = this.sx(player.x);
    const y = this.sy(player.y, state.cameraY);
    const run = state.time * (8 + Math.abs(player.vx) * .025);
    const airborne = !player.grounded;
    const squash = clamp(player.squish, 0, 1);
    const sx = 1 + squash * .18;
    const sy = 1 - squash * .22;
    ctx.save(); ctx.translate(x, y); ctx.scale(player.facing * sx, sy);

    // Charge aura and ground rings.
    if (player.charging) {
      const radius = 26 + player.chargeRatio * 18 + Math.sin(state.time * 18) * 2;
      ctx.strokeStyle = `rgba(117,229,237,${.25 + player.chargeRatio * .65})`; ctx.lineWidth = 2 + player.chargeRatio * 3;
      ctx.beginPath(); ctx.arc(0, -24, radius, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i += 1) { const a = state.time * 5 + i * 1.57; ctx.fillStyle = COLORS.cyan; ctx.fillRect(Math.cos(a) * radius - 1, -24 + Math.sin(a) * radius - 1, 3, 3); }
    }

    // Original hero: Nima, a brass-masked storm courier with split ribbon cape.
    ctx.strokeStyle = '#22283a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const legSwing = airborne ? (player.vy > 0 ? -0.45 : .45) : Math.sin(run) * Math.min(1, Math.abs(player.vx) / 170) * .45;
    ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(-10 + legSwing * 12, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -14); ctx.lineTo(10 - legSwing * 12, 3); ctx.stroke();
    ctx.strokeStyle = '#c7a956'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-17, 2); ctx.lineTo(-4, 2); ctx.moveTo(5, 2); ctx.lineTo(18, 2); ctx.stroke();

    const capeLift = airborne ? 11 : Math.min(9, Math.abs(player.vx) * .03);
    ctx.fillStyle = '#7b3f5f'; ctx.beginPath(); ctx.moveTo(-10, -42); ctx.quadraticCurveTo(-30 - capeLift, -35, -33 - capeLift, -8); ctx.lineTo(-16, -18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a75971'; ctx.beginPath(); ctx.moveTo(-8, -40); ctx.quadraticCurveTo(-20 - capeLift, -31, -20 - capeLift, -5); ctx.lineTo(-7, -18); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#24364a'; ctx.beginPath(); ctx.roundRect(-15, -44, 30, 31, 9); ctx.fill();
    ctx.fillStyle = '#d7a94b'; ctx.fillRect(-12, -35, 24, 4);
    ctx.fillStyle = '#7ce5e8'; ctx.beginPath(); ctx.arc(5, -30, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#d0aa5a'; ctx.beginPath(); ctx.roundRect(-14, -68, 28, 27, 10); ctx.fill();
    ctx.fillStyle = '#293446'; ctx.beginPath(); ctx.roundRect(-10, -62, 22, 13, 5); ctx.fill();
    ctx.fillStyle = '#8df3f2'; ctx.beginPath(); ctx.ellipse(5, -55, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#dab85f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -68); ctx.lineTo(-16, -78); ctx.moveTo(8, -68); ctx.lineTo(14, -80); ctx.stroke();
    ctx.fillStyle = '#87d9e4'; ctx.beginPath(); ctx.moveTo(13, -80); ctx.lineTo(20, -72); ctx.lineTo(14, -69); ctx.closePath(); ctx.fill();

    const arm = airborne ? -0.7 : Math.sin(run + Math.PI) * .35;
    ctx.strokeStyle = '#c9a75c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(12, -37); ctx.lineTo(20 + Math.cos(arm) * 5, -24 + Math.sin(arm) * 7); ctx.stroke();
    ctx.restore();
  }

  private drawParticles(state: RenderState, foreground: boolean): void {
    const ctx = this.ctx;
    for (const particle of state.particles) {
      if ((particle.size >= 5) !== foreground) continue;
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color.replace('ALPHA', alpha.toFixed(3));
      ctx.beginPath(); ctx.arc(this.sx(particle.x), this.sy(particle.y, state.cameraY), particle.size * alpha, 0, Math.PI * 2); ctx.fill();
    }
    for (const pulse of state.pulses) {
      const progress = 1 - pulse.life / pulse.maxLife;
      ctx.strokeStyle = pulse.color.replace('ALPHA', (1 - progress).toFixed(3)); ctx.lineWidth = 3 * (1 - progress);
      ctx.beginPath(); ctx.arc(this.sx(pulse.x), this.sy(pulse.y, state.cameraY), pulse.maxRadius * progress, 0, Math.PI * 2); ctx.stroke();
    }
  }

  private drawWeather(state: RenderState): void {
    const ctx = this.ctx;
    const windLean = clamp(state.wind / 250, -1, 1) * 17;
    ctx.strokeStyle = 'rgba(171,205,226,.22)'; ctx.lineWidth = 1;
    for (let i = 0; i < 95; i += 1) {
      const speed = 280 + seededNoise(i + 10) * 260;
      const y = (seededNoise(i + 20) * VIEW_H + state.time * speed) % (VIEW_H + 40) - 20;
      const x = (seededNoise(i + 80) * (VIEW_W + 120) + state.time * (45 + windLean * 2)) % (VIEW_W + 120) - 60;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7 - windLean, y + 20); ctx.stroke();
    }
    if (Math.abs(state.wind) > 20) {
      ctx.strokeStyle = 'rgba(161,205,236,.28)';
      for (let i = 0; i < 12; i += 1) {
        const y = (i * 49 + state.time * 80) % VIEW_H;
        const x = ((i * 127 + state.time * state.wind * .4) % 1100) - 70;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 55, y - 10, x + 115, y + 2); ctx.stroke();
      }
    }
  }

  private panel(x: number, y: number, w: number, h: number, alpha = .78): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(5,10,20,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(205,177,105,.28)'; ctx.lineWidth = 1; ctx.stroke();
  }

  private drawHud(state: RenderState): void {
    const ctx = this.ctx;
    this.panel(18, 16, 260, 72);
    ctx.fillStyle = COLORS.cream; ctx.font = '700 18px "Segoe UI"'; ctx.fillText(state.zone.name, 34, 42);
    ctx.fillStyle = state.zone.color; ctx.font = '600 9px "Segoe UI"'; ctx.letterSpacing = '2px'; ctx.fillText(state.zone.subtitle, 34, 60);
    ctx.fillStyle = 'rgba(235,240,245,.5)'; ctx.font = '11px "Segoe UI"'; ctx.letterSpacing = '0px'; ctx.fillText(`高度 ${Math.floor(state.stats.maxHeight)} / 4465 m`, 34, 78);

    this.panel(VIEW_W - 267, 16, 249, 72);
    ctx.font = '600 11px "Segoe UI"'; ctx.fillStyle = 'rgba(239,235,217,.6)';
    ctx.fillText('TIME', VIEW_W - 250, 38); ctx.fillText('FALLS', VIEW_W - 152, 38); ctx.fillText('COGS', VIEW_W - 83, 38);
    ctx.fillStyle = COLORS.cream; ctx.font = '700 16px ui-monospace, monospace';
    ctx.fillText(formatTime(state.stats.elapsedMs + state.stats.penaltyMs), VIEW_W - 250, 64);
    ctx.fillText(String(state.stats.falls).padStart(2, '0'), VIEW_W - 145, 64);
    ctx.fillStyle = COLORS.brass; ctx.fillText(`${state.stats.collected}/12`, VIEW_W - 82, 64);

    const progress = clamp(state.stats.maxHeight / 4465, 0, 1);
    ctx.fillStyle = 'rgba(5,10,19,.72)'; ctx.fillRect(VIEW_W - 13, 105, 4, 330);
    ctx.fillStyle = state.zone.color; ctx.fillRect(VIEW_W - 13, 435 - progress * 330, 4, progress * 330);
    for (const marker of [0, 900, 1800, 2750, 3650, 4465]) {
      const my = 435 - marker / 4465 * 330;
      ctx.fillStyle = 'rgba(232,224,198,.6)'; ctx.fillRect(VIEW_W - 17, my, 12, 1);
    }

    if (state.player.grounded && state.player.charging) {
      const w = 230;
      this.panel(VIEW_W / 2 - w / 2, VIEW_H - 57, w, 34, .68);
      const gradient = ctx.createLinearGradient(VIEW_W / 2 - 98, 0, VIEW_W / 2 + 98, 0);
      gradient.addColorStop(0, COLORS.cyan); gradient.addColorStop(.72, COLORS.violet); gradient.addColorStop(1, '#fff4ba');
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(VIEW_W / 2 - 98, VIEW_H - 43, 196, 7);
      ctx.fillStyle = gradient; ctx.fillRect(VIEW_W / 2 - 98, VIEW_H - 43, 196 * state.player.chargeRatio, 7);
      ctx.fillStyle = COLORS.cream; ctx.font = '600 10px "Segoe UI"'; ctx.textAlign = 'center'; ctx.fillText('松开空格 · 释放跃升', VIEW_W / 2, VIEW_H - 48); ctx.textAlign = 'start';
    }

    if (state.toastUntil > state.time && state.toast) {
      const alpha = clamp((state.toastUntil - state.time) * 2, 0, 1);
      ctx.globalAlpha = alpha; this.panel(VIEW_W / 2 - 165, 106, 330, 48, .82);
      ctx.fillStyle = COLORS.cream; ctx.textAlign = 'center'; ctx.font = '700 15px "Segoe UI"'; ctx.fillText(state.toast, VIEW_W / 2, 136); ctx.textAlign = 'start'; ctx.globalAlpha = 1;
    }
  }

  private drawIntro(state: RenderState): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(2,5,11,.62)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.brass; ctx.font = '600 12px "Segoe UI"'; ctx.letterSpacing = '8px'; ctx.fillText('AN ORIGINAL ASCENT', VIEW_W / 2, 107);
    ctx.fillStyle = COLORS.cream; ctx.font = '900 56px "Segoe UI"'; ctx.letterSpacing = '7px'; ctx.fillText('风 暴 钟 塔', VIEW_W / 2, 173);
    ctx.fillStyle = 'rgba(221,232,238,.68)'; ctx.font = '14px "Segoe UI"'; ctx.letterSpacing = '2px'; ctx.fillText('把沉默的钟声带回云层之上', VIEW_W / 2, 203);
    this.panel(VIEW_W / 2 - 245, 239, 490, 165, .88);
    ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
    const tips = [
      ['A / D  或  ← / →', '地面移动 · 空中有限修正'],
      ['按住  SPACE', '压缩风暴线圈，积蓄跳跃力量'],
      ['松开  SPACE', '跃升 · 蓄力同时决定高度与水平距离'],
      ['R  /  ESC', '快速重开 / 暂停'],
    ];
    tips.forEach(([key, text], i) => {
      const y = 272 + i * 32;
      ctx.fillStyle = i === 1 || i === 2 ? COLORS.cyan : COLORS.brass; ctx.font = '700 12px ui-monospace, monospace'; ctx.fillText(key, 277, y);
      ctx.fillStyle = 'rgba(239,235,217,.78)'; ctx.font = '12px "Segoe UI"'; ctx.fillText(text, 453, y);
    });
    ctx.textAlign = 'center'; ctx.fillStyle = '#07101d'; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 130, 433, 260, 46, 23); ctx.fill();
    ctx.strokeStyle = COLORS.brass; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = COLORS.cream; ctx.font = '800 14px "Segoe UI"'; ctx.letterSpacing = '3px'; ctx.fillText('按 空 格 开 始 攀 登', VIEW_W / 2, 462);
    if (state.best) { ctx.fillStyle = 'rgba(239,235,217,.5)'; ctx.font = '11px "Segoe UI"'; ctx.letterSpacing = '0px'; ctx.fillText(`塔中记录  ${formatTime(state.best.timeMs)} · ${state.best.falls} 次坠落`, VIEW_W / 2, 506); }
    ctx.textAlign = 'start';
  }

  private drawPause(): void {
    const ctx = this.ctx; ctx.fillStyle = 'rgba(2,5,11,.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.cream; ctx.font = '900 34px "Segoe UI"'; ctx.fillText('钟摆静止', VIEW_W / 2, 247);
    ctx.fillStyle = 'rgba(235,232,216,.6)'; ctx.font = '13px "Segoe UI"'; ctx.fillText('ESC 继续 · R 重新开始', VIEW_W / 2, 280); ctx.textAlign = 'start';
  }

  private drawResult(state: RenderState): void {
    const ctx = this.ctx; ctx.fillStyle = 'rgba(2,5,10,.78)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.brass; ctx.font = '600 11px "Segoe UI"'; ctx.letterSpacing = '7px'; ctx.fillText('THE BELL ANSWERS', VIEW_W / 2, 88);
    ctx.fillStyle = COLORS.cream; ctx.font = '900 42px "Segoe UI"'; ctx.letterSpacing = '5px'; ctx.fillText('风 暴 再 次 报 时', VIEW_W / 2, 143);
    ctx.fillStyle = 'rgba(225,232,237,.62)'; ctx.font = '13px "Segoe UI"'; ctx.letterSpacing = '1px'; ctx.fillText('妮玛将最后一枚雷光送入了沉钟', VIEW_W / 2, 174);
    this.panel(VIEW_W / 2 - 250, 207, 500, 190, .9);
    const rows: Array<[string, string, string]> = [
      ['最终用时', formatTime(state.stats.elapsedMs + state.stats.penaltyMs), `含坠落惩罚 +${Math.floor(state.stats.penaltyMs / 1000)}s`],
      ['坠落次数', String(state.stats.falls), state.stats.falls === 0 ? '完美攀登' : '风暴记得每一次失足'],
      ['最高高度', `${Math.floor(state.stats.maxHeight)} m`, '钟塔之冠 4465 m'],
      ['回收齿轮', `${state.stats.collected} / 12`, state.stats.collected === 12 ? '全部回收' : '仍有齿轮留在塔中'],
    ];
    ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
    rows.forEach(([label, value, note], i) => {
      const y = 241 + i * 41;
      ctx.fillStyle = 'rgba(235,232,216,.55)'; ctx.font = '12px "Segoe UI"'; ctx.fillText(label, 259, y);
      ctx.fillStyle = i === 3 ? COLORS.brass : COLORS.cream; ctx.font = '800 19px ui-monospace, monospace'; ctx.fillText(value, 374, y + 2);
      ctx.fillStyle = 'rgba(205,215,222,.42)'; ctx.font = '10px "Segoe UI"'; ctx.fillText(note, 522, y);
    });
    if (state.finishNewBest) {
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.cyan; ctx.font = '800 13px "Segoe UI"'; ctx.letterSpacing = '4px'; ctx.fillText('✦ 新 的 塔 中 记 录 ✦', VIEW_W / 2, 428);
    } else if (state.best) {
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(235,232,216,.55)'; ctx.font = '11px "Segoe UI"'; ctx.fillText(`最佳记录  ${formatTime(state.best.timeMs)}`, VIEW_W / 2, 428);
    }
    ctx.fillStyle = COLORS.brass; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 120, 456, 240, 42, 21); ctx.fill();
    ctx.fillStyle = '#16130f'; ctx.font = '900 13px "Segoe UI"'; ctx.letterSpacing = '3px'; ctx.fillText('按 R 再 次 攀 登', VIEW_W / 2, 482);
    ctx.textAlign = 'start';
  }
}
