import { ROOM_CSS } from '../styles';
import type { Room, RoomConfig } from './room';
import './room';

let sheet: CSSStyleSheet | undefined;

export function mountRoom(host: HTMLElement, config: RoomConfig, origin?: { x: number; y: number }) {
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
