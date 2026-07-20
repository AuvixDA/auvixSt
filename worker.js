// ============================================================
// AUVIX STUDIO — Cloudflare Worker для приёма заявок
// ============================================================
// Это БЭКЕНД, который принимает заявку с сайта и отправляет её в Telegram.
// Деплоится отдельно в Cloudflare Workers (адрес в app.js -> WORKER_URL,
// сейчас: https://auvix.ivankatsan24954.workers.dev/).
//
// Файлы сайта (index.html, app.js и т.д.) сами в Telegram НЕ пишут —
// они только шлют сюда POST { text }, а токен бота живёт здесь, на сервере,
// и наружу не попадает.
//
// Что делает этот воркер: получив заявку, отправляет её сообщение
//   1) вам в личку с ботом (ADMIN_CHAT_ID);
//   2) в Telegram-канал CHANNEL_CHAT_ID (там, где этот бот — администратор).
//
// ── НАСТРОЙКА (переменные окружения / Secrets воркера) ──────────────────
//   BOT_TOKEN       — токен бота от @BotFather (обязательно, как Secret).
//   ADMIN_CHAT_ID   — ваш личный chat_id, куда заявки шли раньше.
// Канал зашит константой ниже (id каналов не секретны), при желании его
// тоже можно вынести в переменную CHANNEL_CHAT_ID.
//
// ВАЖНО: чтобы бот мог писать в канал, он должен быть В ЭТОМ КАНАЛЕ
// администратором с правом «Публикация сообщений» (Post messages).
// Иначе Telegram вернёт 403 и в канал ничего не придёт.
// ============================================================

// Канал, куда дублируются заявки (id вида -100...).
const CHANNEL_CHAT_ID = -1004459488439;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',            // при желании сузьте до своего домена
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Префлайт CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, description: 'Method not allowed' }, 405);
    }

    const token = env.BOT_TOKEN;
    if (!token) {
      return json({ ok: false, description: 'BOT_TOKEN is not configured' }, 500);
    }

    let text = '';
    try {
      const body = await request.json();
      text = (body && body.text) ? String(body.text) : '';
    } catch (_) {
      return json({ ok: false, description: 'Bad JSON' }, 400);
    }
    if (!text.trim()) {
      return json({ ok: false, description: 'Empty text' }, 400);
    }

    // Список получателей: ваша личка + канал. Пустые/невалидные id отсеиваем.
    const recipients = [env.ADMIN_CHAT_ID, CHANNEL_CHAT_ID].filter(
      (id) => id !== undefined && id !== null && id !== ''
    );

    // Шлём во всех получателей параллельно, каждый — best-effort.
    const results = await Promise.all(
      recipients.map((chatId) => sendMessage(token, chatId, text))
    );

    // Заявка считается принятой, если доставлена хотя бы в одно место
    // (чтобы сбой отправки в канал не рушил успех для клиента).
    const ok = results.some((r) => r.ok);
    const firstError = results.find((r) => !r.ok);

    return json({
      ok,
      description: ok ? undefined : (firstError ? firstError.description : 'Send failed'),
      results,
    }, ok ? 200 : 502);
  },
};

// Отправка одного сообщения в Telegram. parse_mode: 'Markdown' — как в тексте
// заявки используется *жирный* и разделители, поэтому формат сохраняем.
async function sendMessage(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return {
      chat_id: chatId,
      ok: !!data.ok,
      description: data.ok ? undefined : (data.description || `HTTP ${res.status}`),
    };
  } catch (e) {
    return { chat_id: chatId, ok: false, description: String(e) };
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
