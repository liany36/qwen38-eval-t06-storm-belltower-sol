// Source model: ChatGPT 5.6 Sol
import './style.css';
import { Game } from './game';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing #game canvas');

const game = new Game(canvas);
game.start();
document.querySelector('#loading')?.remove();

const scene = new URLSearchParams(window.location.search).get('scene');
if (scene === 'wind') game.debugAscend(2380);
if (scene === 'result') game.debugComplete();

window.__stormTower = {
  complete: () => game.debugComplete(),
  ascend: (height?: number) => game.debugAscend(height),
};

declare global {
  interface Window {
    __stormTower: {
      complete: () => void;
      ascend: (height?: number) => void;
    };
  }
}
