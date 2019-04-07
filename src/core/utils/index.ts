export * from './log';
export * from './wait-for';
export * from './reqreply';
export * from './timeout';
export * from './id';

// Do function arguments contain a cb function?
export function isArgsWithCallback(args: any[]) {
  return typeof args[args.length - 1] === 'function';
}

// Return last arg and rest args
export function extractLastArg(args: any[]) {
  return [args[args.length - 1], args.splice(0, args.length - 1)];
}

export interface IEmitter {
  removeListener(channel: string, cb: Function): void;
  on(channel: string, cb: Function): void;
  once(channel: string, cb: Function): void;
  emit(channel: string, ...args: any[]): void;
}
