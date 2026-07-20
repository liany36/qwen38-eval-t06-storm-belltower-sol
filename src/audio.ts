// Source model: ChatGPT 5.6 Sol
export type SoundName = 'charge' | 'jump' | 'land' | 'collect' | 'checkpoint' | 'fall' | 'complete';

export class StormAudio {
  private context: AudioContext | null = null;
  private wind: OscillatorNode | null = null;
  private windGain: GainNode | null = null;

  enable(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    const wind = this.context.createOscillator();
    const gain = this.context.createGain();
    wind.type = 'sine';
    wind.frequency.value = 58;
    gain.gain.value = 0.012;
    wind.connect(gain).connect(this.context.destination);
    wind.start();
    this.wind = wind;
    this.windGain = gain;
  }

  setWind(strength: number): void {
    if (!this.context || !this.windGain || !this.wind) return;
    const now = this.context.currentTime;
    this.windGain.gain.setTargetAtTime(0.008 + strength * 0.02, now, 0.25);
    this.wind.frequency.setTargetAtTime(52 + strength * 34, now, 0.2);
  }

  play(name: SoundName, power = 1): void {
    this.enable();
    if (!this.context) return;
    const recipes: Record<SoundName, [number, number, OscillatorType, number]> = {
      charge: [180, 280, 'triangle', 0.06],
      jump: [250, 470, 'square', 0.12],
      land: [105, 60, 'triangle', 0.09],
      collect: [660, 1050, 'sine', 0.18],
      checkpoint: [330, 740, 'triangle', 0.42],
      fall: [180, 46, 'sawtooth', 0.28],
      complete: [440, 1180, 'triangle', 0.75],
    };
    const [from, to, type, duration] = recipes[name];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055 * power, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
