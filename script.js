// ==================== Telegram WebApp ====================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function haptic(style = 'light') {
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
}
function hapticNotify(type = 'success') {
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(type);
}

// ==================== State ====================
const STORAGE_KEY = 'nexora_state_v1';

const defaultState = {
  balance: 128.4,
  boostActive: false,
  boostEndsAt: 0,
  earnedFromHarvest: 0,
  earnedFromTasks: 0,
  earnedFromFriends: 0,
  friendsCount: 0,
  tasksClaimed: {},
  totalHarvests: 0,
};

const HARVEST_REWARD = 0.1;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch (e) {
    return { ...defaultState };
  }
}

const state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ==================== DOM refs ====================
const balanceNumber = document.getElementById('balanceNumber');
const balanceUsd = document.getElementById('balanceUsd');
const hiveStage = document.getElementById('hiveStage');
const bee = document.getElementById('bee');
const hiveEntrance = document.getElementById('hiveEntrance');
const floatLayer = document.getElementById('floatLayer');
const hiveStatusText = document.getElementById('hiveStatusText');
const energyBarFill = document.getElementById('energyBarFill');
const boostBtn = document.getElementById('boostBtn');
const boostSub = document.getElementById('boostSub');
const avatarBtn = document.getElementById('avatarBtn');
const avatarInitial = document.getElementById('avatarInitial');

// ==================== Render ====================
function fmt(n) {
  return Math.floor(n).toLocaleString('en-US');
}
function fmtHoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function renderBalance() {
  balanceNumber.textContent = fmtHoney(state.balance);
  // placeholder USD value — no real price feed yet
  balanceUsd.textContent = '0.00';
}

function renderHiveBar(progress01) {
  energyBarFill.style.width = (progress01 * 100) + '%';
}

function renderBoost() {
  const now = Date.now();
  if (state.boostActive && state.boostEndsAt > now) {
    boostBtn.classList.add('is-active');
    const secondsLeft = Math.ceil((state.boostEndsAt - now) / 1000);
    boostSub.textContent = `Active · ${secondsLeft}s left`;
  } else {
    if (state.boostActive) {
      state.boostActive = false;
      saveState();
    }
    boostBtn.classList.remove('is-active');
    boostSub.textContent = 'Мёд x2';
  }
}

// ==================== Bee flight cycle ====================
function spawnFloatingPlus(amount, x, y) {
  const el = document.createElement('div');
  el.className = 'float-plus';
  el.textContent = '+' + amount.toFixed(1);
  if (x != null && y != null) {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '58%';
  }
  floatLayer.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

const stageWidth = () => hiveStage.clientWidth;
const stageHeight = () => hiveStage.clientHeight;

function setBeePos(x, y, rotateDeg, opacity, scale = 1) {
  bee.style.transform = `translate(${x}px, ${y}px) rotate(${rotateDeg}deg) scale(${scale})`;
  bee.style.opacity = opacity;
}

function animateBee({ from, to, duration, onDone, fadeOut = false, fadeIn = false }) {
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease;

    const dx = to.x - from.x;
    const angle = Math.atan2(to.y - from.y, dx) * (180 / Math.PI) * 0.4;

    let opacity = 1;
    if (fadeOut) opacity = 1 - t;
    if (fadeIn) opacity = t;

    setBeePos(x, y, angle, opacity, fadeOut ? 1 - t * 0.4 : fadeIn ? 0.6 + t * 0.4 : 1);

    if (t < 1) requestAnimationFrame(frame);
    else onDone && onDone();
  }
  requestAnimationFrame(frame);
}

let cycleRunning = false;

