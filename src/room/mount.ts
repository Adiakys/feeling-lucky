import { ROOM_CSS } from '../styles';
import type { Room, RoomConfig } from './room';
import './room';

let sheet: CSSStyleSheet | undefined;

// Registered custom properties animate, but a shadow root ignores @property: they are declared on the document.
const PROPERTIES = `
@property --lk-notch-x { syntax: '<number>'; inherits: true; initial-value: 0; }
@property --lk-notch-y { syntax: '<number>'; inherits: true; initial-value: 0; }
`;

function registerProperties() {
  if (document.getElementById('feeling-lucky-properties')) return;
  document.head.append(Object.assign(document.createElement('style'), { id: 'feeling-lucky-properties', textContent: PROPERTIES }));
}

export function mountRoom(host: HTMLElement, config: RoomConfig, origin?: { x: number; y: number }) {
  registerProperties();
  const shadow = host.attachShadow({ mode: 'open' });
  sheet ??= new CSSStyleSheet();
  if (!sheet.cssRules.length) sheet.replaceSync(ROOM_CSS);
  shadow.adoptedStyleSheets = [sheet];
  const room = document.createElement('fl-room') as Room;
  room.config = config;
  if (origin) room.origin = origin;
  shadow.append(room);
  return room;
}
