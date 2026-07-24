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
  const selected = btn.classList.toggle('selected');
  btn.setAttribute('aria-pressed', String(selected));
}
function getSelectedPlatforms() {
  return [...document.querySelectorAll('.platform-btn.selected')]
    .map(b => b.textContent).join(', ') || 'не выбрано';
}

// ── APPLICATION FORM SUBMIT ─────────────────────────────────────────────
// Секция #apply может иметь data-direction / data-direction-label —
// так лид в Telegram сразу помечен направлением (SMM, сайты, боты),
// с которого он пришёл, и его не нужно разбирать вручную.

// #formContainer — это <form>, поэтому заявка уходит и по Enter в поле,
// и по клику. Раньше форма была <div> с onclick на кнопке: Enter не
// срабатывал, и часть заявок молча терялась.
document.getElementById('formContainer')?.addEventListener('submit', (e) => {
  e.preventDefault();
  submitApplication();
});

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
    contact ? `💬 *Мессенджер:* ${contact}` : '',
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
      const successScreen = document.getElementById('successScreen');
      successScreen.classList.add('show');
      successScreen.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tg?.MainButton.hide();
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      throw new Error(data.description);
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Отправить заявку →';
    // Показываем ошибку в самой форме, а не в alert(): нативный диалог
    // выбивается из оформления, а внутри Telegram Mini App выглядит чужеродно.
    // Заполненные поля при этом остаются на месте — человеку есть что отправить
    // повторно, и рядом лежит запасной канал связи.
    errEl.style.display = 'block';
    errEl.innerHTML = 'Не удалось отправить заявку — возможно, пропала связь. ' +
      'Попробуйте ещё раз или напишите напрямую: ' +
      '<a href="https://t.me/idwvw" target="_blank" rel="noopener" style="color:var(--accent);">t.me/idwvw</a>';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tg?.HapticFeedback?.notificationOccurred('error');
  }
}

// ============================================================
// AI CHAT WIDGET
// ============================================================
let chatOpen = false;
let chatHistory = [];        // контекст для API: {role:'user'|'assistant', content}
let chatBusy = false;
let renderedMessages = [];   // показанные сообщения (кроме приветствия): {role, text, time}

