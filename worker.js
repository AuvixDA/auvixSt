// ============================================================
// AUVIX STUDIO — Cloudflare Worker для приёма заявок
// ============================================================
// Это БЭКЕНД, который принимает заявку с сайта и отправляет её в Telegram.
// Деплоится отдельно в Cloudflare Workers (адрес в app.js -> WORKER_URL,
// сейчас: https://auvix.ivankatsan24954.workers.dev/).
//
// Файлы сайта (index.html, app.js и т.д.) сами в Telegram НЕ пишут —
// они только шлют сюда POST { text }, а токен бота живёт здесь, на сервере,
// в переменной окружения env.BOT_TOKEN и наружу не попадает.
//
// Что делает воркер: получив заявку, отправляет её сообщение
//   1) вам в личку с ботом      — env.CHAT_ID (как было раньше);
//   2) в Telegram-канал         — CHANNEL_ID (там бот должен быть админом).
//
// ── Переменные окружения (Settings → Variables and Secrets) ─────────────
//   BOT_TOKEN — токен бота от @BotFather (Secret).
//   CHAT_ID   — ваш личный chat_id, куда заявки шли раньше.
//
// ВАЖНО: чтобы бот мог писать в канал, он должен быть В ЭТОМ КАНАЛЕ
// администратором с правом «Публикация сообщений» (Post messages),
// иначе Telegram вернёт ошибку и в канал ничего не придёт.
// ============================================================

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { text } = body;

      if (!text) {
        return new Response('No text', { status: 400 });
      }

      // Telegram-канал, куда дублируем заявки (бот должен быть его админом).
      const CHANNEL_ID = -1004459488439;

      // Отправка одного сообщения в Telegram.
      const send = (chat_id) => fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id,
            text,
            parse_mode: 'Markdown'
          })
        }
      );

      // Шлём заявку сразу в оба места: вам в личку и в канал.
      // Обе отправки стартуют параллельно. Ответ сайту формируем по личке —
      // как было раньше, чтобы поведение формы не изменилось.
      const adminPromise = send(env.CHAT_ID);
      const channelPromise = send(CHANNEL_ID).catch(() => null); // best-effort

      const res = await adminPromise;
      const data = await res.json();
      await channelPromise;

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });

    } catch (e) {
      return new Response('Error: ' + e.message, { status: 500 });
    }
  }
};
