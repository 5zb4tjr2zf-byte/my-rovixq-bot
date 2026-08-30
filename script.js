// ==================== Telegram WebApp ====================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function hapticNotify(type = 'success') {
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(type);
}
function haptic(style = 'light') {
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
}

// ==================== State ====================
const STORAGE_KEY = 'honey_state_v2';

const defaultState = {
  balance: 128.4,
  earnedFromHarvest: 0,
  earnedFromTasks: 0,
  earnedFromFriends: 0,
  friendsCount: 0,
  tasksClaimed: {},
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(raw) };
  } catch (e) {
    return { ...defaultState };
  }
}

const state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fmtHoney(n) {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtInt(n) {
  return Math.floor(n).toLocaleString('uk-UA');
}

// ==================== Screen navigation ====================
const screens = {
  home: document.getElementById('screen-home'),
  tasks: document.getElementById('screen-tasks'),
  friends: document.getElementById('screen-friends'),
  wallet: document.getElementById('screen-wallet'),
};

function showScreen(key) {
  Object.values(screens).forEach((s) => s.classList.remove('screen--active'));
  screens[key].classList.add('screen--active');
  if (key === 'tasks') renderTasks();
  if (key === 'friends') renderFriends();
  if (key === 'wallet') renderWallet();
  haptic('light');
}

document.querySelectorAll('.hex-btn').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

// ==================== Bot / channel config ====================
const BOT_USERNAME = 'rovixq_bot';
const CHANNEL_URL = 'https://t.me/rxchanel';

// ==================== Завдання ====================
const TASKS = [
  {
    id: 'join_channel',
    icon: '📣',
    name: 'Підписатись на канал',
    reward: 20,
    type: 'link',
    url: CHANNEL_URL,
  },
  {
    id: 'use_wallet',
    icon: '👛',
    name: 'Зайти в Гаманець',
    reward: 5,
    type: 'auto',
    check: () => !!state.tasksClaimed['__visited_wallet'],
  },
  {
    id: 'invite_1',
    icon: '👥',
    name: 'Запросити 1 друга',
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
  renderTasks();
  hapticNotify('success');
}

function renderTasks() {
  // marker used by the "visit wallet" task check
  state.tasksClaimed['__visited_wallet'] = state.tasksClaimed['__visited_wallet'] || false;

  taskListEl.innerHTML = '';

  TASKS.forEach((task) => {
    const claimed = !!state.tasksClaimed[task.id];
    const ready = !claimed && task.type === 'auto' && task.check();

    const card = document.createElement('div');
    card.className = 'task-card';

    let btnHtml;
    if (claimed) {
      btnHtml = `<button class="task-btn" disabled>Готово ✓</button>`;
    } else if (task.type === 'link') {
      btnHtml = `<button class="task-btn" data-stage="open">Відкрити</button>`;
    } else {
      btnHtml = `<button class="task-btn ${ready ? 'task-btn--claim' : ''}" ${ready ? '' : 'disabled'}>${ready ? 'Забрати' : 'Заблоковано'}</button>`;
    }

    card.innerHTML = `
      <div class="task-icon">${task.icon}</div>
      <div class="task-info">
        <div class="task-name">${task.name}</div>
        <div class="task-reward">+${fmtInt(task.reward)} HNY</div>
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
            btn.textContent = 'Забрати';
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

// ==================== Друзі ====================
const tgUser = tg?.initDataUnsafe?.user;
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
  btn.textContent = 'Скопійовано ✓';
  setTimeout(() => { btn.textContent = old; }, 1500);
});

document.getElementById('shareRefBtn').addEventListener('click', () => {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Заходь у Honey, заробляй HNY 🍯')}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
  else window.open(shareUrl, '_blank');
});

// ==================== Гаманець ====================
function renderWallet() {
  state.tasksClaimed['__visited_wallet'] = true;
  saveState();

  document.getElementById('walletBalance').textContent = fmtHoney(state.balance);
  document.getElementById('walletFromHarvest').textContent = fmtHoney(state.earnedFromHarvest);
  document.getElementById('walletFromTasks').textContent = fmtHoney(state.earnedFromTasks);
  document.getElementById('walletFromFriends').textContent = fmtHoney(state.earnedFromFriends);
}
