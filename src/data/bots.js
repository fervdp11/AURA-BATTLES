// Plantel de bots: nombre, nivel, estilo, aspecto, frase y loadout propio.
import { MOVES } from '../sim/moves.js';
import { MOVE_SHOP } from './progression.js';

// [nombre, estilo, nivel, accesorio, color cuerpo, color aura, frase, celebración?]
const RAW = [
  // 0 · NPC Despistado
  ['Kevin NPC', 'balanced', 0, 'antenna', '#c8c8c8', '#9aa0a6', '¿Esto es la cola del pan?', 'wave'],
  ['Paco Sin Aura', 'chill', 0, 'none', '#d9d4c7', '#a3a3a3', 'Yo solo pasaba por aquí.', 'bow'],
  ['Bob el Recadero', 'balanced', 0, 'cap', '#e8d8a8', '#bfbfbf', '¿Dónde está el botón de saltar?', 'wave'],
  ['Tutorial Tim', 'balanced', 0, 'beanie', '#bde0fe', '#a2d2ff', 'Pulsa Z para... ¿qué era?', 'victory'],
  ['Lagging Larry', 'trickster', 0, 'antenna', '#9ae6b4', '#00ff66', 'Me va a 3 FPS, no cuenta.', 'flex'],
  ['Señor Wifi', 'zoner', 0, 'tophat', '#cdd6f4', '#89b4fa', '¿Alguien sabe la contraseña?', 'bow'],
  ['Default Dani', 'balanced', 0, 'none', '#f4f4f8', '#7df9ff', 'Mi skin es la de serie, ¿y qué?', 'floss'],
  ['Pedrito Figurante', 'chill', 0, 'cap', '#e0c3a0', '#c9ada7', 'Soy figurante, tengo dos frases.', 'wave'],
  ['Cringe Carlos', 'showboat', 0, 'bucket', '#ffadad', '#ff7096', '¿Has visto mi TikTok? 0 visitas.', 'dab'],
  ['AFK Andrés', 'chill', 0, 'beanie', '#b8c0ff', '#8888ff', 'Brb, voy a por agua.', 'bow'],
  ['Bot Genérico #404', 'balanced', 0, 'antenna', '#a8a8a8', '#666666', 'Aura no encontrada.', 'victory'],
  ['Toni Tropiezo', 'rushdown', 0, 'headband', '#ffd6a5', '#ff9f1c', 'Corro mucho, freno poco.', 'flex'],
  ['Loading Lucía', 'zoner', 0, 'bow', '#ffc8dd', '#ffafcc', 'Cargando personalidad... 12%.', 'wave'],
  ['Juanito Ping', 'zoner', 0, 'shades', '#caffbf', '#9bf6ff', 'Disparo y rezo.', 'victory'],
  ['Mireia Miau', 'showboat', 0, 'bow', '#fdffb6', '#ffd166', 'Solo vine por los memes.', 'dab'],
  // 1 · Novato
  ['Gustavo Griddy', 'rushdown', 1, 'cap', '#ffd166', '#06d6a0', 'Mira mis pasos de baile.', 'griddy'],
  ['Lola Lag', 'trickster', 1, 'headband', '#a0c4ff', '#00ff66', 'Ahora me ves... y ahora también.', 'floss'],
  ['Rizzless Raúl', 'showboat', 1, 'bucket', '#ffadad', '#ff5fa2', 'Mi rizz está en mantenimiento.', 'dab'],
  ['Sigma Jr.', 'counter', 1, 'shades', '#d0d0d0', '#c084fc', 'Papá dice que soy sigma.', 'sigma'],
  ['Nerea Novata', 'balanced', 1, 'bow', '#bdb2ff', '#7df9ff', 'Tercer día jugando, cuidado.', 'victory'],
  ['Tralalero Tomás', 'rushdown', 1, 'cap', '#90e0ef', '#0096c7', 'Mis zapatillas son tiburones.', 'griddy'],
  ['Ohio Óscar', 'trickster', 1, 'antenna', '#b5e48c', '#7cfc00', 'En Ohio esto es normal.', 'dab'],
  ['Iker Influencer', 'showboat', 1, 'shades', '#ffcad4', '#f72585', 'Dale like antes de pegarme.', 'siuuu'],
  ['Pepa Patata', 'chill', 1, 'beanie', '#e9c46a', '#f4a261', 'Tranqui, tranqui, tranqui.', 'chill'],
  ['Marcos Mewing', 'chill', 1, 'none', '#f1faee', '#9be7ff', 'Llevo tres horas sin abrir la boca.', 'mewing'],
  ['Cris Crossover', 'counter', 1, 'headband', '#fb8500', '#ffb703', 'Tus tobillos me pertenecen.', 'flex'],
  ['Vicente Vine', 'grappler', 1, 'cap', '#e63946', '#ff2222', '*vine boom*', 'victory'],
  ['Ana Aimbot', 'zoner', 1, 'shades', '#8ecae6', '#ff5555', 'Pew pew, sin hacks, lo juro.', 'flex'],
  ['Rubén Ratio', 'zoner', 1, 'cap', '#48cae4', '#3fa9f5', 'Ratio + L + caíste.', 'laugh'],
  ['Sergio Skibidi', 'rushdown', 1, 'antenna', '#ced4da', '#7df9ff', 'Skibidi bop bop yes yes.', 'floss'],
  // 2 · Casual
  ['Chill Guy Carl', 'chill', 2, 'beanie', '#b08968', '#7fd6a0', 'Solo soy un tipo tranquilo.', 'chill'],
  ['Lucas Looksmaxx', 'showboat', 2, 'mohawk', '#ffe8d6', '#ffd34d', 'Mi mandíbula tiene su propia aura.', 'mewing'],
  ['Fanum Felipe', 'grappler', 2, 'bucket', '#ffb86c', '#ff9f1c', 'Impuesto revolucionario de energía.', 'laugh'],
  ['Sara Side Eye', 'counter', 2, 'bow', '#ffe066', '#ffd166', 'Te estoy viendo. De reojo.', 'sigma'],
  ['Tung Tung Tito', 'grappler', 2, 'none', '#c68642', '#8d5524', 'Tung tung tung... ¡sahur!', 'victory'],
  ['Bea Bombardiro', 'zoner', 2, 'tophat', '#6b8e23', '#9acd32', 'Bombas a domicilio.', 'wave'],
  ['Diego Dab', 'rushdown', 2, 'cap', '#50fa7b', '#00ff88', 'Dab primero, preguntas después.', 'dab'],
  ['Hugo Hold Up', 'counter', 2, 'headband', '#dee2e6', '#adb5bd', 'Espera, espera, espera.', 'bow'],
  ['Rocío Rizz', 'showboat', 2, 'bow', '#ff8fab', '#ff5fa2', 'Te vas a enamorar, lo siento.', 'siuuu'],
  ['Álvaro Aura Farmer', 'chill', 2, 'bucket', '#ffe066', '#ffd34d', 'Cada día farmeo un poco más.', 'auraFarming'],
  ['Nico Despierto', 'balanced', 2, 'antenna', '#e5e5e5', '#ff4d6d', 'Era un NPC. Desperté. Y estoy enfadado.', 'flex'],
  ['Gala Griddy', 'rushdown', 2, 'cap', '#cdb4db', '#a2d2ff', 'El suelo es mi pista.', 'griddy'],
  ['Pablo Ping Pong', 'zoner', 2, 'shades', '#ffffff', '#4cc9f0', 'Ida y vuelta, ida y vuelta.', 'victory'],
  ['Clara Clap Back', 'counter', 2, 'bow', '#ffd166', '#f8961e', 'Aplaudo tus fallos.', 'laugh'],
  ['Mario Mog', 'showboat', 2, 'mohawk', '#d4a373', '#555577', 'Te mogueo desde aquí.', 'mewing'],
  // 3 · Competitivo
  ['Valentina Vent', 'trickster', 3, 'none', '#ff3b3b', '#ff3b3b', 'Eso fue muy sus.', 'laugh'],
  ['Bruno Bonk', 'grappler', 3, 'horns', '#d6a46b', '#c68642', 'A la cárcel del bonk.', 'flex'],
  ['Elena Emote', 'trickster', 3, 'bucket', '#e0aaff', '#c77dff', 'Era una finta. Siempre lo es.', 'floss'],
  ['Javi JoJo', 'rushdown', 3, 'headband', '#b388ff', '#7b2cbf', 'ORA ORA ORA ORA.', 'jojo'],
  ['Irene Infinite', 'chill', 3, 'none', '#caf0f8', '#6fd8ff', 'Mewing infinito activado.', 'mewing'],
  ['Óscar Omae', 'grappler', 3, 'headband', '#2b2d42', '#ff2222', 'Ya estás muerto.', 'jojo'],
  ['Leo Lag Spike', 'trickster', 3, 'antenna', '#a7c957', '#00ff66', 'Mi conexión es un arma.', 'dab'],
  ['Noa No Reaction', 'counter', 3, 'none', '#f8f9fa', '#dddddd', '...', 'bow'],
  ['Teo Touch Grass', 'zoner', 3, 'bucket', '#80ed99', '#33dd55', 'Sal un poco al césped.', 'chill'],
  ['Paula Parry', 'counter', 3, 'scarf', '#90dbf4', '#4cc9f0', 'Parry. Parry. Parry.', 'sigma'],
  ['Adrián Ankles', 'counter', 3, 'headband', '#fb8500', '#ffb86c', 'Ankle breaker profesional.', 'flex'],
  ['Carla Cooked', 'grappler', 3, 'bow', '#ff7b00', '#ff5500', 'Estás cocinado y lo sabes.', 'laugh'],
  ['Íñigo Ice Cream', 'zoner', 3, 'beanie', '#aee8ff', '#aee8ff', 'Bing chilling en tu cara.', 'chill'],
  ['Raquel Ragequit', 'rushdown', 3, 'horns', '#ef233c', '#ff0000', 'Si pierdo, exploto. Literal.', 'flex'],
  ['Samuel Speedrun', 'rushdown', 3, 'cap', '#55ffee', '#55ffee', 'Any% en treinta segundos.', 'griddy'],
  // 4 · Aura Master
  ['Sigma Sergio', 'counter', 4, 'shades', '#e5e5e5', '#c084fc', 'No hablo. Miro.', 'sigma'],
  ['Mei Mewing Master', 'chill', 4, 'scarf', '#fefae0', '#9be7ff', 'Mi mandíbula corta el aire.', 'mewing'],
  ['Gonzalo "Nah I\'d Win"', 'showboat', 4, 'headband', '#f8f9fa', '#7df9ff', 'Nah, yo gano.', 'jojo'],
  ['Dolores Delulu', 'trickster', 4, 'bow', '#ffc6ff', '#ff77cc', '¿Cuál de las dos soy?', 'floss'],
  ['Tomás Time Stop', 'trickster', 4, 'tophat', '#ffd700', '#ffd700', 'Za... warudo.', 'jojo'],
  ['Fernanda Falcon', 'rushdown', 4, 'cowboy', '#ff7b00', '#ff7b00', '¡FALCON... PUNCH!', 'victory'],
  ['Rick Rolo', 'trickster', 4, 'mohawk', '#ff66ff', '#ff66ff', 'Never gonna give you up.', 'auraFarming'],
  ['Martina Main Character', 'showboat', 4, 'crown', '#fff2a8', '#fff2a8', 'La cámara me sigue a mí.', 'siuuu'],
  ['Unai Uno', 'counter', 4, 'cap', '#ff3b3b', '#ff3b3b', 'No, tú.', 'laugh'],
  ['Ximena Sheesh', 'zoner', 4, 'bucket', '#00e5ff', '#00e5ff', 'SHEEEEEESH.', 'dab'],
  ['Kike Crowd', 'zoner', 4, 'tophat', '#ffa94d', '#ffa94d', 'El público está de mi lado.', 'bow'],
  ['Laia Let Him Cook', 'chill', 4, 'beanie', '#ff8844', '#ff8844', 'Dejadme cocinar.', 'chill'],
  ['Darío Domain', 'trickster', 4, 'horns', '#8a2be2', '#8a2be2', 'Bienvenido a mi dominio.', 'sigma'],
  ['Gael Gigachad', 'grappler', 4, 'none', '#e0e0e0', '#d0d0d0', 'Sí.', 'mewing'],
  ['Hana Handshake', 'grappler', 4, 'bow', '#9be7ff', '#9be7ff', 'Encantada de conocerte. ZAS.', 'laugh'],
  // 5 · Sigma Legend
  ['Steve Sigma Stare', 'counter', 5, 'shades', '#dcdcdc', '#c084fc', 'Tu aura acaba de bajar.', 'sigma'],
  ['Nacho Nonchalant', 'chill', 5, 'beanie', '#f2f2f2', '#e0e0e0', 'Me da igual. De verdad.', 'chill'],
  ['Pau Phantom', 'zoner', 5, 'scarf', '#b9a7ff', '#b9a7ff', 'Mis daps no se ven venir.', 'wave'],
  ['67 Kid Legendario', 'rushdown', 5, 'cap', '#ffd166', '#ffd166', 'SIX... SEVEN.', 'sixSeven'],
  ['Berta Big Brain', 'counter', 5, 'wizard', '#ff99ff', '#ff99ff', 'Ya sé lo que vas a hacer.', 'bow'],
  ['Carlos Coffin', 'grappler', 5, 'tophat', '#2d2d2d', '#444444', 'La banda ya está ensayando.', 'auraFarming'],
  ['Sofía Stonks', 'chill', 5, 'shades', '#44ff88', '#44ff88', 'Invierto en tu derrota.', 'flex'],
  ['Bianca Bombastic', 'zoner', 5, 'bow', '#ffe066', '#ffe066', 'Mi mirada tiene alcance infinito.', 'sigma'],
  ['Ohio Overlord', 'trickster', 5, 'crown', '#7cfc00', '#7cfc00', 'Bienvenido a Ohio.', 'dab'],
  ['Iván Invisible', 'zoner', 5, 'scarf', '#f0f0ff', '#e0e0ff', '¿Dónde estoy? Exacto.', 'wave'],
  ['Eva Emotional Damage', 'zoner', 5, 'bow', '#ff4d6d', '#ff4d6d', 'Eso te va a doler por dentro.', 'laugh'],
  ['Max Mic Drop', 'showboat', 5, 'chain', '#cccccc', '#ffd700', 'Fin de la conversación.', 'bow'],
  ['Nora Naruto', 'rushdown', 5, 'headband', '#ffa040', '#ffa040', 'Corro con los brazos atrás. Funciona.', 'griddy'],
  ['Kai Ballerina', 'counter', 5, 'bow', '#ffb6c1', '#ffb6c1', 'Cappuccina, pirueta y adiós.', 'floss'],
  ['Rafa Reverse', 'trickster', 5, 'horns', '#9933ff', '#9933ff', 'Izquierda es derecha ahora.', 'jojo'],
  // 6 · Aura God
  ['Aura God Alex', 'balanced', 6, 'halo', '#ffffff', '#7df9ff', 'Juego sin mirar el mando.', 'flex'],
  ['The Final Judge', 'zoner', 6, 'halo', '#fff6a0', '#fff6a0', 'Tu juicio ha llegado.', 'bow'],
  ['Nonchalance Prime', 'chill', 6, 'shades', '#e8e8e8', '#ffffff', '...', 'chill'],
  ['Sigma Supreme', 'counter', 6, 'crown', '#d9d9d9', '#c084fc', 'Regla número uno: no hay reglas.', 'sigma'],
  ['Rizz Emperor', 'showboat', 6, 'crown', '#ff8fab', '#ff5fa2', 'Todo el mundo cae.', 'siuuu'],
  ['Lord Sixty-Seven', 'rushdown', 6, 'chain', '#ffd166', '#ffd166', '6. 7. Fin.', 'sixSeven'],
  ['Dante Domain', 'trickster', 6, 'horns', '#7b2cbf', '#8a2be2', 'Mi dominio, mis reglas.', 'jojo'],
  ['Inés Infinite', 'chill', 6, 'scarf', '#e0fbfc', '#6fd8ff', 'Mi mewing no tiene fin.', 'mewing'],
  ['Frame Perfect Fran', 'counter', 6, 'headband', '#f4f4f8', '#4cc9f0', 'Cada frame cuenta.', 'bow'],
  ['Zoe Zero Reaction', 'counter', 6, 'none', '#fafafa', '#dddddd', 'Ni un parpadeo.', 'sigma'],
  ['Olga Overload', 'rushdown', 6, 'flameHair', '#ff7b00', '#ffffff', 'Aura al mil por cien.', 'victory'],
  ['Phonk Phantom', 'trickster', 6, 'scarf', '#3c096c', '#ff00ff', 'Que suene el phonk.', 'auraFarming'],
  ['Mog Monarch', 'showboat', 6, 'crown', '#adb5bd', '#555577', 'Te mido tres centímetros más. Siempre.', 'mewing'],
  ['Tito Time Lord', 'trickster', 6, 'tophat', '#ffd700', '#ffd700', 'El tiempo es mío.', 'jojo'],
  ['Ancient Aura', 'balanced', 6, 'wizard', '#fff3b0', '#fff3b0', 'He visto nacer todos los memes.', 'bow']
];

