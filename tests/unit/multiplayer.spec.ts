import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/config/resolve';
import { events, type TableView } from '../../src/multiplayer/client';

const streamOf = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
      controller.close();
    },
  });

describe('events', () => {
  it('reads the views of a stream split anywhere', async () => {
    const views: TableView[] = [];
    for await (const view of events(streamOf('data: {"round":1}\n', '\ndata: {"rou', 'nd":2}\r\n\r\n: comment\n\n'))) views.push(view);
    expect(views.map(({ round }) => round)).toEqual([1, 2]);
  });
});

describe('multiplayer config', () => {
  const prizes = [{ id: 'mug', name: 'Mug', icon: '' }];

  it('is off unless given', async () => {
    expect((await resolveConfig({ prizes })).multiplayer).toBeUndefined();
  });

  it('takes a path or a server with headers', async () => {
    expect((await resolveConfig({ prizes, multiplayer: '/feeling-lucky' })).multiplayer).toEqual({ url: '/feeling-lucky' });
    const headers = () => ({ Authorization: 'Bearer x' });
    expect((await resolveConfig({ prizes, multiplayer: async () => ({ url: 'https://tables.example.com/feeling-lucky', headers }) })).multiplayer).toEqual({
      url: 'https://tables.example.com/feeling-lucky',
      headers,
    });
  });
});