// Разметка и стили виджета живут прямо здесь, чтобы чат сам появлялся на любой
// странице, где подключён app.js — даже если в её HTML нет блока чата и не
// подключён styles.css (как на privacy-policy). Стили вставляются только туда,
// где их ещё нет, поэтому на основных страницах styles.css остаётся главным.
const CHAT_CSS = `
.ai-chat-btn { position: fixed; bottom: 80px; right: 16px; width: 48px; height: 48px; background: var(--accent); color: #0a0a0a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 95; transition: transform 0.2s, box-shadow 0.2s, opacity 0.25s; box-shadow: 0 4px 20px rgba(200,240,96,0.3); opacity: 0; pointer-events: none; transform: scale(0.85); }
.ai-chat-btn.visible { opacity: 1; pointer-events: auto; transform: scale(1); }
.ai-chat-btn.chat-open { opacity: 1; pointer-events: auto; transform: scale(1); }
.ai-chat-btn:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(200,240,96,0.45); }
.ai-chat-btn .chat-tooltip { position: absolute; right: 56px; top: 50%; transform: translateY(-50%); background: var(--bg2); border: 1px solid var(--border); color: var(--white); font-family: 'Geologica', sans-serif; font-size: 12px; white-space: nowrap; padding: 6px 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
.ai-chat-btn:hover .chat-tooltip { opacity: 1; }
.ai-chat-window { position: fixed; bottom: 136px; right: 16px; width: min(360px, calc(100vw - 32px)); height: min(480px, calc(100vh - 160px)); background: var(--bg2); border: 1px solid var(--border); display: flex; flex-direction: column; z-index: 95; opacity: 0; pointer-events: none; transform: translateY(16px) scale(0.97); transition: opacity 0.25s, transform 0.25s; box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
.ai-chat-window.open { opacity: 1; pointer-events: all; transform: translateY(0) scale(1); }
.chat-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.chat-header-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px rgba(200,240,96,0.7); animation: chatPulse 2s infinite; }
@keyframes chatPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.chat-header-title { font-family: 'Bebas Neue', 'Oswald', sans-serif; font-size: 16px; letter-spacing: 0.08em; flex: 1; }
.chat-header-sub { font-size: 10px; color: var(--gray); letter-spacing: 0.05em; }
.chat-close { background: none; border: none; color: var(--gray); font-size: 18px; cursor: pointer; padding: 0; transition: color 0.2s; line-height: 1; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
.chat-close:hover { color: var(--accent); }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--border); }
.chat-msg { max-width: 85%; display: flex; flex-direction: column; gap: 4px; }
.chat-msg.user { align-self: flex-end; align-items: flex-end; }
.chat-msg.bot { align-self: flex-start; align-items: flex-start; }
.chat-bubble { padding: 10px 14px; font-size: 13px; line-height: 1.6; font-family: 'Geologica', sans-serif; }
.chat-msg.user .chat-bubble { background: var(--accent); color: #0a0a0a; font-weight: 500; }
.chat-msg.bot .chat-bubble { background: var(--bg3); color: var(--white); border-left: 2px solid var(--accent); }
.chat-msg-time { font-size: 10px; color: var(--gray); letter-spacing: 0.05em; }
.chat-typing { align-self: flex-start; display: none; gap: 5px; align-items: center; padding: 12px 16px; background: var(--bg3); border-left: 2px solid var(--accent); }
.chat-typing.show { display: flex; }
.chat-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.4; animation: typingDot 1.2s infinite; }
.chat-typing span:nth-child(2) { animation-delay: 0.2s; }
.chat-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingDot { 0%,60%,100%{opacity:0.4; transform:scale(1)} 30%{opacity:1; transform:scale(1.3)} }
.chat-footer { padding: 12px; border-top: 1px solid var(--border); display: flex; gap: 8px; flex-shrink: 0; }
.chat-input { flex: 1; background: var(--bg3); border: 1px solid var(--border); padding: 10px 14px; color: var(--white); font-family: 'Geologica', sans-serif; font-size: 13px; outline: none; resize: none; height: 40px; transition: border-color 0.2s; border-radius: 0; line-height: 1.4; }
.chat-input:focus { border-color: var(--accent); }
.chat-input::placeholder { color: var(--gray); }
.chat-send { width: 40px; height: 40px; flex-shrink: 0; background: var(--accent); color: #0a0a0a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: opacity 0.2s; }
.chat-send:hover { opacity: 0.85; }
.chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-hints { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 12px; flex-shrink: 0; }
.chat-hint { font-size: 11px; padding: 5px 10px; border: 1px solid var(--border); color: var(--gray); cursor: pointer; font-family: 'Geologica', sans-serif; transition: border-color 0.2s, color 0.2s; background: none; letter-spacing: 0.03em; }
.chat-hint:hover { border-color: var(--accent); color: var(--accent); }
`;

const CHAT_HTML = `
<button class="ai-chat-btn" id="aiChatBtn" onclick="toggleAiChat()" aria-label="AI-ассистент">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="4" fill="#0a0a0a"/><path d="M3.8 19.8C3.8 15.4 7.5 12.8 12 12.8C16.5 12.8 20.2 15.4 20.2 19.8Z" fill="#0a0a0a"/><circle cx="15.7" cy="7.6" r="1.2" fill="#0a0a0a"/><path d="M15.7 8.8C15.6 10.2 15 11 14.2 12.6" stroke="#0a0a0a" stroke-width="1" stroke-linecap="round"/></svg>
  <span class="chat-tooltip">Спросить ассистента</span>
</button>
<div class="ai-chat-window" id="aiChatWindow">
  <div class="chat-header">
    <div class="chat-header-dot"></div>
    <div>
      <div class="chat-header-title">Агент AVI</div>
      <div class="chat-header-sub">Ассистент AUVIX Studio</div>
    </div>
    <button class="chat-close" onclick="toggleAiChat()">✕</button>
  </div>
  <div class="chat-messages" id="chatMessages">
    <div class="chat-msg bot">
      <div class="chat-bubble">На связи Агент AVI — ассистент AUVIX Studio. Подскажу по услугам, ценам и кейсам, помогу оставить заявку 👋</div>
      <div class="chat-msg-time">сейчас</div>
    </div>
  </div>
  <div class="chat-typing" id="chatTyping"><span></span><span></span><span></span></div>
  <div class="chat-hints" id="chatHints">
    <button class="chat-hint" onclick="sendHint(this)">Сколько стоит?</button>
    <button class="chat-hint" onclick="sendHint(this)">Что входит в пакет?</button>
    <button class="chat-hint" onclick="sendHint(this)">Как начать?</button>
    <button class="chat-hint" onclick="sendHint(this)">Сроки?</button>
  </div>
  <div class="chat-footer">
    <textarea class="chat-input" id="chatInput" placeholder="Задайте вопрос..." rows="1" onkeydown="handleChatKey(event)"></textarea>
    <button class="chat-send" id="chatSendBtn" onclick="sendChatMessage()">→</button>
  </div>
</div>
`;