function beeCycle() {
  if (cycleRunning) return;
  cycleRunning = true;

  const w = stageWidth();
  const h = stageHeight();

  // Target the real entrance hotspot positioned over the hive photo
  const stageRect = hiveStage.getBoundingClientRect();
  const entRect = hiveEntrance.getBoundingClientRect();
  const hiveX = entRect.left + entRect.width / 2 - stageRect.left;
  const hiveY = entRect.top + entRect.height / 2 - stageRect.top;

  const startSide = Math.random() < 0.5 ? -1 : 1;
  const startPoint = {
    x: hiveX + startSide * (w / 2 + 20),
    y: hiveY - 60 - Math.random() * 40,
  };

  const speedMult = (state.boostActive && state.boostEndsAt > Date.now()) ? 0.5 : 1;

  hiveStatusText.textContent = 'Bee is heading to the hive…';
  renderHiveBar(0.15);
  setBeePos(startPoint.x, startPoint.y, 0, 1);

  // Flying in
  animateBee({
    from: startPoint,
    to: { x: hiveX, y: hiveY },
    duration: 1800 * speedMult,
    onDone: () => {
      renderHiveBar(0.5);
      hiveStatusText.textContent = 'Bee is entering the hive…';
      hiveEntrance.classList.add('is-active');

      // Entering — shrink & fade into entrance
      animateBee({
        from: { x: hiveX, y: hiveY },
        to: { x: hiveX, y: hiveY + 6 },
        duration: 350,
        fadeOut: true,
        onDone: () => {
          // ---- Harvest reward ----
          const boosted = state.boostActive && state.boostEndsAt > Date.now();
          const finalGain = boosted ? HARVEST_REWARD * 2 : HARVEST_REWARD;

          state.balance += finalGain;
          state.earnedFromHarvest += finalGain;
          state.totalHarvests += 1;
          saveState();
          renderBalance();
          spawnFloatingPlus(finalGain, hiveX, hiveY);
          hapticNotify('success');

          renderHiveBar(0.75);
          hiveStatusText.textContent = 'Bee is inside the hive…';

          setTimeout(() => {
            hiveEntrance.classList.remove('is-active');
            hiveStatusText.textContent = 'Bee is leaving the hive…';

            // Exiting
            animateBee({
              from: { x: hiveX, y: hiveY + 6 },
              to: { x: hiveX, y: hiveY },
              duration: 350,
              fadeIn: true,
              onDone: () => {
                const endSide = Math.random() < 0.5 ? -1 : 1;
                const endPoint = {
                  x: hiveX + endSide * (w / 2 + 20),
                  y: hiveY - 60 - Math.random() * 40,
                };

                renderHiveBar(0.9);
                hiveStatusText.textContent = 'Bee is out foraging…';

                animateBee({
                  from: { x: hiveX, y: hiveY },
                  to: endPoint,
                  duration: 1800 * speedMult,
                  onDone: () => {
                    renderHiveBar(0);
                    cycleRunning = false;
                    const restDelay = 600 + Math.random() * 900;
                    setTimeout(beeCycle, restDelay);
                  },
                });
              },
            });
          }, 900 * speedMult);
        },
      });
    },
  });
}

// ==================== Boost ====================
const BOOST_DURATION_MS = 20000; // 20s of 2x earning
const BOOST_COOLDOWN_MS = 60000; // 60s cooldown before it can be used again
let boostCooldownUntil = 0;

boostBtn.addEventListener('click', () => {
  const now = Date.now();

  if (state.boostActive && state.boostEndsAt > now) return; // already active

  if (now < boostCooldownUntil) {
    const wait = Math.ceil((boostCooldownUntil - now) / 1000);
    boostSub.textContent = `Cooldown · ${wait}s`;
    return;
  }

  state.boostActive = true;
  state.boostEndsAt = now + BOOST_DURATION_MS;
  boostCooldownUntil = state.boostEndsAt + BOOST_COOLDOWN_MS;
  saveState();
  hapticNotify('success');
});

setInterval(renderBoost, 1000);

// ==================== Bottom navigation ====================
const screens = {
  home: document.getElementById('screen-home'),
  earn: document.getElementById('screen-earn'),
  friends: document.getElementById('screen-friends'),
  wallet: document.getElementById('screen-wallet'),
};

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.screen;
    Object.values(screens).forEach((s) => s.classList.remove('screen--active'));
    screens[key].classList.add('screen--active');

    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('nav-item--active'));
    btn.classList.add('nav-item--active');

    haptic('light');
  });
});

// ==================== Telegram user ====================
const tgUser = tg?.initDataUnsafe?.user;
if (tgUser?.first_name) {
  avatarInitial.textContent = tgUser.first_name.charAt(0).toUpperCase();
}
avatarBtn.addEventListener('click', () => {
  // placeholder — profile screen not implemented yet
  haptic('light');
});

// ==================== EARN: tasks ====================
// Bot username this Mini App is attached to — change if different.
const BOT_USERNAME = 'rovixq_bot';
const CHANNEL_URL = 'https://t.me/rxchanel'; // change to your Nexora channel

const TASKS = [
  {
    id: 'join_channel',
    icon: '📣',
    name: 'Join Honey channel',
    reward: 20,
    type: 'link',
    url: CHANNEL_URL,
  },
  {
    id: 'harvest_10',
    icon: '🐝',
    name: 'Complete 10 harvests',
    reward: 5,
    type: 'auto',
    check: () => state.totalHarvests >= 10,
  },
  {
    id: 'use_boost',
    icon: '⚡',
    name: 'Activate Boost once',
    reward: 10,
    type: 'auto',
    check: () => state.boostEndsAt > 0,
  },
  {
    id: 'invite_1',
    icon: '👥',
    name: 'Invite 1 friend',
    reward: 30,
    type: 'auto',
    check: () => state.friendsCount >= 1,
  },
];

