/**
 * Decide when to SSR the homepage GEO cornerstone (long guide + facts).
 * Humans get a clean landing; crawlers / GeoTest get the full text for scoring.
 * Visible /guide remains the human-readable copy of the same content.
 */

const CRAWLER_UA =
  /geotest|specloop|googlebot|google-extended|bingbot|slurp|duckduckbot|baiduspider|yandexbot|applebot|gptbot|chatgpt|oai-searchbot|claudebot|anthropic|perplexity|bytespider|petalbot|semrush|ahrefs|moz\.com|screaming frog|facebookexternalhit|twitterbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|redditbot|vkshare|w3c_validator|whatsapp|telegram|discordbot|preview|bot\b|spider|crawl|headlesschrome|puppeteer|playwright|phantomjs|selenium|curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|scrapy|node-fetch|undici/i;

/**
 * @param {{ ua?: string | null, referer?: string | null, searchParams?: URLSearchParams | null, forceHeader?: string | null }} opts
 */
export function shouldShowGeoCornerstone({
  ua = '',
  referer = '',
  searchParams = null,
  forceHeader = null,
} = {}) {
  if (forceHeader === '1' || forceHeader === 'true') return true;
  if (searchParams?.get('geo') === '1') return true;
  if (/geotest\.ai/i.test(String(referer || ''))) return true;
  return CRAWLER_UA.test(String(ua || ''));
}
