// ==================== Telegram WebApp ====================
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
function haptic(s = 'light') { if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(s); }
function hapticNotify(t = 'success') { if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(t); }

// ==================== Довідники ====================
const EMOJI_OPTIONS = ['🔥','🏋️','📖','💧','🧘','🎯','🥗','🚭','💰','🎨','🌱','😴'];

const THEMES = [
  { id: 'midnight', name: 'Midnight', price: 0, colors: ['#5B7CFA', '#3A56D4'] },
  { id: 'ocean',     name: 'Ocean',    price: 100, colors: ['#22D3EE', '#0891B2'] },
  { id: 'purple',    name: 'Purple',   price: 100, colors: ['#8B5CF6', '#6D28D9'] },
  { id: 'minimal',   name: 'Minimal',  price: 100, colors: ['#94A3B8', '#64748B'] },
];

const COMMUNITY_CHALLENGES = [
  { id: 'c1', icon: '📅', name: '30 Days Gym', participants: 12400, desc: 'Тренуйся 30 днів поспіль. Стань кращою версією себе!', category: 'popular' },
  { id: 'c2', icon: '💗', name: 'Learn English', participants: 8700, desc: '30 хв англійської щодня. Прогрес відчутний вже за тиждень.', category: 'popular' },
  { id: 'c3', icon: '🍃', name: 'No Sugar', participants: 5300, desc: 'Відмовся від цукру на 21 день і відчуй різницю.', category: 'popular' },
  { id: 'c4', icon: '🚫', name: 'No TikTok', participants: 4100, desc: 'Менше скролінгу — більше реального життя.', category: 'new' },
  { id: 'c5', icon: '🌅', name: 'Morning Routine', participants: 3800, desc: 'Побудуй ранкову рутину, яка задає тон дню.', category: 'new' },
];

const ACHIEVEMENT_DEFS = [
  { id: 'first_day', icon: '🌱', name: 'Перший день', desc: 'Відмітив свій перший день', check: (s) => totalCheckedAll(s) >= 1 },
  { id: 'streak7',    icon: '🔥', name: '7 днів поспіль', desc: 'Тримав серію 7 днів', check: (s) => bestStreakAll(s) >= 7 },
  { id: 'streak30',   icon: '🏅', name: '30 днів поспіль', desc: 'Тримав серію 30 днів', check: (s) => bestStreakAll(s) >= 30 },
  { id: 'days100',    icon: '🏆', name: '100 днів', desc: 'Легенда: 100 виконаних днів', check: (s) => totalCheckedAll(s) >= 100 },
  { id: 'cal5',       icon: '📚', name: '5 календарів', desc: 'Створив 5 календарів', check: (s) => s.calendars.length >= 5 },
];

// ==================== Стан ====================
const STORAGE_KEY = 'nexora_calendars_v2';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

const defaultState = {
  userName: 'Максим',
  premium: false,
  theme: 'midnight',
  ownedThemes: ['midnight'],
  unlockedAchievements: {},
  myChallenges: [],
  calendars: [
    { id: 'cal_demo1', name: '30 DAYS', icon: '🔥', target: 30, startDate: todayStr(), archived: false, reminders: true, autoMark: false,
      checkedDates: (() => { const arr = []; const d = new Date(); for (let i=1;i<=13;i++){ const dd=new Date(d); dd.setDate(d.getDate()-i); arr.push(`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`);} return arr; })() },
  ],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    return { ...JSON.parse(JSON.stringify(defaultState)), ...JSON.parse(raw) };
  } catch (e) {
    return JSON.parse(JSON.stringify(defaultState));
  }
}
const state = loadState();
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ==================== Утиліти по календарях ====================
function activeCalendars() { return state.calendars.filter((c) => !c.archived); }
function archivedCalendars() { return state.calendars.filter((c) => c.archived); }

