const MODEL = "gemini-2.5-flash";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Не задан GEMINI_API_KEY в переменных окружения Netlify." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  try {
    const body = await request.json();
    if (!Array.isArray(body.contents) || body.contents.length === 0) {
      return new Response(JSON.stringify({ error: "Пустое сообщение." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const contents = body.contents.slice(-20).map(item => ({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: String(item.parts?.[0]?.text || "").slice(0, 12000) }]
    }));
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Ты ALISH AI — дружелюбный, полезный AI-помощник. Отвечай на языке пользователя, обычно по-русски. Пиши понятно, естественно и честно. Если не знаешь ответа, скажи об этом." }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      const message = result?.error?.message || `Ошибка Gemini API (${upstream.status})`;
      return new Response(JSON.stringify({ error: message }), { status: upstream.status, headers: { "Content-Type": "application/json" } });
    }
    const text = result?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!text) return new Response(JSON.stringify({ error: "Gemini не вернул текст. Возможно, запрос был заблокирован фильтром безопасности." }), { status: 502, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ text }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Не удалось обработать запрос: " + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
