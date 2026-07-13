// ============================================================
// AUVIX STUDIO — общий скрипт сайта
// Подключается на всех страницах: <script src="app.js" defer></script>
// Все функции защищены проверками на существование элементов,
// поэтому один и тот же файл безопасно работает на любой странице,
// даже если на ней нет формы заявки, чата или конкретных секций.
// ============================================================

const WORKER_URL = 'https://auvix.ivankatsan24954.workers.dev/';
const CHAT_WORKER_URL = 'https://keyai.ivankatsan24954.workers.dev/';
const YM_ID = 109533947;

// ── TELEGRAM MINI APP INIT ───────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0a0a0a');
  tg.setBackgroundColor('#0a0a0a');
  if (document.getElementById('apply')) {
    tg.MainButton.setText('📋 Оставить заявку');
    tg.MainButton.color = '#c8f060';
    tg.MainButton.textColor = '#0a0a0a';
    tg.MainButton.show();
    tg.MainButton.onClick(() => scrollToApply());
  }
}

// ── SCROLL TO APPLY (со страниц без формы — на главную) ─────────────────
function scrollToApply() {
  const apply = document.getElementById('apply');
  if (apply) {
    apply.scrollIntoView({ behavior: 'smooth' });
  } else {
    window.location.href = 'index.html#apply';
  }
}

