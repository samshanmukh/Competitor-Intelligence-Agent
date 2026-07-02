// Tavily search — an independent citation-search API used to fact-check the
// market model's claims against fresh sources (a different retrieval pipeline
// than You.com, which builds the model). Set TAVILY_API_KEY to enable.
const TAVILY_URL = 'https://api.tavily.com/search';

export function tavilyConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function tavilySearch(query, { maxResults = 8, timeoutMs = 30000 } = {}) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query) return null;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
        include_answer: true,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Tavily failed (${res.status})`);
    const data = await res.json();
    return {
      answer: data.answer || '',
      results: (data.results || []).map((r) => ({ title: r.title, url: r.url, content: r.content })),
    };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Tavily timed out');
    throw err;
  } finally {
    clearTimeout(to);
  }
}
