// ============================================================
// AUVIX STUDIO — Cloudflare Worker для приёма заявок
// ============================================================
// Это БЭКЕНД, который принимает заявку с сайта и отправляет её в Telegram,
// а также обрабатывает нажатие кнопки «Принять заявку» в канале.
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
//      Меняем кнопку на «✅ Принято — <кто принял>».
//
// ── Переменные окружения (Settings → Variables and Secrets) ─────────────
//   BOT_TOKEN — токен бота от @BotFather (Secret).
//   CHAT_ID   — ваш личный chat_id, куда заявки шли раньше.
//
// ── ВАЖНО, разовая настройка ────────────────────────────────────────────
// Чтобы кнопка работала, у бота должен быть включён webhook на адрес этого
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
        await handleAccept(body.callback_query, env);
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

// ── Нажатие кнопки «Принять заявку» в канале ────────────────────────────
async function handleAccept(cq, env) {
  const api = (method, payload) => fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  // Заявку уже приняли (кнопка стала со статусом) — просто сообщаем об этом.
  if (cq.data === 'taken') {
    await api('answerCallbackQuery', {
      callback_query_id: cq.id,
      text: 'Эту заявку уже приняли.',
    });
    return;
  }

  if (cq.data === 'accept') {
    const u = cq.from || {};
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'без имени';
    let who = u.username ? `${name} (@${u.username})` : name;
    if (who.length > 48) who = who.slice(0, 47) + '…'; // не раздуваем кнопку

    const msg = cq.message || {};

    // Меняем только кнопку → «Принято — кто». Текст заявки не трогаем.
    await api('editMessageReplyMarkup', {
      chat_id: msg.chat && msg.chat.id,
      message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [[{ text: `✅ Принято — ${who}`, callback_data: 'taken' }]]
      }
    });

    // Всплывающее подтверждение тому, кто нажал.
    await api('answerCallbackQuery', {
      callback_query_id: cq.id,
      text: 'Вы приняли заявку ✅',
    });
    return;
  }

  // Неизвестная кнопка — просто подтверждаем нажатие.
  await api('answerCallbackQuery', { callback_query_id: cq.id });
}
