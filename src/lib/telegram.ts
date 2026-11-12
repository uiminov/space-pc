import "server-only";
import { getSettings } from "./settings";

export async function notifyTelegram(text: string) {
  const s = getSettings();
  const token = process.env.TG_BOT_TOKEN || s.tg_bot_token;
  const chat = process.env.TG_CHAT_ID || s.tg_chat_id;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("Telegram notify failed", e);
  }
}

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
