// Camino del Aura: 8 capítulos x 5 combates (el último, jefe)
import { BOTS, BOSSES, botsOfLevel } from './bots.js';

const CHAPTERS = [
  { name: 'El Despertar del NPC', desc: 'Todo empieza en la cola del pan.', levels: [0, 0, 1, 1], boss: 0, arena: 'rooftop' },
  { name: 'Brainrot Academy', desc: 'El instituto donde se enseña skibidi avanzado.', levels: [1, 1, 2, 2], boss: 1, arena: 'gym' },
  { name: 'Las Guerras del Rizz', desc: 'Solo el rizz más fuerte sobrevive.', levels: [2, 2, 3, 3], boss: 2, arena: 'highway' },
  { name: 'La Montaña del Mewing', desc: 'Mandíbulas de acero en la cima.', levels: [3, 3, 3, 4], boss: 3, arena: 'mountain' },
  { name: 'Solo en Ohio', desc: 'Aquí nada tiene sentido.', levels: [3, 4, 4, 4], boss: 4, arena: 'backrooms' },
  { name: 'Sigma Grindset', desc: 'Madrugar, mirar fijamente, ganar.', levels: [4, 5, 5, 5], boss: 5, arena: 'dojo' },
  { name: 'La Nonchalance', desc: 'Les da igual. Y ganan igual.', levels: [5, 5, 6, 6], boss: 6, arena: 'highway' },
  { name: 'El Juicio Final del Aura', desc: 'El trono del Aura God te espera.', levels: [6, 6, 6, 6], boss: 7, arena: 'colosseum' }
];

function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

export const PATH = CHAPTERS.map((c, ci) => {
  const used = new Set();
  const stages = c.levels.map((lv, si) => {
    const pool = botsOfLevel(lv).filter(b => !used.has(b.id));
    const b = pool[hash(c.name + si) % pool.length];
    used.add(b.id);
    const mode = si === 2 && ci >= 1 ? '1v2' : si === 3 && ci >= 4 ? '1v2' : '1v1';
    let enemies = [b.id];
    if (mode === '1v2') { const p2 = botsOfLevel(Math.max(0, lv - 1)).filter(x => !used.has(x.id)); const b2 = p2[hash(c.name + si + 'x') % p2.length]; used.add(b2.id); enemies.push(b2.id); }
    return { id: `c${ci}s${si}`, title: mode === '1v2' ? `1 contra 2` : b.name, mode, enemies, level: lv, rounds: 1, arena: si % 2 ? c.arena : null };
  });
  stages.push({ id: `c${ci}boss`, title: 'JEFE: ' + BOSSES[c.boss].name, mode: 'boss', enemies: [BOSSES[c.boss].id], level: BOSSES[c.boss].level, rounds: 2, arena: ci === 7 ? 'colosseum' : c.arena, boss: true });
  return { ...c, index: ci, stages };
});

export function stageById(id) {
  for (const c of PATH) for (const s of c.stages) if (s.id === id) return { chapter: c, stage: s };
  return null;
}
export function chapterUnlocked(save, ci) {
  if (ci === 0) return true;
  return PATH[ci - 1].stages.every(s => save.path.cleared[s.id]);
}
export function stageUnlocked(save, ci, si) {
  if (!chapterUnlocked(save, ci)) return false;
  if (si === 0) return true;
  return !!save.path.cleared[PATH[ci].stages[si - 1].id];
}
export function chaptersCleared(save) {
  return PATH.filter(c => c.stages.every(s => save.path.cleared[s.id])).length;
}
export { BOTS };
