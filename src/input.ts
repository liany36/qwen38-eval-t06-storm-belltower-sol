// Source model: ChatGPT 5.6 Sol
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();

  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.onDown, { passive: false });
    target.addEventListener('keyup', this.onUp, { passive: false });
  }

  private normalize = (code: string): string => code === 'Space' ? 'jump' : code;

  private onDown = (event: KeyboardEvent): void => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
    const key = this.normalize(event.code);
    if (!this.down.has(key)) this.pressed.add(key);
    this.down.add(key);
  };

  private onUp = (event: KeyboardEvent): void => {
    const key = this.normalize(event.code);
    this.down.delete(key);
    this.released.add(key);
  };

  held(...keys: string[]): boolean { return keys.some((key) => this.down.has(key)); }
  wasPressed(key: string): boolean { return this.pressed.has(key); }
  wasReleased(key: string): boolean { return this.released.has(key); }
  axis(): -1 | 0 | 1 {
    const left = this.held('KeyA', 'ArrowLeft');
    const right = this.held('KeyD', 'ArrowRight');
    return left === right ? 0 : left ? -1 : 1;
  }
  endFrame(): void { this.pressed.clear(); this.released.clear(); }
  destroy(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
  }
}