function currentStreak(cal) {
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
    if (cal.checkedDates.includes(key)) { streak += 1; cursor.setDate(cursor.getDate()-1); } else break;
  }
  return streak;
}

function bestStreakForCal(cal) {
  const dates = [...cal.checkedDates].sort();
  let best = 0, cur = 0, prev = null;
  dates.forEach((k) => {
    if (prev) {
      const p = new Date(prev), c = new Date(k);
      const diff = Math.round((c - p) / 86400000);
      cur = diff === 1 ? cur + 1 : 1;
    } else cur = 1;
    best = Math.max(best, cur);
    prev = k;
  });
  return best;
}

function bestStreakAll(s) { return Math.max(0, ...s.calendars.map((c) => Math.max(currentStreak(c), bestStreakForCal(c)))); }
function totalCheckedAll(s) { return s.calendars.reduce((sum, c) => sum + c.checkedDates.length, 0); }

function heroCalendar() {
  const cals = activeCalendars();
  if (cals.length === 0) return null;
  return [...cals].sort((a,b) => currentStreak(b) - currentStreak(a))[0];
}

function checkAchievements() {
  ACHIEVEMENT_DEFS.forEach((a) => { if (!state.unlockedAchievements[a.id] && a.check(state)) state.unlockedAchievements[a.id] = true; });
}

// ==================== Навігація ====================
const screens = {};
document.querySelectorAll('.screen').forEach((el) => { screens[el.id.replace('screen-','')] = el; });

const ROOT_TABS = ['home','calendars','community','profile'];

function showScreen(key) {
  Object.values(screens).forEach((s) => s.classList.remove('screen--active'));
  if (screens[key]) screens[key].classList.add('screen--active');

  document.getElementById('bottomNav').style.display = ROOT_TABS.includes(key) ? 'flex' : 'none';
  document.querySelectorAll('.nav-item-new').forEach((b) => b.classList.remove('nav-item-new--active'));
  const navBtn = document.querySelector(`.nav-item-new[data-nav="${key}"]`);
  if (navBtn) navBtn.classList.add('nav-item-new--active');

  const renderers = {
    home: renderHome, calendars: renderAllCalendars, 'calendar-detail': renderCalendarDetail,
    'calendar-stats': renderStats, 'calendar-settings': renderCalSettings, community: renderCommunity,
    profile: renderProfile, achievements: renderAchievements, store: renderStore,
    'create-calendar': renderCreateCalendarForm, 'create-challenge': renderCreateChallengeForm,
    'gift-premium': renderGiftPremium, premium: renderPremiumScreen, 'challenge-detail': renderChallengeDetail,
  };
  if (renderers[key]) renderers[key]();
  haptic('light');
}

document.querySelectorAll('[data-nav]').forEach((el) => {
  el.addEventListener('click', () => showScreen(el.dataset.nav));
});
document.querySelectorAll('[data-back]').forEach((el) => {
  el.addEventListener('click', () => showScreen(el.dataset.back));
});

// ==================== SPLASH ====================
setTimeout(() => { document.getElementById('splashFill').style.width = '100%'; }, 100);
setTimeout(() => { showScreen('home'); }, 1500);

// ==================== HOME ====================
function fmtPct(n) { return Math.round(n) + '%'; }