const BOSSES_RAW = [
  ['El Gran NPC', 'chill', 1, 'antenna', '#bfbfbf', '#9aa0a6', 'Soy el NPC definitivo. Tengo tres diálogos y los tres son "hola".', 'wave', 1.32],
  ['Skibidi King', 'rushdown', 2, 'crown', '#ced4da', '#7df9ff', 'Skibidi... ¡dominación total!', 'floss', 1.3],
  ['Rizz Lord', 'showboat', 3, 'crown', '#ff8fab', '#ff5fa2', 'Nadie resiste mi rizz. Nadie.', 'siuuu', 1.3],
  ['El Titán del Mewing', 'chill', 4, 'none', '#f1faee', '#6fd8ff', 'Mi mandíbula es un arma de destrucción masiva.', 'mewing', 1.4],
  ['Ohio Final Boss', 'trickster', 4, 'horns', '#7cfc00', '#7cfc00', 'Solo en Ohio... existo yo.', 'dab', 1.35],
  ['Sigma Overlord', 'counter', 5, 'shades', '#d9d9d9', '#c084fc', 'Rechazo tu existencia.', 'sigma', 1.35],
  ['The Nonchalant One', 'chill', 6, 'shades', '#ffffff', '#e0e0e0', '...', 'chill', 1.35],
  ['AURA GOD SUPREMO', 'balanced', 6, 'halo', '#fff6d0', '#ffd700', 'Yo soy el aura.', 'victory', 1.45]
];

