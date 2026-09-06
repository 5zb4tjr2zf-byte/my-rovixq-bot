// ==================== Telegram WebApp ====================
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

function haptic(style = 'light') {
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
}
function hapticNotify(type = 'success') {
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(type);
}

// ==================== Тарифні шари (materials) ====================
// Кожен шар: колір граней, назва, здоров'я блоку (кількість тапів до руйнування),
// нагорода за тап, бонус за повне руйнування, шанс дропу мінералу.
const LAYERS = [
  { name: 'Дерево',    top: '#B08252', left: '#8C6339', right: '#6B4A2A', maxHealth: 8,  reward: 5,   breakBonus: 40,   mineral: null },
  { name: 'Камінь',    top: '#8A8A8A', left: '#6E6E6E', right: '#525252', maxHealth: 14, reward: 8,   breakBonus: 90,   mineral: 'coal' },
  { name: 'Залізняк',  top: '#C9A98A', left: '#A9876A', right: '#8A6B50', maxHealth: 22, reward: 14,  breakBonus: 180,  mineral: 'iron' },
  { name: 'Золото',    top: '#F2C94D', left: '#D1A62E', right: '#A8811C', maxHealth: 32, reward: 24,  breakBonus: 360,  mineral: 'redstone' },
  { name: 'Обсидіан',  top: '#5B4E86', left: '#443A66', right: '#2E2748', maxHealth: 46, reward: 40,  breakBonus: 700,  mineral: 'diamond' },
];

const MAX_DURABILITY = 2500;
const REGEN_PER_SEC = 3;
const IDLE_CAP_HOURS = 8; // максимум часу офлайн-доходу, який враховуємо

// ==================== Стан ====================
const STORAGE_KEY = 'craftcoin_state_v1';

const defaultState = {
  balance: 0,
  durability: MAX_DURABILITY,
  layerIndex: 0,
  blockHealth: LAYERS[0].maxHealth,
  minerals: { coal: 0, iron: 0, redstone: 0, diamond: 0 },
  autoMinerActive: false,
  autoMinerOwned: false,
  lastSeen: Date.now(),
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(raw), minerals: { ...defaultState.minerals, ...(JSON.parse(raw).minerals || {}) } };
  } catch (e) {
    return { ...defaultState };
  }
}

const state = loadState();