function renderHome() {
  document.getElementById('homeUserName').textContent = state.userName;

  const heroWrap = document.getElementById('heroWrap');
  const hero = heroCalendar();
  if (!hero) {
    heroWrap.innerHTML = `<div class="hero-empty">Ще немає жодного календаря.<br>Створи перший, щоб почати 👇</div>`;
  } else {
    const streak = currentStreak(hero);
    const pct = hero.target > 0 ? Math.min(100, (hero.checkedDates.length/hero.target)*100) : Math.min(100, streak);
    heroWrap.innerHTML = `
      <div class="hero-card-simple" data-id="${hero.id}">
        <div class="hero-top-row">
          <div class="hero-icon-badge">${hero.icon}</div>
          <div class="hero-title-block"><div class="hero-title">Твоя серія</div><div class="hero-sub-days">${streak} днів</div></div>
        </div>
      </div>`;
    heroWrap.querySelector('.hero-card-simple').addEventListener('click', () => openCalendarDetail(hero.id));
  }

  const overall = document.getElementById('overallProgressCard');
  const cals = activeCalendars();
  const totalTarget = cals.reduce((s,c) => s + (c.target||0), 0);
  const totalDone = cals.reduce((s,c) => s + c.checkedDates.length, 0);
  const overallPct = totalTarget > 0 ? Math.min(100, (totalDone/totalTarget)*100) : 0;
  overall.innerHTML = `
    <div class="progress-mini-top"><span>Загальний прогрес</span><span>${fmtPct(overallPct)}</span></div>
    <div class="hero-bar"><div class="hero-fill" style="width:${overallPct}%"></div></div>`;

  document.getElementById('homeCalCount').textContent = cals.length;
  const list = document.getElementById('homeCalList');
  list.innerHTML = '';
  cals.slice(0, 5).forEach((cal) => list.appendChild(buildCalRow(cal)));
}

function buildCalRow(cal) {
  const checked = cal.checkedDates.length;
  const target = cal.target || 0;
  const pct = target > 0 ? Math.min(100, (checked/target)*100) : 100;
  const row = document.createElement('div');
  row.className = 'cal-row';
  row.innerHTML = `
    <div class="cal-row-icon">${cal.icon}</div>
    <div class="cal-row-info">
      <div class="cal-row-top"><span class="cal-row-name">${cal.name}</span><span class="cal-row-nums">${checked}/${target||'∞'}</span></div>
      <div class="cal-row-bar-wrap"><div class="cal-row-bar"><div class="cal-row-fill" style="width:${pct}%"></div></div><span class="cal-row-percent">${fmtPct(pct)}</span></div>
    </div>
    <span class="cal-row-chevron">›</span>`;
  row.addEventListener('click', () => openCalendarDetail(cal.id));
  return row;
}

// ==================== ALL CALENDARS ====================
let calTabMode = 'active';
document.querySelectorAll('#calTabsRow .tab-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    calTabMode = btn.dataset.tab;
    document.querySelectorAll('#calTabsRow .tab-chip').forEach((b) => b.classList.remove('tab-chip--active'));
    btn.classList.add('tab-chip--active');
    renderAllCalendars();
  });
});

function renderAllCalendars() {
  const list = document.getElementById('allCalList');
  list.innerHTML = '';
  const cals = calTabMode === 'active' ? activeCalendars() : archivedCalendars();
  if (cals.length === 0) {
    list.innerHTML = `<div class="settings-empty">${calTabMode === 'active' ? 'Немає активних календарів' : 'Архів порожній'}</div>`;
    return;
  }
  cals.forEach((cal) => list.appendChild(buildCalRow(cal)));
}

// ==================== CREATE CALENDAR ====================
let selectedEmoji = EMOJI_OPTIONS[0];
let selectedDuration = 30;

document.getElementById('createBackBtn').addEventListener('click', () => showScreen('calendars'));

function renderCreateCalendarForm() {
  selectedEmoji = EMOJI_OPTIONS[0];
  selectedDuration = 30;
  document.getElementById('calNameInput').value = '';
  document.getElementById('calStartInput').value = todayStr();
  renderEmojiRow(document.getElementById('emojiRow'), (e) => selectedEmoji = e, selectedEmoji);
  renderDurationRow();
}

