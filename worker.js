// ============================================================
// AUVIX STUDIO — Cloudflare Worker для приёма заявок
// ============================================================
// Это БЭКЕНД, который принимает заявку с сайта и отправляет её в Telegram,
// а также ведёт статус заявки в канале: Новая → В работе → Закрыта.
// Деплоится отдельно в Cloudflare Workers (адрес в app.js -> WORKER_URL,
// сейчас: https://auvix.ivankatsan24954.workers.dev/).
//
// Файлы сайта (index.html, app.js и т.д.) сами в Telegram НЕ пишут —
// они только шлют сюда POST { text }. Токен бота живёт здесь, на сервере,
// в переменной окружения env.BOT_TOKEN и наружу не попадает.
//
// Воркер обрабатывает ДВА вида POST-запросов на один и тот же адрес:
//   1) Заявка с сайта — тело вида { text: "..." }.
//      Шлём её вам в личку (env.CHAT_ID) и в канал (CHANNEL_ID).
//      К сообщению в канале прикрепляем кнопку «✅ Принять заявку».
//   2) Апдейт от Telegram — тело содержит callback_query (нажатие кнопки).
//      Ведём статус заявки прямо в кнопках под сообщением.
//
// Жизненный цикл заявки в канале (кнопки под сообщением):
//   Новая:    [ ✅ Принять заявку ]
//   В работе: [ 🟢 В работе — Имя (@user) ]  +  [ 🔒 Закрыть заявку ]
//   Закрыта:  [ ☑️ Закрыто — Имя (@user) ]
//
// ── Переменные окружения (Settings → Variables and Secrets) ─────────────
//   BOT_TOKEN — токен бота от @BotFather (Secret).
//   CHAT_ID   — ваш личный chat_id, куда заявки шли раньше.
//
// ── ВАЖНО, разовая настройка ────────────────────────────────────────────
// Чтобы кнопки работали, у бота должен быть включён webhook на адрес этого
// воркера. Один раз откройте в браузере (подставив свой токен):
//   https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://auvix.ivankatsan24954.workers.dev/
// Проверить: https://api.telegram.org/bot<ТОКЕН>/getWebhookInfo
//
// И бот должен быть администратором канала с правом «Публикация сообщений».
// ============================================================

// Telegram-канал, куда дублируются заявки (id вида -100...).
const CHANNEL_ID = -1004459488439;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return new Response('Bad JSON', { status: 400 });
    }

    // (1) Нажатие кнопки в канале — приходит от Telegram как callback_query.
    if (body.callback_query) {
      try {
        await handleCallback(body.callback_query, env);
      } catch (_) {
        // Глушим ошибку, чтобы Telegram не слал повторы — ему нужен ответ 200.
      }
      return new Response('OK');
    }

    // (2) Заявка с сайта: { text }.
    if (body.text) {
      return handleSubmission(body.text, env);
    }

    // Прочие апдейты Telegram (сообщения, /start и т.п.) — просто подтверждаем.
    return new Response('OK');
  }
};

// ── Заявка с сайта → в личку и в канал ──────────────────────────────────
async function handleSubmission(text, env) {
  const send = (chat_id, extra = {}) => fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown', ...extra })
    }
  );

  // В личку — как раньше, без кнопки. Её ответ возвращаем сайту.
  const adminPromise = send(env.CHAT_ID);

  // В канал — с кнопкой «Принять заявку». best-effort: сбой не ломает ответ.
  const channelPromise = send(CHANNEL_ID, {
    reply_markup: {
      inline_keyboard: [[{ text: '✅ Принять заявку', callback_data: 'accept' }]]
    }
  }).catch(() => null);

  const res = await adminPromise;
  const data = await res.json();
  await channelPromise;

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// ── Нажатия кнопок под заявкой в канале ─────────────────────────────────
async function handleCallback(cq, env) {
  const api = (method, payload) => fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  const data = cq.data;
  const msg = cq.message || {};
  const chatId = msg.chat && msg.chat.id;
  const messageId = msg.message_id;
  const setButtons = (rows) => api('editMessageReplyMarkup', {
    chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: rows }
  });
  const toast = (text) => api('answerCallbackQuery', { callback_query_id: cq.id, text });

  // «Принять» → перевести заявку в статус «В работе» и показать «Закрыть».
  if (data === 'accept') {
    const who = formatUser(cq.from);
    await setButtons([
      [{ text: `🟢 В работе — ${who}`, callback_data: 'status' }],
      [{ text: '🔒 Закрыть заявку', callback_data: 'close' }],
    ]);
    await toast('Вы приняли заявку ✅');
    return;
  }

  // «Закрыть» → перевести заявку в статус «Закрыто» (кто принял — сохраняем).
  if (data === 'close') {
    const accepter = extractAccepter(msg) || formatUser(cq.from);
    await setButtons([
      [{ text: `☑️ Закрыто — ${accepter}`, callback_data: 'done' }],
    ]);
    await toast('Заявка закрыта ☑️');
    return;
  }

  // Нажатия на информационные плашки статуса — просто подсказка, без изменений.
  if (data === 'status') {
    await toast('Заявка в работе. Нажмите «Закрыть заявку», когда завершите.');
    return;
  }
  if (data === 'done') {
    await toast('Эта заявка уже закрыта.');
    return;
  }
  if (data === 'taken') { // старые сообщения по прежней логике «Принято»
    await toast('Заявка уже принята.');
    return;
  }

  // Неизвестная кнопка — просто подтверждаем нажатие.
  await toast('');
}

// Имя нажавшего для показа в кнопке: «Имя Фамилия (@username)», с ограничением длины.
function formatUser(u) {
  u = u || {};
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'без имени';
  let who = u.username ? `${name} (@${u.username})` : name;
  if (who.length > 48) who = who.slice(0, 47) + '…';
  return who;
}

// Достаём «кто принял» из текущей плашки «В работе — ...», чтобы сохранить
// это имя при закрытии заявки (воркер не хранит состояние — берём из кнопки).
function extractAccepter(msg) {
  const rows = msg && msg.reply_markup && msg.reply_markup.inline_keyboard;
  if (!Array.isArray(rows)) return '';
  for (const row of rows) {
    for (const btn of row) {
      const m = btn && typeof btn.text === 'string' && btn.text.match(/В работе\s*—\s*(.+)$/);
      if (m) return m[1].trim();
    }
  }
  return '';
}
