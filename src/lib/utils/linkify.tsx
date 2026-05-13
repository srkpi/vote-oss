import type { ReactNode } from 'react';

const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»]+$/;

function splitUrlAndTrailing(match: string): { url: string; trailing: string } {
  let url = match;
  let trailing = '';
  const punctMatch = url.match(TRAILING_PUNCTUATION);
  if (punctMatch) {
    trailing = punctMatch[0];
    url = url.slice(0, -trailing.length);
  }
  const opens = (url.match(/\(/g) ?? []).length;
  const closes = (url.match(/\)/g) ?? []).length;
  while (closes > opens && url.endsWith(')')) {
    trailing = `)${trailing}`;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

export function linkifyText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    const { url, trailing } = splitUrlAndTrailing(match[0]);
    const href = url.startsWith('www.') ? `https://${url}` : url;
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-kpi-navy underline hover:no-underline"
      >
        {url}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