function renderEmojiRow(container, onSelect, current) {
  container.innerHTML = '';
  EMOJI_OPTIONS.forEach((emo) => {
    const btn = document.createElement('button');
    btn.className = 'emoji-chip' + (emo === current ? ' is-selected' : '');
    btn.textContent = emo;
    btn.addEventListener('click', () => {
      onSelect(emo);
      container.querySelectorAll('.emoji-chip').forEach((c) => c.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      haptic('light');
    });
    container.appendChild(btn);
  });
}

function renderDurationRow() {
  document.querySelectorAll('#durationRow .dur-chip').forEach((chip) => {
    const days = parseInt(chip.dataset.days, 10);
    chip.classList.toggle('is-selected', days === selectedDuration);
    chip.onclick = () => { selectedDuration = days; renderDurationRow(); haptic('light'); };
  });
}

document.getElementById('createCalBtn').addEventListener('click', () => {
  const name = document.getElementById('calNameInput').value.trim();
  if (!name) { document.getElementById('calNameInput').focus(); return; }
  const cal = {
    id: 'cal_' + Date.now(), name, icon: selectedEmoji, target: selectedDuration,
    startDate: document.getElementById('calStartInput').value || todayStr(),
    archived: false, reminders: true, autoMark: false, checkedDates: [],
  };
  state.calendars.push(cal);
  checkAchievements();
  saveState();
  hapticNotify('success');
  showScreen('home');
});

// ==================== CALENDAR DETAIL ====================
let currentCalId = null;
let viewYear, viewMonth;
const MONTH_NAMES = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

function openCalendarDetail(id) {
  currentCalId = id;
  const now = new Date();
  viewYear = now.getFullYear(); viewMonth = now.getMonth();
  showScreen('calendar-detail');
}

function getCurrentCal() { return state.calendars.find((c) => c.id === currentCalId); }

document.getElementById('detailBackBtn').addEventListener('click', () => showScreen('calendars'));
document.getElementById('detailMenuBtn').addEventListener('click', () => showScreen('calendar-settings'));

function renderCalendarDetail() {
  const cal = getCurrentCal();
  if (!cal) { showScreen('calendars'); return; }

  document.getElementById('detailTitle').textContent = `${cal.icon} ${cal.name}`;
  const checked = cal.checkedDates.length, target = cal.target || 0;
  const pct = target > 0 ? Math.min(100, (checked/target)*100) : Math.min(100, checked);
  document.getElementById('detailNums').textContent = `${checked} / ${target || '∞'} днів`;
  document.getElementById('detailPercent').textContent = fmtPct(pct);
  document.getElementById('detailBarFill').style.width = pct + '%';
  document.getElementById('detailSeries').textContent = `🔥 Серія: ${currentStreak(cal)} днів`;

  document.getElementById('monthLabel').textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  const grid = document.getElementById('dayGrid');
  grid.innerHTML = '';
  const firstDay = new Date(viewYear, viewMonth, 1);
  let leadingEmpty = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const today = todayStr();
  for (let i=0;i<leadingEmpty;i++){ const e=document.createElement('div'); e.className='day-cell is-empty'; grid.appendChild(e); }
  for (let d=1; d<=daysInMonth; d++) {
    const key = dateKey(viewYear, viewMonth, d);
    const cell = document.createElement('div');
    const isChecked = cal.checkedDates.includes(key);
    const isToday = key === today;
    const isFuture = key > today;
    cell.className = 'day-cell' + (isChecked?' is-checked':'') + (isToday?' is-today':'') + (isFuture?' is-future':'');
    cell.textContent = isChecked ? '✓' : d;
    cell.addEventListener('click', () => toggleDay(key));
    grid.appendChild(cell);
  }

  const todayChecked = cal.checkedDates.includes(today);
  const markBtn = document.getElementById('todayMarkBtn');
  document.getElementById('todayCardIcon').textContent = todayChecked ? '✅' : '📌';
  const now = new Date();
  document.getElementById('todayCardDate').textContent = `${now.getDate()} ${MONTH_NAMES[now.getMonth()].toLowerCase()}`;
  markBtn.textContent = todayChecked ? 'Позначено ✓' : 'Позначити день';
  markBtn.disabled = todayChecked;
  markBtn.onclick = () => toggleDay(today, true);
}

function toggleDay(key, showToast) {
  const cal = getCurrentCal();
  if (!cal) return;
  const idx = cal.checkedDates.indexOf(key);
  if (idx >= 0) { cal.checkedDates.splice(idx,1); }
  else {
    cal.checkedDates.push(key);
    hapticNotify('success');
    checkAchievements();
    if (showToast) showDayToast();
  }
  saveState();
  renderCalendarDetail();
}

function showDayToast() {
  const toast = document.getElementById('dayToast');
  toast.classList.add('is-visible');
  setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

document.getElementById('prevMonthBtn').addEventListener('click', () => { viewMonth-=1; if(viewMonth<0){viewMonth=11;viewYear-=1;} renderCalendarDetail(); haptic('light'); });
document.getElementById('nextMonthBtn').addEventListener('click', () => { viewMonth+=1; if(viewMonth>11){viewMonth=0;viewYear+=1;} renderCalendarDetail(); haptic('light'); });

// ==================== STATISTICS ====================
let statsTab = 'total';
document.querySelectorAll('#statsTabsRow .tab-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    statsTab = btn.dataset.stab;
    document.querySelectorAll('#statsTabsRow .tab-chip').forEach((b) => b.classList.remove('tab-chip--active'));
    btn.classList.add('tab-chip--active');
    renderStats();
  });
});
document.getElementById('statsBackBtn').addEventListener('click', () => showScreen('calendar-detail'));