// Movimientos preferidos por estilo
const POOLS = {
  rushdown: { sp: ['sixSeven', 'hitTheWoah', 'griddy', 'skibidiSpin', 'oraBarrage', 'dabOn', 'noLook360', 'narutoRun', 'tungTung', 'vineBoom', 'falconPunch', 'goblinMode', 'speedrun', 'siuuu', 'auraTheft'], ult: ['sixSevenBarrage', 'sigmaRule', 'coffinDance', 'auraOverload'] },
  zoner: { sp: ['rizz', 'invisibleDap', 'phantomDap', 'sheesh', 'ratio', 'aimbot', 'emotionalDamage', 'bingChilling', 'crowdControl', 'touchGrass', 'bombardiro', 'dealWithIt', 'bombasticSideEye', 'bananaSlip', 'sigmaStare'], ult: ['rizzStorm', 'finalAuraJudgment'] },
  counter: { sp: ['unoReverse', 'noReaction', 'clapBack', 'flossShield', 'sideEye', 'caughtIn4K', 'disrespectfulDodge', 'ankleBreaker', 'holdUp', 'bigBrain', 'fakeHighFive', 'sigmaStare', 'hitTheWoah', 'ballerinaSpin'], ult: ['ultimateNonchalance', 'timeStop', 'sigmaRule'] },
  trickster: { sp: ['sigmaTeleport', 'susVent', 'delulu', 'reverseAura', 'lagSpike', 'ohioMode', 'emoteCancel', 'noLook360', 'spidermanPoint', 'dramaticEntrance', 'shush', 'backflipDiss', 'invisibleDap'], ult: ['timeStop', 'domainExpansion'] },
  grappler: { sp: ['fakeHandshake', 'fanumTax', 'cooked', 'auraTheft', 'gigachadJaw', 'bonk', 'tungTung', 'omaeWaMou', 'vineBoom', 'hitTheWoah', 'falconPunch'], ult: ['coffinDance', 'sixSevenBarrage'] },
  showboat: { sp: ['broReallyThought', 'lBozo', 'ggEz', 'skillIssue', 'mog', 'mainCharacter', 'siuuu', 'auraFarming', 'dabOn', 'nahIdWin', 'rizz', 'micDrop'], ult: ['rizzStorm', 'sigmaRule'] },
  chill: { sp: ['chillGuy', 'mewing', 'infiniteMewing', 'auraWalk', 'npcMode', 'afk', 'thisIsFine', 'stonks', 'letHimCook', 'perfectlyBalanced', 'sideEye', 'invisibleDap', 'noReaction'], ult: ['ultimateNonchalance', 'auraOverload'] },
  balanced: { sp: ['sixSeven', 'fakeHandshake', 'siuuu', 'rizz', 'mewing', 'sigmaStare', 'unoReverse', 'sigmaTeleport', 'hitTheWoah', 'phantomDap', 'auraWalk', 'bonk', 'nahIdWin', 'clapBack'], ult: ['sixSevenBarrage', 'finalAuraJudgment', 'sigmaRule', 'ultimateNonchalance'] }
};

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function maxTier(level) { return [1, 2, 3, 4, 5, 6, 6][level] ?? 6; }
function tierOf(id) { return MOVE_SHOP[id] ? MOVE_SHOP[id].tier : 0; }

