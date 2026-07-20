// Source model: ChatGPT 5.6 Sol
import type { Checkpoint, Collectible, Platform, Rotor } from './types';

const p = (id: string, x: number, y: number, w: number, kind: Platform['kind'] = 'normal', extra: Partial<Platform> = {}): Platform => ({
  id, x, y, w, h: kind === 'oneway' ? 12 : 22, kind, ...extra,
});

export interface Zone { name: string; subtitle: string; from: number; to: number; color: string }

export const ZONES: Zone[] = [
  { name: 'Ⅰ · 沉钟门厅', subtitle: 'THE DROWNED VESTIBULE', from: 0, to: 900, color: '#79c6cb' },
  { name: 'Ⅱ · 失速齿轮厅', subtitle: 'HALL OF LOST HOURS', from: 900, to: 1800, color: '#d6ae5f' },
  { name: 'Ⅲ · 裂风竖井', subtitle: 'THE GALE SHAFT', from: 1800, to: 2750, color: '#8a8eea' },
  { name: 'Ⅳ · 霜封档案室', subtitle: 'FROZEN ARCHIVE', from: 2750, to: 3650, color: '#88dff1' },
  { name: 'Ⅴ · 雷冠钟室', subtitle: 'CROWN OF THUNDER', from: 3650, to: 4580, color: '#f0c968' },
];

export function createPlatforms(): Platform[] {
  return [
    p('floor', 65, 80, 770),
    p('v01', 110, 225, 225), p('v02', 480, 370, 245, 'oneway'),
    p('v03', 215, 515, 205), p('v04', 555, 660, 190, 'crumble'),
    p('v05', 300, 805, 235, 'spring'), p('v06', 85, 945, 185),
    p('g01', 420, 1090, 235, 'moving', { baseX: 420, range: 135, speed: 0.95, phase: 0 }),
    p('g02', 155, 1235, 190), p('g03', 525, 1380, 235, 'checkpoint', { checkpoint: 1 }),
    p('g04', 285, 1525, 210, 'oneway'), p('g05', 65, 1670, 190, 'crumble'),
    p('g06', 390, 1815, 210, 'moving', { baseX: 390, range: 175, speed: 1.22, phase: 1.4 }),
    p('w01', 625, 1960, 170), p('w02', 300, 2100, 205, 'oneway'),
    p('w03', 55, 2240, 175, 'moving', { baseX: 55, range: 180, speed: 1.05, phase: 2.2 }),
    p('w04', 430, 2380, 205, 'crumble'), p('w05', 660, 2520, 165, 'spring'),
    p('w06', 330, 2660, 200), p('i01', 70, 2800, 220, 'ice'),
    p('i02', 415, 2940, 225, 'checkpoint', { checkpoint: 2 }),
    p('i03', 660, 3080, 165, 'ice'), p('i04', 345, 3220, 205, 'moving', { baseX: 345, range: 165, speed: 1.35, phase: 0.8 }),
    p('i05', 70, 3360, 225, 'ice'), p('i06', 420, 3500, 180, 'oneway'),
    p('c01', 680, 3640, 150, 'spring'), p('c02', 390, 3780, 190, 'crumble'),
    p('c03', 80, 3920, 185, 'moving', { baseX: 80, range: 200, speed: 1.45, phase: 1.8 }),
    p('c04', 390, 4060, 165, 'oneway'), p('c05', 665, 4200, 160),
    p('c06', 355, 4335, 210, 'normal'), p('crown', 205, 4465, 490, 'normal'),
  ];
}

export function createCollectibles(): Collectible[] {
  return [
    ['cog-01', 590, 430], ['cog-02', 640, 720], ['cog-03', 170, 1005],
    ['cog-04', 670, 1440], ['cog-05', 150, 1735], ['cog-06', 710, 2020],
    ['cog-07', 135, 2305], ['cog-08', 510, 2445], ['cog-09', 180, 2865],
    ['cog-10', 735, 3145], ['cog-11', 165, 3985], ['cog-12', 745, 4265],
  ].map(([id, x, y], index) => ({ id: String(id), x: Number(x), y: Number(y), collected: false, phase: index * 0.71 }));
}

export const CHECKPOINTS: Checkpoint[] = [
  { id: 0, x: 160, y: 82 },
  { id: 1, x: 642, y: 1382 },
  { id: 2, x: 525, y: 2942 },
];

export const ROTORS: Rotor[] = [
  { x: 450, y: 1180, radius: 105, speed: 1.15, phase: 0.4 },
  { x: 440, y: 2180, radius: 125, speed: -1.35, phase: 1.1 },
  { x: 260, y: 3860, radius: 105, speed: 1.65, phase: 2.2 },
];

export function zoneAt(height: number): Zone {
  return ZONES.find((zone) => height >= zone.from && height < zone.to) ?? ZONES[ZONES.length - 1];
}

export function windAt(height: number, time: number): number {
  if (height < 1770 || height > 2780) return 0;
  const envelope = Math.min(1, (height - 1770) / 180, (2780 - height) / 180);
  return (155 + Math.sin(time * 1.8) * 95 + Math.sin(time * 4.3) * 35) * envelope;
}