function renderStats() {
  const cal = getCurrentCal();
  if (!cal) return;

  const checked = cal.checkedDates.length;
  const target = cal.target || Math.max(checked, 1);
  const pct = Math.min(100, (checked/target)*100);

  document.getElementById('statDonut').style.background = `conic-gradient(var(--blue) 0% ${pct}%, rgba(255,255,255,0.08) ${pct}% 100%)`;
  document.getElementById('donutPercent').textContent = fmtPct(pct);
  document.getElementById('donutSub').textContent = `${checked} / ${cal.target || '∞'} днів`;

  const start = new Date(cal.startDate);
  const now = new Date();
  const daysPassed = Math.max(1, Math.round((now - start) / 86400000) + 1);
  const skipped = Math.max(0, daysPassed - checked);

  document.getElementById('statDone').textContent = checked;
  document.getElementById('statSkip').textContent = skipped;
  document.getElementById('statBestStreak').textContent = bestStreakForCal(cal) + ' днів';
  document.getElementById('statRecord').textContent = Math.max(bestStreakForCal(cal), currentStreak(cal)) + ' днів';

  const bars = document.getElementById('weekBars');
  bars.innerHTML = '';
  const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  for (let i=6;i>=0;i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isChecked = cal.checkedDates.includes(key);
    const bar = document.createElement('div');
    bar.className = 'week-bar-col';
    bar.innerHTML = `<div class="week-bar-track"><div class="week-bar-fill${isChecked?' is-done':''}" style="height:${isChecked?'100%':'12%'}"></div></div><span class="week-bar-label">${labels[(d.getDay()+6)%7]}</span>`;
    bars.appendChild(bar);
  }
}

// ==================== CALENDAR SETTINGS ====================
document.getElementById('settingsBackBtn').addEventListener('click', () => showScreen('calendar-detail'));

function renderCalSettings() {
  const cal = getCurrentCal();
  if (!cal) return;
  updateToggle(document.getElementById('reminderToggle'), cal.reminders);
  updateToggle(document.getElementById('autoMarkToggle'), cal.autoMark);
}

function updateToggle(el, on) { el.classList.toggle('is-on', !!on); }

