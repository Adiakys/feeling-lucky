import { svg } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { IconNode } from 'lucide';

const escape = (value: unknown) => String(value).replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

// A Lucide icon, inline, sized and coloured by the text around it.
export function icon(node: IconNode, className = '') {
  const children = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([name, value]) => `${name}="${escape(value)}"`).join(' ')}/>`).join('');
  return svg`<svg class="fl-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${unsafeSVG(children)}</svg>`;
}