const taskListEl = document.getElementById('taskList');

function claimTask(task) {
  state.tasksClaimed[task.id] = true;
  state.balance += task.reward;
  state.earnedFromTasks += task.reward;
  saveState();
  renderBalance();
  renderTasks();
  hapticNotify('success');
}

function renderTasks() {
  taskListEl.innerHTML = '';

  TASKS.forEach((task) => {
    const claimed = !!state.tasksClaimed[task.id];
    const ready = !claimed && task.type === 'auto' && task.check();

    const card = document.createElement('div');
    card.className = 'task-card';

    let btnHtml;
    if (claimed) {
      btnHtml = `<button class="task-btn" disabled>Done ✓</button>`;
    } else if (task.type === 'link') {
      btnHtml = `<button class="task-btn" data-stage="open">Open</button>`;
    } else {
      btnHtml = `<button class="task-btn ${ready ? 'task-btn--claim' : ''}" ${ready ? '' : 'disabled'}>${ready ? 'Claim' : 'Locked'}</button>`;
    }

    card.innerHTML = `
      <div class="task-icon">${task.icon}</div>
      <div class="task-info">
        <div class="task-name">${task.name}</div>
        <div class="task-reward">+${fmt(task.reward)} HNY</div>
      </div>
      ${btnHtml}
    `;

    const btn = card.querySelector('.task-btn');
    if (btn && !claimed) {
      if (task.type === 'link') {
        btn.addEventListener('click', () => {
          if (btn.dataset.stage === 'open') {
            if (tg?.openTelegramLink) tg.openTelegramLink(task.url);
            else window.open(task.url, '_blank');
            btn.textContent = 'Claim';
            btn.classList.add('task-btn--claim');
            btn.dataset.stage = 'claim';
          } else {
            claimTask(task);
          }
        });
      } else {
        btn.addEventListener('click', () => {
          if (ready) claimTask(task);
        });
      }
    }

    taskListEl.appendChild(card);
  });
}

// ==================== FRIENDS ====================
const myId = tgUser?.id || 'demo';
const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${myId}`;

function renderFriends() {
  document.getElementById('friendsCountNum').textContent = state.friendsCount;
  document.getElementById('friendsEarnedNum').textContent = fmtHoney(state.earnedFromFriends);
  document.getElementById('refLinkBox').textContent = refLink;
}

document.getElementById('copyRefBtn').addEventListener('click', () => {
  navigator.clipboard?.writeText(refLink);
  hapticNotify('success');
  const btn = document.getElementById('copyRefBtn');
  const old = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => { btn.textContent = old; }, 1500);
});

document.getElementById('shareRefBtn').addEventListener('click', () => {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Join me on Honey and start earning HNY 🍯')}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
  else window.open(shareUrl, '_blank');
});

// ==================== WALLET ====================
function renderWallet() {
  document.getElementById('walletBalance').textContent = fmtHoney(state.balance);
  document.getElementById('walletFromHarvest').textContent = fmtHoney(state.earnedFromHarvest);
  document.getElementById('walletFromTasks').textContent = fmtHoney(state.earnedFromTasks);
  document.getElementById('walletFromFriends').textContent = fmtHoney(state.earnedFromFriends);
}

// ==================== Wire screen renders into nav ====================
const _origNavHandlers = document.querySelectorAll('.nav-item');
_origNavHandlers.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.screen;
    if (key === 'earn') renderTasks();
    if (key === 'friends') renderFriends();
    if (key === 'wallet') renderWallet();
  });
});

// ==================== Initial render ====================
renderBalance();
renderBoost();
renderTasks();
beeCycle();

// ==================== Ambient pollen specks ====================
const pollenLayer = document.getElementById('pollenLayer');

function spawnPollen() {
  if (!pollenLayer) return;
  const speck = document.createElement('div');
  speck.className = 'pollen-speck';
  speck.style.left = (10 + Math.random() * 80) + '%';
  speck.style.bottom = (5 + Math.random() * 15) + '%';
  const duration = 6 + Math.random() * 5;
  speck.style.animationDuration = duration + 's';
  pollenLayer.appendChild(speck);
  setTimeout(() => speck.remove(), duration * 1000);
}

setInterval(spawnPollen, 1400);
spawnPollen();