document.getElementById('reminderToggle').addEventListener('click', function() {
  const cal = getCurrentCal(); if (!cal) return;
  cal.reminders = !cal.reminders; saveState(); updateToggle(this, cal.reminders); haptic('light');
});
document.getElementById('autoMarkToggle').addEventListener('click', function() {
  const cal = getCurrentCal(); if (!cal) return;
  cal.autoMark = !cal.autoMark; saveState(); updateToggle(this, cal.autoMark); haptic('light');
});
document.getElementById('editCalBtn').addEventListener('click', () => {
  const cal = getCurrentCal(); if (!cal) return;
  const newName = prompt('Нова назва календаря:', cal.name);
  if (newName && newName.trim()) { cal.name = newName.trim(); saveState(); hapticNotify('success'); }
});
document.getElementById('archiveCalBtn').addEventListener('click', () => {
  const cal = getCurrentCal(); if (!cal) return;
  cal.archived = !cal.archived; saveState(); hapticNotify('success');
  showScreen('calendars');
});
document.getElementById('deleteCalBtn').addEventListener('click', () => {
  if (!confirm('Видалити цей календар? Дію не можна скасувати.')) return;
  state.calendars = state.calendars.filter((c) => c.id !== currentCalId);
  saveState(); hapticNotify('success');
  showScreen('calendars');
});

// ==================== COMMUNITY ====================
let communityTab = 'popular';
document.querySelectorAll('#communityTabsRow .tab-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    communityTab = btn.dataset.ctab;
    document.querySelectorAll('#communityTabsRow .tab-chip').forEach((b) => b.classList.remove('tab-chip--active'));
    btn.classList.add('tab-chip--active');
    renderCommunity();
  });
});

let openChallengeId = null;

function renderCommunity() {
  const list = document.getElementById('communityList');
  list.innerHTML = '';

  if (communityTab === 'mine') {
    if (state.myChallenges.length === 0) {
      list.innerHTML = `<div class="settings-empty">Ти ще не створив жодного челенджу</div>`;
    } else {
      state.myChallenges.forEach((ch) => list.appendChild(buildChallengeRow(ch, true)));
    }
    const createBtn = document.createElement('button');
    createBtn.className = 'add-card-new';
    createBtn.innerHTML = '<span class="add-plus">＋</span><span>Створити челендж</span>';
    createBtn.addEventListener('click', () => showScreen('create-challenge'));
    list.appendChild(createBtn);
    return;
  }

  const items = COMMUNITY_CHALLENGES.filter((c) => c.category === communityTab || (communityTab==='popular'));
  items.forEach((ch) => list.appendChild(buildChallengeRow(ch, false)));
}

function buildChallengeRow(ch, isMine) {
  const row = document.createElement('div');
  row.className = 'community-row';
  row.innerHTML = `
    <div class="cal-row-icon">${ch.icon}</div>
    <div class="cal-row-info">
      <div class="cal-row-top"><span class="cal-row-name">${ch.name}</span></div>
      <div class="community-participants">${isMine ? 'Ваш челендж' : fmtCount(ch.participants) + ' учасників'}</div>
    </div>
    <button class="join-btn-small">Приєднатися</button>`;
  row.querySelector('.cal-row-icon').parentElement.querySelector('.cal-row-info').addEventListener('click', () => openChallengeDetail(ch));
  row.querySelector('.join-btn-small').addEventListener('click', (e) => { e.stopPropagation(); joinChallenge(ch); });
  return row;
}

function fmtCount(n) { return n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'K' : n; }

function openChallengeDetail(ch) {
  openChallengeId = ch.id;
  showScreen('challenge-detail');
}


document.getElementById('challengeBackBtn').addEventListener('click', () => showScreen('community'));

function joinChallenge(ch) {
  const exists = state.calendars.find((c) => c.name === ch.name && c.fromChallenge);
  if (exists) { hapticNotify('warning'); return; }
  state.calendars.push({
    id: 'cal_' + Date.now(), name: ch.name, icon: ch.icon, target: 30,
    startDate: todayStr(), archived: false, reminders: true, autoMark: false, checkedDates: [], fromChallenge: true,
  });
  saveState();
  hapticNotify('success');
  showScreen('home');
}

