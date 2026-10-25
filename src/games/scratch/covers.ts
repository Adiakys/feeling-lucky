// The printed covers of the numbers tickets, drawn on the foil canvases: each is an SVG decoded once.
export type Cover = 'coin' | 'bundle' | 'boat' | 'flipflop' | 'beach';

const svg = (width: number, height: number, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`)}`;

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

const flipFlop = (x: number, angle: number, sole: string, edge: string, strap: string) => `
  <g transform="rotate(${angle} ${x} 23)">
    <path d="M${x} 4c7 0 9 7 8 15c-1 9-2 16-8 23c-6-7-8-14-8-23c-1-8 1-15 8-15z" fill="${sole}" stroke="${edge}" stroke-width="1.2"/>
    <path d="M${x - 7} 20L${x} 10L${x + 7} 20" fill="none" stroke="${strap}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x}" cy="10" r="1.8" fill="${strap}"/>
  </g>`;

export function coverArt(prizeLabel: string): Record<Cover, string> {
  return {
    coin: svg(60, 60, `
      <defs><radialGradient id="g" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff7cc"/><stop offset=".45" stop-color="#f4c542"/><stop offset="1" stop-color="#a86e0e"/></radialGradient></defs>
      <circle cx="30" cy="30" r="28.5" fill="url(#g)" stroke="#7a4f08" stroke-width="2"/>
      <circle cx="30" cy="30" r="22" fill="none" stroke="#b07a14" stroke-width="1.4" stroke-dasharray="2.2 2.4"/>
      <text x="30" y="41" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="#9a6410" stroke="#fff2b8" stroke-width=".7">₤</text>`),
    bundle: svg(84, 72, `
      <rect width="84" height="72" rx="9" fill="#a7e0f6"/>
      <g stroke="#1d5e2b" stroke-width="1">
        <rect x="15" y="7" width="54" height="31" rx="3" fill="#2f8a43" transform="rotate(-9 42 24)"/>
        <rect x="15" y="8" width="54" height="31" rx="3" fill="#3fa356" transform="rotate(6 42 24)"/>
        <rect x="15" y="9" width="54" height="31" rx="3" fill="#5cbd6f"/>
      </g>
      <rect x="19" y="13" width="46" height="23" rx="2" fill="none" stroke="#d3f3d3" stroke-width=".8"/>
      <ellipse cx="29" cy="24.5" rx="6" ry="7" fill="#a5e0ad" stroke="#2f7f3b" stroke-width=".8"/>
      <rect x="44" y="8" width="9" height="33" fill="#f6e8c3" stroke="#b08a3a" stroke-width=".6"/>
      <path d="M6 46h72l-5 9 5 9H6l5-9z" fill="#d7262b" stroke="#8e1414" stroke-width="1"/>
      <text x="42" y="59" text-anchor="middle" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="10.5" letter-spacing=".5" fill="#fff">${escape(prizeLabel)}</text>`),
    boat: svg(60, 56, `
      <rect width="60" height="56" rx="10" fill="#c4ecfc"/>
      <path d="M0 42q7.5-4 15 0t15 0t15 0t15 0v14H0z" fill="#2aa3d6"/>
      <path d="M31 6v32" stroke="#5b4a3a" stroke-width="1.6"/>
      <path d="M30 8v28H12z" fill="#fff" stroke="#9fb7c8" stroke-width=".8"/>
      <path d="M32.5 12v24h13z" fill="#ef4b3c"/>
      <path d="M9 38.5h42l-6 7H15z" fill="#c8321f"/>
      <path d="M2 49q7.5-3 15 0t15 0t15 0t13 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>`),
    flipflop: svg(64, 46, `
      <rect width="64" height="46" rx="8" fill="#f3dcab"/>
      ${flipFlop(21, -12, '#ff7a59', '#c4502f', '#2b8fd6')}
      ${flipFlop(43, 10, '#3cbcae', '#22857b', '#ffd23f')}`),
    beach: svg(370, 168, `
      <defs>
        <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e3b4"/><stop offset="1" stop-color="#e6c180"/></linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c8fc4"/><stop offset="1" stop-color="#53c6ea"/></linearGradient>
      </defs>
      <rect width="370" height="168" fill="url(#sand)"/>
      <path d="M0 0h370v38q-23 8-46 0t-46 0t-46 0t-46 0t-46 0t-46 0t-46 0t-48 0z" fill="url(#sea)"/>
      <path d="M0 40q23 8 46 0t46 0t46 0t46 0t46 0t46 0t46 0t48 0" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".85"/>
      <g opacity=".35" fill="#c99a52"><circle cx="120" cy="70" r="1.4"/><circle cx="175" cy="150" r="1.2"/><circle cx="250" cy="120" r="1.5"/><circle cx="20" cy="140" r="1.2"/><circle cx="340" cy="150" r="1.3"/></g>
      <path d="M298 34l-12 124" stroke="#7a5a3a" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M240 64q58-62 118 0z" fill="#e8322f"/>
      <path d="M262 64q12-36 37-33q-14 6-16 33zM319 64q-2-27-20-33q31-3 41 33z" fill="#fff"/>
      <path d="M240 64q58-62 118 0" fill="none" stroke="#a51e1c" stroke-width="1.5"/>
      <g transform="rotate(-8 175 120)">
        <rect x="128" y="96" width="96" height="46" rx="4" fill="#fff"/>
        <path d="M128 106h96M128 118h96M128 130h96" stroke="#2b8fd6" stroke-width="6"/>
      </g>
      <g>
        <rect x="46" y="44" width="10" height="22" rx="3" fill="none" stroke="#3a3a3a" stroke-width="3.5"/>
        <path d="M40 62h22" stroke="#3a3a3a" stroke-width="3"/>
        <rect x="22" y="62" width="58" height="84" rx="8" fill="#d8262f" stroke="#8e1414" stroke-width="2"/>
        <path d="M36 70v68M51 70v68M66 70v68" stroke="#a51c22" stroke-width="2.5"/>
        <circle cx="31" cy="150" r="5" fill="#2a2a2a"/><circle cx="71" cy="150" r="5" fill="#2a2a2a"/>
        <circle cx="62" cy="86" r="8" fill="#ffd23f" stroke="#c99a18"/><rect x="28" y="106" width="20" height="13" rx="2" fill="#2b8fd6" transform="rotate(-10 38 112)"/>
      </g>
      <path d="M268 112l5 12 13 1-10 8 4 13-12-7-11 7 4-13-10-8 13-1z" fill="#ff8a3d" stroke="#d1601c" stroke-width="1.2" stroke-linejoin="round"/>
      <g transform="translate(110 150) rotate(-15)"><path d="M0 0q8-14 16 0z" fill="#f6c6b4" stroke="#c98a76"/><path d="M8 0v-8M4 0l2-7M12 0l-2-7" stroke="#c98a76" stroke-width=".8"/></g>
      <g transform="translate(318 128)"><circle cx="0" cy="0" r="7" fill="#20303f" stroke="#111"/><circle cx="17" cy="0" r="7" fill="#20303f" stroke="#111"/><path d="M7 -1h3" stroke="#111" stroke-width="2"/></g>`),
  };
}

export async function loadCovers(art: Record<Cover, string>) {
  const images = Object.fromEntries(Object.entries(art).map(([cover, url]) => [cover, Object.assign(new Image(), { src: url })])) as Record<Cover, HTMLImageElement>;
  await Promise.all(Object.values(images).map((image) => image.decode()));
  return images;
}
