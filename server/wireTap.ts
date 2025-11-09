// server/wireTap.ts - JSONL wire tap for analytics
import { appendFile } from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export function appendJsonl(filename: string, obj: any) {
  const filepath = path.join(DATA_DIR, filename);
  const line = JSON.stringify(obj) + '\n';
  appendFile(filepath, line, (err) => {
    if (err) console.error('[WIRE TAP] Failed to write:', err.message);
  });
}

export function tapWireMessage(wire: any) {
  // Log all unknown cmds for discovery
  if (typeof wire.cmd === 'number' && wire.cmd !== 338) {
    appendJsonl('wire_unknown.jsonl', {
      ts: Date.now(),
      cmd: wire.cmd,
      data: wire.data,
      rc: wire.rc,
      msg: wire.msg
    });
  }
}

export function tapGift(giftData: any) {
  appendJsonl('gifts.jsonl', {
    ts: Date.now(),
    ...giftData
  });
}

export function tapChat(chatData: any) {
  appendJsonl('chat.jsonl', {
    ts: Date.now(),
    ...chatData
  });
}

export function tapPK(pkData: any) {
  appendJsonl('pk.jsonl', {
    ts: Date.now(),
    ...pkData
  });
}
