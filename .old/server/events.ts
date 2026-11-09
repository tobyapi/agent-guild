import { EventEmitter } from 'node:events';
import type { ServerEvent } from '../shared/types.js';

const bus = new EventEmitter();
bus.setMaxListeners(100);

export const emit = (ev: ServerEvent) => bus.emit('event', ev);
export const subscribe = (fn: (ev: ServerEvent) => void) => {
  bus.on('event', fn);
  return () => bus.off('event', fn);
};