function buildLoadout(name, style, level) {
  const pool = POOLS[style] || POOLS.balanced;
  const h = hash(name);
  const allowed = pool.sp.filter(id => MOVES[id] && tierOf(id) <= maxTier(level));
  const extra = POOLS.balanced.sp.filter(id => MOVES[id] && tierOf(id) <= maxTier(level) && !allowed.includes(id));
  const list = [...allowed, ...extra];
  const pick = [];
  let k = h;
  while (pick.length < 5 && list.length) {
    const i = k % list.length;
    const id = list.splice(i, 1)[0];
    pick.push(id);
    k = Math.imul(k ^ (k >>> 13), 2654435761) >>> 0;
  }
  const ults = pool.ult.filter(id => tierOf(id) <= maxTier(level) + 1);
  const ult = (ults.length ? ults : ['sixSevenBarrage', 'rizzStorm'])[h % (ults.length || 2)];
  return { special: pick[0], specialF: pick[1], specialD: pick[2], skill1: pick[3], skill2: pick[4], ult };
}

function make(r, i, boss) {
  const [name, style, level, accessory, color, aura, quote, celebration, scale] = r;
  const h = hash(name);
  const accents = ['#ffd166', '#ff4d6d', '#4cc9f0', '#7bd389', '#c084fc', '#ff9f1c', '#f72585', '#ffffff'];
  return {
    id: (boss ? 'boss_' : 'bot_') + i, name, style, level, accessory, color, aura, quote,
    accent: accents[h % accents.length], celebration: celebration || 'flex',
    scale: scale || 1, boss: !!boss, maxAura: boss ? Math.round(1000 * (1.25 + level * 0.04)) : 1000,
    loadout: buildLoadout(name, style, Math.min(6, level + (boss ? 1 : 0)))
  };
}

export const BOTS = RAW.map((r, i) => make(r, i, false));
export const BOSSES = BOSSES_RAW.map((r, i) => make(r, i, true));
export const ALL_BOTS = [...BOTS, ...BOSSES];

export function botsOfLevel(level) { return BOTS.filter(b => b.level === level); }
export function botById(id) { return ALL_BOTS.find(b => b.id === id); }
export function randomBot(level, rand = Math.random, exclude = []) {
  const list = botsOfLevel(level).filter(b => !exclude.includes(b.id));
  return list[Math.floor(rand() * list.length)] || BOTS[0];
}