document.getElementById('joinChallengeBtn').addEventListener('click', () => {
  const ch = COMMUNITY_CHALLENGES.find((c) => c.id === openChallengeId) || state.myChallenges.find((c) => c.id === openChallengeId);
  if (ch) joinChallenge(ch);
});

// показ деталей челенджу рендериться через renderChallengeDetail() у мапі renderers
function renderChallengeDetail() {
  const ch = COMMUNITY_CHALLENGES.find((c) => c.id === openChallengeId) || state.myChallenges.find((c) => c.id === openChallengeId);
  if (!ch) return;
  document.getElementById('challengeHero').innerHTML = `<span class="challenge-hero-icon">${ch.icon}</span><span class="challenge-hero-name">${ch.name}</span>`;
  document.getElementById('challengeDesc').textContent = ch.desc || 'Челендж від спільноти NEXORA.';
  document.getElementById('challengeStatsRow').innerHTML = `
    <div class="ds-item"><span class="ds-num">${fmtCount(ch.participants||0)}</span><span class="ds-label">Учасників</span></div>
    <div class="ds-item"><span class="ds-num">30</span><span class="ds-label">Днів</span></div>`;
}

// ==================== CREATE CHALLENGE ====================
let chSelectedEmoji = EMOJI_OPTIONS[0];
function renderCreateChallengeForm() {
  chSelectedEmoji = EMOJI_OPTIONS[0];
  document.getElementById('chNameInput').value = '';
  document.getElementById('chDescInput').value = '';
  renderEmojiRow(document.getElementById('chEmojiRow'), (e) => chSelectedEmoji = e, chSelectedEmoji);
}
document.getElementById('createChallengeBtn').addEventListener('click', () => {
  const name = document.getElementById('chNameInput').value.trim();
  if (!name) { document.getElementById('chNameInput').focus(); return; }
  const ch = { id: 'mych_' + Date.now(), icon: chSelectedEmoji, name, desc: document.getElementById('chDescInput').value.trim(), participants: 1 };
  state.myChallenges.push(ch);
  saveState();
  hapticNotify('success');
  showScreen('community');
});

// ==================== PROFILE ====================
function renderProfile() {
  document.getElementById('profileAvatarNew').textContent = state.userName.charAt(0).toUpperCase();
  document.getElementById('profileNameNew').textContent = state.userName;
  document.getElementById('premiumTag').style.display = state.premium ? 'inline-flex' : 'none';
  document.getElementById('prCalCount').textContent = state.calendars.length;
  document.getElementById('prDaysCount').textContent = totalCheckedAll(state);
  document.getElementById('prAchvCount').textContent = Object.keys(state.unlockedAchievements).length;
}

// ==================== ACHIEVEMENTS ====================
function renderAchievements() {
  checkAchievements(); saveState();
  const trophyGrid = document.getElementById('trophyGrid');
  trophyGrid.innerHTML = '';
  ACHIEVEMENT_DEFS.slice(0,3).forEach((a) => {
    const unlocked = !!state.unlockedAchievements[a.id];
    const el = document.createElement('div');
    el.className = 'trophy-item' + (unlocked ? ' is-unlocked' : '');
    el.innerHTML = `<div class="trophy-icon">${unlocked ? a.icon : '🔒'}</div><div class="trophy-name">${a.name}</div>`;
    trophyGrid.appendChild(el);
  });

  const list = document.getElementById('achvList');
  list.innerHTML = '';
  ACHIEVEMENT_DEFS.forEach((a) => {
    const unlocked = !!state.unlockedAchievements[a.id];
    const el = document.createElement('div');
    el.className = 'achv-list-item' + (unlocked ? ' is-unlocked' : '');
    el.innerHTML = `<span class="achv-list-icon">${unlocked ? a.icon : '🔒'}</span><span class="achv-list-text"><b>${a.name}</b><span>${a.desc}</span></span>`;
    list.appendChild(el);
  });
}

