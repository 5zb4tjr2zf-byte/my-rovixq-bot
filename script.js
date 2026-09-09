const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

function haptic(style = 'light') {
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
}

const ghostWrap = document.getElementById('ghostWrap');
const stage = document.querySelector('.stage');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

const STEP = 60; // на скільки пікселів рухається персонаж за одне натискання
let posPercent = 50; // позиція по центру (0-100% ширини сцени)

function clampAndApply() {
  const stageWidth = stage.clientWidth;
  const ghostHalf = ghostWrap.clientWidth / 2;
  const minPercent = (ghostHalf / stageWidth) * 100;
  const maxPercent = 100 - minPercent;
  posPercent = Math.max(minPercent, Math.min(maxPercent, posPercent));
  ghostWrap.style.left = posPercent + '%';
}

function step(direction) {
  const stageWidth = stage.clientWidth;
  const deltaPercent = (STEP / stageWidth) * 100;
  posPercent += direction * deltaPercent;
  clampAndApply();

  ghostWrap.classList.toggle('facing-left', direction < 0);
  ghostWrap.classList.remove('is-stepping');
  void ghostWrap.offsetWidth;
  ghostWrap.classList.add('is-stepping');

  haptic('light');
}

btnLeft.addEventListener('click', () => step(-1));
btnRight.addEventListener('click', () => step(1));

window.addEventListener('resize', clampAndApply);
clampAndApply();
