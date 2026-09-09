function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .trim();
}

function attributes(tag) {
  const values = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    values[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  }
  return values;
}

function metaValues(html) {
  const values = {};
  for (const match of String(html || '').matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = String(attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !values[key]) values[key] = attrs.content;
  }
  return values;
}

function cleanName(value, hostname) {
  const raw = decodeEntities(value).replace(/\s+/g, ' ').trim();
  const first = raw.split(/\s+(?:[|·—–-])\s+/)[0]?.trim();
  if (first && first.length <= 80) return first;
  return hostname.replace(/^www\./i, '').split('.')[0]
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function extractProductMetadata(html, pageUrl) {
  const meta = metaValues(html);
  const title = decodeEntities(String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const url = new URL(pageUrl);
  const titleCandidate = meta['og:site_name'] || meta['og:title'] || meta['twitter:title'] || title;
  const description = (
    meta['og:description']
    || meta['twitter:description']
    || meta.description
    || ''
  ).replace(/\s+/g, ' ').trim().slice(0, 600);

  return {
    name: cleanName(titleCandidate, url.hostname),
    description,
    source: url.toString(),
  };
}