// ── MOBILE NAV ────────────────────────────────────────────────────────────
function toggleMobileNav() {
  const nav = document.getElementById('mobileNav');
  const btn = document.getElementById('burgerBtn');
  if (!nav || !btn) return;
  nav.classList.toggle('open');
  btn.classList.toggle('open');
  document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
}
function closeMobileNav() {
  document.getElementById('mobileNav')?.classList.remove('open');
  document.getElementById('burgerBtn')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── SCROLL EFFECTS (progress line, nav background, back-to-top) ─────────
(function initScrollEffects() {
  const scrollLine = document.getElementById('scrollLine');
  const navbar = document.getElementById('navbar');
  const backToTop = document.getElementById('backToTop');
  if (!scrollLine && !navbar && !backToTop) return;

  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    if (scrollLine) scrollLine.style.width = pct + '%';
    navbar?.classList.toggle('scrolled', window.scrollY > 60);
    backToTop?.classList.toggle('visible', window.scrollY > 400);
    document.getElementById('aiChatBtn')?.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  backToTop?.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ── SCROLL REVEAL ──────────────────────────────────────────────────────────
(function initReveal() {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  // Экспортируем — нужно cases.html, чтобы навешивать reveal на кейсы,
  // подгруженные асинхронно из Firestore уже после первого прохода.
  window.__auvixInitReveal = function () {
    document.querySelectorAll('.reveal:not(.reveal-bound)').forEach(el => {
      el.classList.add('reveal-bound');
      revealObserver.observe(el);
    });
  };
})();

// ── CASE CATEGORY INFERENCE ───────────────────────────────────────────────
// Кейсы в Firestore не имеют явного поля "категория" (кроме тех, что явно
// заданы через data.category из админки — приоритет всегда за ним).
// Для старых записей категория определяется по ключевым словам в названии,
// чтобы фильтрация по направлениям работала сразу, без ручной разметки.
const CASE_CATEGORY_LABELS = { smm: 'SMM и дизайн', web: 'Сайты и PWA', bots: 'Telegram-боты', other: 'Другое' };
function classifyCase(data) {
  if (data.category && CASE_CATEGORY_LABELS[data.category]) return data.category;
  const t = (data.title || '').toLowerCase() + ' ' + (data.description || '').toLowerCase();
  if (/tik ?tok|smm|соц\.?\s*сет|инстаграм|instagram|аккаунт|контент-стратег|карточ(к|е)и товар/.test(t)) return 'smm';
  if (/telegram-?бот|telegram bot|\bбот\b/.test(t)) return 'bots';
  if (/pwa|сайт|веб-?систем|веб-?серви|лендинг|landing/.test(t)) return 'web';
  return 'other';
}
window.__auvixClassifyCase = classifyCase;
window.__auvixCaseCategoryLabels = CASE_CATEGORY_LABELS;

// ── FAQ ──────────────────────────────────────────────────────────────────
function toggleFaq(el) {
  const answer = el.nextElementSibling;
  const arrow = el.querySelector('.faq-arrow');
  const isOpen = answer.classList.contains('open');
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-arrow').forEach(a => a.classList.remove('open'));
  if (!isOpen) { answer.classList.add('open'); arrow.classList.add('open'); }
}

// ── PACKAGE FROM URL (?package=... пришедший со страницы цен) ───────────
let selectedPackage = '';

function applyPackageUI(pkg) {
  const serviceField = document.getElementById('field_service');
  const budgetField = document.getElementById('field_budget');
  if (pkg) {
    if (serviceField) serviceField.style.display = 'none';
    if (budgetField) budgetField.style.display = 'none';
  } else {
    if (serviceField) serviceField.style.display = '';
    if (budgetField) budgetField.style.display = '';
  }
}

(function initPackageBanner() {
  const banner = document.getElementById('packageBanner');
  if (!banner) return;
  const params = new URLSearchParams(window.location.search);
  const pkg = params.get('package');
  if (pkg) {
    selectedPackage = decodeURIComponent(pkg);
    document.getElementById('packageBannerName').textContent = selectedPackage;
    banner.classList.remove('hidden');
    applyPackageUI(selectedPackage);
  }
})();

function clearPackage() {
  selectedPackage = '';
  const banner = document.getElementById('packageBanner');
  banner?.classList.add('hidden');
  applyPackageUI('');
  const url = new URL(window.location.href);
  url.searchParams.delete('package');
  history.replaceState(null, '', url.toString());
}

// ── PLATFORMS ──────────────────────────────────────────────────────────────
function togglePlatform(btn) {
  btn.classList.toggle('selected');
}
function getSelectedPlatforms() {
  return [...document.querySelectorAll('.platform-btn.selected')]
    .map(b => b.textContent).join(', ') || 'не выбрано';
}

// ── APPLICATION FORM SUBMIT ─────────────────────────────────────────────
// Секция #apply может иметь data-direction / data-direction-label —
// так лид в Telegram сразу помечен направлением (SMM, сайты, боты),
// с которого он пришёл, и его не нужно разбирать вручную.
async function submitApplication() {
  const applySection = document.getElementById('apply');
  const name = document.getElementById('f_name').value.trim();
  const phone = document.getElementById('f_phone').value.trim();
  const contact = document.getElementById('f_contact').value.trim();
  const business = document.getElementById('f_business').value.trim();
  const service = document.getElementById('f_service')?.value || '';
  const budget = document.getElementById('f_budget')?.value || '';
  const comment = document.getElementById('f_comment').value.trim();
  const isPromo = document.getElementById('f_promo')?.checked || false;
  const hasConsent = document.getElementById('f_consent').checked;
  const platforms = getSelectedPlatforms();

  const errEl = document.getElementById('formError');
  const phoneDigits = phone.replace(/\D/g, '');
  if (!name || !phone || !business) {
    errEl.style.display = 'block';
    errEl.textContent = 'Заполните обязательные поля: имя, номер телефона и описание бизнеса.';
    return;
  }
  if (phoneDigits.length < 10) {
    errEl.style.display = 'block';
    errEl.textContent = 'Введите корректный номер телефона (минимум 10 цифр).';
    return;
  }
  if (!hasConsent) {
    errEl.style.display = 'block';
    errEl.textContent = 'Подтвердите согласие на обработку персональных данных.';
    return;
  }
  errEl.style.display = 'none';

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Отправляю...';

  const tgUser = tg?.initDataUnsafe?.user;
  const tgUsername = tgUser?.username ? `@${tgUser.username}` : null;
  const tgName = tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : '';
  const clientLine = tgName ? `${name} · ${tgName}` : name;

  const directionLabel = applySection?.dataset.directionLabel;
  const sourceLine = directionLabel
    ? `🔗 Источник: страница «${directionLabel}»`
    : (selectedPackage ? `🔗 Источник: страница пакетов` : `🔗 Источник: форма на главной`);

  const text = [
    `Заявка | Auvix Studio`,
    ``,
    selectedPackage ? `🛒 *ЗАЯВКА С ПАКЕТОМ*` : `📋 *ОБЩАЯ ЗАЯВКА*`,
    ``,
    selectedPackage ? `📦 *Пакет:* ${selectedPackage}` : `🎯 *Интерес:* ${service || 'не указано'}`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `👤 *Клиент:* ${clientLine}`,
    `📞 *Телефон:* ${phone}`,
    contact ? `💬 *Соцсеть:* ${contact}` : '',
    tgUsername ? `🤖 *TG (Mini App):* ${tgUsername}` : '',
    `🏢 *Бизнес:* ${business}`,
    ``,
    platforms !== 'не выбрано' ? `📱 *Платформы:* ${platforms}` : '',
    selectedPackage && service ? `🎯 *Также интересует:* ${service}` : (!selectedPackage && budget ? `💰 *Бюджет:* ${budget}` : ''),
    isPromo ? `🎁 *Хочет пробный проект за отзыв*` : '',
    comment ? `💬 *Комментарий:* ${comment}` : '',
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
    sourceLine,
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.ok) {
      window.ym?.(YM_ID, 'reachGoal', 'form_submit', { package: selectedPackage || 'без пакета', direction: directionLabel || 'общая' });
      if (selectedPackage) {
        const successPackageName = document.getElementById('successPackageName');
        const successPackageBlock = document.getElementById('successPackageBlock');
        if (successPackageName) successPackageName.textContent = selectedPackage;
        if (successPackageBlock) successPackageBlock.style.display = 'block';
      }
      document.getElementById('formContainer').style.display = 'none';
      document.getElementById('successScreen').classList.add('show');
      tg?.MainButton.hide();
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      throw new Error(data.description);
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Отправить заявку →';
    alert('Ошибка отправки. Напишите напрямую: t.me/idwvw');
  }
}

// ============================================================
// AI CHAT WIDGET
// ============================================================
let chatOpen = false;
let chatHistory = [];
let chatBusy = false;

function toggleAiChat() {
  chatOpen = !chatOpen;
  document.getElementById('aiChatWindow')?.classList.toggle('open', chatOpen);
  document.getElementById('aiChatBtn')?.classList.toggle('chat-open', chatOpen);
  if (chatOpen) {
    setTimeout(() => document.getElementById('chatInput')?.focus(), 250);
  }
}

function sendHint(btn) {
  document.getElementById('chatInput').value = btn.textContent;
  document.getElementById('chatHints').style.display = 'none';
  sendChatMessage();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

async function sendChatMessage() {
  if (chatBusy) return;
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  chatBusy = true;
  document.getElementById('chatSendBtn').disabled = true;
  document.getElementById('chatHints').style.display = 'none';

  appendMessage('user', message);

  const typing = document.getElementById('chatTyping');
  typing.classList.add('show');
  scrollChat();

  try {
    const res = await fetch(CHAT_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory })
    });
    const data = await res.json();

    typing.classList.remove('show');

    if (data.reply) {
      appendMessage('bot', data.reply);
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendMessage('bot', 'Что-то пошло не так. Напишите нам напрямую: @idwvw');
    }
  } catch (err) {
    typing.classList.remove('show');
    appendMessage('bot', 'Нет связи. Попробуйте позже или напишите в Telegram: @idwvw');
  }

  chatBusy = false;
  document.getElementById('chatSendBtn').disabled = false;
  input.focus();
}

function appendMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-bubble">${escapeHtml(text)}</div>
    <div class="chat-msg-time">${time}</div>
  `;
  messages.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const m = document.getElementById('chatMessages');
  m.scrollTop = m.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
}