// Вставляем виджет только если его ещё нет в разметке страницы.
function ensureChatWidget() {
  if (document.getElementById('aiChatBtn')) return;
  if (!document.getElementById('auvix-chat-styles')) {
    const style = document.createElement('style');
    style.id = 'auvix-chat-styles';
    style.textContent = CHAT_CSS;
    document.head.appendChild(style);
  }
  document.body.insertAdjacentHTML('beforeend', CHAT_HTML);
}

function setChatOpen(state) {
  chatOpen = state;
  document.getElementById('aiChatWindow')?.classList.toggle('open', chatOpen);
  const btn = document.getElementById('aiChatBtn');
  btn?.classList.toggle('chat-open', chatOpen);
  if (chatOpen) btn?.classList.add('visible');
  if (chatOpen) setTimeout(() => document.getElementById('chatInput')?.focus(), 250);
  persistChat();
}

function toggleAiChat() {
  setChatOpen(!chatOpen);
}

// ── ПАМЯТЬ ПЕРЕПИСКИ ─────────────────────────────────────────────────────
// Переписка живёт в sessionStorage: сохраняется при переходах между страницами
// сайта, но при перезагрузке (F5 / обновление) начинается заново.
const CHAT_KEY = 'auvix_chat_v1';

(function resetChatOnReload() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload') sessionStorage.removeItem(CHAT_KEY);
  } catch (_) {}
})();

function persistChat() {
  try {
    sessionStorage.setItem(CHAT_KEY, JSON.stringify({
      open: chatOpen, msgs: renderedMessages, history: chatHistory
    }));
  } catch (_) {}
}

function restoreChat() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(CHAT_KEY) || 'null'); } catch (_) {}
  if (!saved) return;
  if (Array.isArray(saved.history)) chatHistory = saved.history;
  if (Array.isArray(saved.msgs) && saved.msgs.length) {
    const hints = document.getElementById('chatHints');
    if (hints) hints.style.display = 'none';
    saved.msgs.forEach(m => {
      renderMessage(m.role, m.text, m.time);
      renderedMessages.push(m);
    });
  }
  if (saved.open) setChatOpen(true);
}

// Появление кнопки: на длинных страницах — после прокрутки, на коротких
// (где прокручивать нечего, например privacy-policy) — сразу.
function initChatUI() {
  ensureChatWidget();
  const btn = document.getElementById('aiChatBtn');
  if (btn) {
    const update = () => {
      const scrollable = (document.documentElement.scrollHeight - window.innerHeight) > 600;
      btn.classList.toggle('visible', chatOpen || !scrollable || window.scrollY > 500);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }
  restoreChat();
}
initChatUI();

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
      persistChat();
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

function renderMessage(role, text, time) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-bubble">${escapeHtml(text)}</div>
    <div class="chat-msg-time">${escapeHtml(time)}</div>
  `;
  messages.appendChild(div);
  scrollChat();
}

function appendMessage(role, text) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  renderMessage(role, text, time);
  renderedMessages.push({ role, text, time });
  persistChat();
}

function scrollChat() {
  const m = document.getElementById('chatMessages');
  m.scrollTop = m.scrollHeight;
}

function escapeHtml(str) {
  return escText(str).replace(/\n/g, '<br>');
}

// ============================================================
// ОБЩИЕ ХЕЛПЕРЫ ЭКРАНИРОВАНИЯ
// ============================================================
// Раньше почти одинаковые esc-функции жили в трёх файлах и успели разъехаться:
// вариант в cases.html не экранировал кавычки, хотя подставлялся внутрь
// атрибутов. Держим одну пару на весь сайт.

// Для текста между тегами.
function escText(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Для значения внутри атрибута: кавычки обязательны, иначе значение
// вроде `" onerror="...` вырвется из атрибута и выполнит код.
function escAttr(str) {
  return escText(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Пропускает только http(s). Отсекает javascript:, data: и прочие схемы,
// которые в href превращаются в исполняемый код.
function safeUrl(url) {
  const u = (url || '').toString().trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

window.__auvixEsc = { escText, escAttr, safeUrl };
