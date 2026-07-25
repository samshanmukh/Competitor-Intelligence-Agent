/** Tiny SSR markdown subset: ## / ### headings, **bold**, lists, paragraphs, links. */
export default function SimpleMarkdown({ source }) {
  const blocks = String(source || '')
    .trim()
    .split(/\n{2,}/);

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-slate-300">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="!mt-8 text-xl font-semibold text-white">
              {inline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={i} className="!mt-6 text-lg font-semibold text-white">
              {inline(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.split('\n').every((l) => l.trim().startsWith('- ') || l.trim().startsWith('**'))) {
          const lines = trimmed.split('\n').filter((l) => l.trim().startsWith('- '));
          if (lines.length) {
            return (
              <ul key={i} className="list-disc space-y-2 pl-5">
                {lines.map((l, j) => (
                  <li key={j}>{inline(l.replace(/^\s*-\s*/, ''))}</li>
                ))}
              </ul>
            );
          }
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function inline(text) {
  // Split bold + bare URLs
  const parts = [];
  const re = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${m.index}-b`} className="text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <a
          key={`${m.index}-a`}
          href={token}
          className="text-indigo-300 underline-offset-2 hover:underline"
        >
          {token}
        </a>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