function saveState() {
  state.lastSeen = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fmt(n) { return Math.floor(n).toLocaleString('uk-UA'); }

// ==================== DOM ====================
const balanceEl = document.getElementById('balance');
const blockCube = document.getElementById('blockCube');
const cubeLabel = document.getElementById('cubeLabel');
const floatLayer = document.getElementById('floatLayer');
const durabilityFill = document.getElementById('durabilityFill');
const durabilityNums = document.getElementById('durabilityNums');
const durabilityStatus = document.getElementById('durabilityStatus');
const pickaxeLevelText = document.getElementById('pickaxeLevelText');
const autoMinerBtn = document.getElementById('autoMinerBtn');
const autoMinerStatus = document.getElementById('autoMinerStatus');
const toastEl = document.getElementById('toast');
const cracks = [
  document.querySelector('.crack-1'),
  document.querySelector('.crack-2'),
  document.querySelector('.crack-3'),
];

function currentLayer() { return LAYERS[state.layerIndex % LAYERS.length]; }

function applyLayerVisual() {
  const layer = currentLayer();
  blockCube.style.setProperty('--tier-top', layer.top);
  blockCube.style.setProperty('--tier-left', layer.left);
  blockCube.style.setProperty('--tier-right', layer.right);
  cubeLabel.textContent = layer.name.slice(0, 2).toUpperCase();
  pickaxeLevelText.textContent = `рівень ${state.layerIndex + 1}`;
}

function renderBalance() {
  balanceEl.textContent = fmt(state.balance);
}

function renderDurability() {
  const pct = Math.max(0, Math.min(100, (state.durability / MAX_DURABILITY) * 100));
  durabilityFill.style.width = pct + '%';
  durabilityNums.textContent = `${fmt(state.durability)}/${MAX_DURABILITY}`;

  if (state.durability >= MAX_DURABILITY) {
    durabilityStatus.textContent = '';
  } else {
    const secondsLeft = Math.ceil((MAX_DURABILITY - state.durability) / REGEN_PER_SEC);
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    durabilityStatus.textContent = `Відновлення через ${m}:${s.toString().padStart(2, '0')}`;
  }
}

function renderCracks() {
  const layer = currentLayer();
  const ratio = 1 - state.blockHealth / layer.maxHealth;
  cracks.forEach((c, i) => {
    const threshold = (i + 1) / (cracks.length + 1);
    c.classList.toggle('is-visible', ratio >= threshold);
  });
}

function renderAutoMiner() {
  autoMinerStatus.textContent = state.autoMinerActive ? 'Активний' : (state.autoMinerOwned ? 'Вимкнений' : 'Не куплений');
  autoMinerBtn.classList.toggle('is-active', state.autoMinerActive);
}

function spawnFloat(text) {
  const el = document.createElement('div');
  el.className = 'float-plus';
  el.textContent = text;
  el.style.marginLeft = ((Math.random() - 0.5) * 50) + 'px';
  floatLayer.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function spawnDust() {
  for (let i = 0; i < 5; i++) {
    const d = document.createElement('div');
    d.className = 'dust';
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 30;
    d.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    d.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    floatLayer.appendChild(d);
    setTimeout(() => d.remove(), 500);
  }
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('is-visible');
  setTimeout(() => toastEl.classList.remove('is-visible'), 3500);
}

const MINERAL_INFO = {
  coal:     { icon: '⚫', name: 'Вугілля' },
  iron:     { icon: '⛓️', name: 'Залізо' },
  redstone: { icon: '🔴', name: 'Редстоун' },
  diamond:  { icon: '💎', name: 'Алмаз' },
};

function rollMineralDrop() {
  const layer = currentLayer();
  if (!layer.mineral) return;
  if (Math.random() < 0.5) {
    state.minerals[layer.mineral] = (state.minerals[layer.mineral] || 0) + 1;
  }
}

function breakBlock() {
  const layer = currentLayer();
  state.balance += layer.breakBonus;
  rollMineralDrop();
  spawnFloat('+' + layer.breakBonus);
  hapticNotify('success');

  state.layerIndex += 1;
  const nextLayer = currentLayer();
  state.blockHealth = nextLayer.maxHealth;

  showToast(`Блок зруйновано! Новий шар: ${nextLayer.name}`);
  applyLayerVisual();
  renderCracks();
}

function handleTap() {
  const layer = currentLayer();

  if (state.durability > 0) {
    state.durability -= 1;
    state.blockHealth -= 1;
    state.balance += layer.reward;
    spawnFloat('+' + layer.reward);
    haptic('light');
  } else {
    // Кирка зламана — мінімальна нагорода голими руками
    state.blockHealth -= 1;
    state.balance += 1;
    spawnFloat('+1');
    haptic('light');
  }

  spawnDust();
  renderCracks();

  if (state.blockHealth <= 0) {
    breakBlock();
  }

  renderBalance();
  renderDurability();
  saveState();
}

blockCube.addEventListener('click', handleTap);

// ==================== Регенерація кирки ====================
setInterval(() => {
  if (state.durability < MAX_DURABILITY) {
    state.durability = Math.min(MAX_DURABILITY, state.durability + REGEN_PER_SEC);
    renderDurability();
    saveState();
  }
}, 1000);

// ==================== Авто-шахтар (idle mining) ====================
const AUTO_MINER_RATE_PER_SEC = 2; // CC на секунду, поки активний

autoMinerBtn.addEventListener('click', () => {
  if (!state.autoMinerOwned) {
    showToast('Спочатку купи Авто-шахтаря в Магазині 🛒');
    return;
  }
  state.autoMinerActive = !state.autoMinerActive;
  renderAutoMiner();
  saveState();
  haptic('light');
});

function applyIdleEarnings() {
  if (!state.autoMinerActive) return;
  const now = Date.now();
  const elapsedSec = Math.min((now - state.lastSeen) / 1000, IDLE_CAP_HOURS * 3600);
  if (elapsedSec > 5) {
    const earned = Math.floor(elapsedSec * AUTO_MINER_RATE_PER_SEC);
    if (earned > 0) {
      state.balance += earned;
      showToast(`Поки тебе не було, шахтарі видобули +${fmt(earned)} CC ⛏`);
    }
  }
}

// ==================== Магазин ====================
const SHOP_ITEMS = [
  {
    id: 'auto_miner',
    icon: '🤖',
    name: 'Авто-шахтар',
    desc: 'Пасивний видобуток, навіть коли ти офлайн',
    cost: 500,
    owned: () => state.autoMinerOwned,
    buy: () => { state.autoMinerOwned = true; state.autoMinerActive = true; },
  },
  {
    id: 'super_pickaxe',
    icon: '⛏',
    name: 'Супер кирка',
    desc: 'Більше міцності — довше копаєш без перерви',
    cost: 800,
    owned: () => state.superPickaxeOwned,
    buy: () => { state.superPickaxeOwned = true; },
  },
];

function renderShop() {
  const list = document.getElementById('shopList');
  list.innerHTML = '';
  SHOP_ITEMS.forEach((item) => {
    const isOwned = item.owned();
    const canBuy = !isOwned && state.balance >= item.cost;
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
      </div>
      <button class="shop-buy" ${canBuy ? '' : 'disabled'}>${isOwned ? 'Куплено' : fmt(item.cost) + ' CC'}</button>
    `;
    const btn = el.querySelector('.shop-buy');
    if (!isOwned) {
      btn.addEventListener('click', () => {
        if (state.balance < item.cost) return;
        state.balance -= item.cost;
        item.buy();
        saveState();
        renderBalance();
        renderShop();
        renderAutoMiner();
        hapticNotify('success');
      });
    }
    list.appendChild(el);
  });
}

// ==================== Інвентар ====================
function renderInventory() {
  const grid = document.getElementById('invGrid');
  grid.innerHTML = '';
  Object.entries(MINERAL_INFO).forEach(([key, info]) => {
    const count = state.minerals[key] || 0;
    const el = document.createElement('div');
    el.className = 'inv-item';
    el.innerHTML = `
      <div class="inv-icon">${info.icon}</div>
      <div class="inv-name">${info.name}</div>
      <div class="inv-count">${count}</div>
    `;
    grid.appendChild(el);
  });
}

// ==================== Навігація ====================
const screens = {
  mine: document.getElementById('screen-mine'),
  craft: document.getElementById('screen-craft'),
  shop: document.getElementById('screen-shop'),
  friends: document.getElementById('screen-friends'),
  inventory: document.getElementById('screen-inventory'),
};

function showScreen(key) {
  Object.values(screens).forEach((s) => s.classList.remove('screen--active'));
  screens[key].classList.add('screen--active');
  if (key === 'shop') renderShop();
  if (key === 'inventory') renderInventory();
  haptic('light');

  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('nav-item--active'));
  const navBtn = document.querySelector(`.nav-item[data-screen="${key}"]`);
  if (navBtn) navBtn.classList.add('nav-item--active');
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});
document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

// ==================== Старт ====================
applyIdleEarnings();
applyLayerVisual();
renderBalance();
renderDurability();
renderCracks();
renderAutoMiner();
saveState();

// Періодично оновлюємо lastSeen, щоб офлайн-час рахувався коректно
setInterval(saveState, 5000);