// ==================== STORE ====================
let storeTab = 'themes';
document.querySelectorAll('#storeTabsRow .tab-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    storeTab = btn.dataset.sttab;
    document.querySelectorAll('#storeTabsRow .tab-chip').forEach((b) => b.classList.remove('tab-chip--active'));
    btn.classList.add('tab-chip--active');
    renderStore();
  });
});

function renderStore() {
  const grid = document.getElementById('themeGrid');
  const soon = document.getElementById('storeSoon');
  if (storeTab !== 'themes') { grid.style.display='none'; soon.style.display='block'; return; }
  grid.style.display = 'grid'; soon.style.display = 'none';
  grid.innerHTML = '';
  THEMES.forEach((th) => {
    const owned = state.ownedThemes.includes(th.id);
    const active = state.theme === th.id;
    const card = document.createElement('div');
    card.className = 'theme-card' + (active ? ' is-active' : '');
    card.innerHTML = `
      <div class="theme-swatch" style="background:linear-gradient(135deg, ${th.colors[0]}, ${th.colors[1]})"></div>
      <div class="theme-name">${th.name}</div>
      <div class="theme-price">${owned ? (active ? 'Активна' : 'Обрати') : th.price + ' ⭐'}</div>`;
    card.addEventListener('click', () => {
      if (!owned) { state.ownedThemes.push(th.id); }
      state.theme = th.id;
      applyTheme(th);
      saveState();
      renderStore();
      hapticNotify('success');
    });
    grid.appendChild(card);
  });
}

function applyTheme(th) {
  document.documentElement.style.setProperty('--blue', th.colors[0]);
  document.documentElement.style.setProperty('--blue-2', th.colors[1]);
}

// ==================== GIFT PREMIUM ====================
let giftPlan = 30;
const GIFT_PLANS = [{days:7,price:7},{days:30,price:20},{days:365,price:100}];
function renderGiftPremium() {
  document.getElementById('giftNameInput').value = '';
  const list = document.getElementById('giftPlanList');
  list.innerHTML = '';
  GIFT_PLANS.forEach((p) => {
    const chip = document.createElement('button');
    chip.className = 'dur-chip' + (p.days === giftPlan ? ' is-selected' : '');
    chip.textContent = `${p.days} днів — ${p.price} ⭐`;
    chip.addEventListener('click', () => { giftPlan = p.days; renderGiftPremium(); haptic('light'); });
    list.appendChild(chip);
  });
}
document.getElementById('giftSendBtn').addEventListener('click', () => {
  const name = document.getElementById('giftNameInput').value.trim();
  if (!name) { document.getElementById('giftNameInput').focus(); return; }
  hapticNotify('success');
  alert(`Подарунок для ${name} надіслано (демо-режим, оплата не підключена).`);
  showScreen('profile');
});

// ==================== PREMIUM ====================
document.getElementById('premiumBackBtn').addEventListener('click', () => showScreen('profile'));
function renderPremiumScreen() {
  const btn = document.getElementById('subscribeBtn');
  btn.textContent = state.premium ? '✓ Підписка активна (демо)' : 'Оформити підписку (демо)';
}
document.getElementById('subscribeBtn').addEventListener('click', () => {
  state.premium = !state.premium;
  saveState(); hapticNotify('success'); renderPremiumScreen(); renderProfile();
});
document.getElementById('restoreBtn').addEventListener('click', () => {
  alert(state.premium ? 'Підписку відновлено.' : 'Активної підписки не знайдено.');
});

// (challenge-detail рендериться напряму через мапу renderers вище)

// ==================== Старт ====================
applyTheme(THEMES.find((t) => t.id === state.theme) || THEMES[0]);
checkAchievements();
saveState();
