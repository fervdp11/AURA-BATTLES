import Phaser from 'phaser';
import '@fontsource/anton/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import './view/GraphicsPatch.js';
import { BootScene } from './scenes/BootScene.js';
import { DemoScene } from './scenes/DemoScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { PlayScene } from './scenes/PlayScene.js';
import { PathScene } from './scenes/PathScene.js';
import { CustomScene } from './scenes/CustomScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';
import { PrestigeScene } from './scenes/PrestigeScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { VersusScene } from './scenes/VersusScene.js';
import { FightScene } from './scenes/FightScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { MoveListScene } from './scenes/MoveListScene.js';
import { Audio } from './core/Audio.js';
import { Save } from './core/Save.js';

const config = {
  type: Phaser.WEBGL,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#05030c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60, smoothStep: true },
  input: { keyboard: false, gamepad: false },
  scene: [BootScene, DemoScene, MenuScene, PlayScene, PathScene, CustomScene, CharacterScene, PrestigeScene, SettingsScene, VersusScene, FightScene, HUDScene, PauseScene, ResultScene, MoveListScene]
};

// Espera a que las fuentes locales estén listas antes de crear textos
const fonts = ['48px "Anton"', '20px "Rubik"', 'bold 20px "Rubik"'];
Promise.race([
  Promise.all(fonts.map(f => document.fonts.load(f))),
  new Promise(r => setTimeout(r, 2500))
]).finally(() => {
  window.game = new Phaser.Game(config);
  window.__AURA = { Audio, Save }; // acceso para depuración desde la consola
});
