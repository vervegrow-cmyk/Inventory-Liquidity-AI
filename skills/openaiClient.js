const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Single raw call to the OpenAI API with auto-retry on 5xx.
 * Accepts the same shape as kimiChat for easy drop-in use.
 * model defaults to gpt-4o-mini; pass 'gpt-4o' for vision or heavier tasks.
 */
export async function openaiChat({ model = 'gpt-4o-mini', messages, retries = 2 }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    try {
      const res = await fetch(OPENAI_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model, messages }),
      });

      if (!res.ok) {
        const err = await res.text();
        lastErr = new Error(`OpenAI API error (${res.status}): ${err.slice(0, 200)}`);
        if (res.status >= 500 && attempt < retries) continue;
        throw lastErr;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      lastErr = err;
      if (attempt < retries) continue;
    }
  }
  throw lastErr;
}
