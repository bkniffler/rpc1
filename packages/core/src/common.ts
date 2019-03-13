import * as shortid from 'shortid';
import { EventEmitter } from 'events';
export { EventEmitter } from 'events';

// Do function arguments contain a cb function?
export function isArgsWithCallback(args: any[]) {
  return typeof args[args.length - 1] === 'function';
}

// Return last arg and rest args
export function extractLastArg(args: any[]) {
  return [args[args.length - 1], args.splice(0, args.length - 1)];
}

// Filter object keys
export function filterObjKeys(methodName: string) {
  if (
    methodName === 'inspect' ||
    methodName === 'constructor' ||
    typeof methodName === 'symbol'
  ) {
    return true;
  }

  return false;
}

export async function waitFor<T>(
  cb: () => any,
  {
    interval = defaultInterval
  }: {
    interval?: ((tries: number) => number) | number;
    fail?: boolean;
  } = {}
): Promise<T> {
  let tries = 0;
  let result: T;
  let strt = new Date().getTime();
  while (!(result = cb()) && tries <= maxRetries) {
    tries += 1;
    await new Promise(yay =>
      setTimeout(
        yay,
        typeof interval === 'function' ? interval(tries) : interval
      )
    );
  }
  if (result) {
    lg.info(`Success after ${tries}`, new Date().getTime() - strt);
  } else {
    lg.info(`Fail after ${tries}`, new Date().getTime() - strt);
  }
  return Promise.resolve(result);
}

export function requestReply<T = any[]>(
  emitter: EventEmitter,
  channel: string | [string, string],
  ...args: any[]
): Promise<T> {
  if (typeof channel === 'string') {
    channel = [channel, channel];
  }
  return new Promise((yay, nay) => {
    emitter.once(channel[1], after);
    emitter.emit(channel[0], ...args);
    function after(...result: any) {
      clearTimeout(timeout);
      yay(result);
    }
    const timeout = setTimeout(() => {
      emitter.removeListener(channel[1], after);
      nay();
    }, maxTimeout);
  });
}

export let _generate = shortid.generate;
export function setIdGenerator(generator: () => string) {
  _generate = generator;
}
export function generate() {
  return _generate();
}

export const channels = {
  KICK: '$kick',
  UNLISTEN: '$unlisten',
  SUBSCRIPTION: '$subscription',
  INIT: '$init',
  METHOD: '$method',
  IDENTIFY: '$identify'
};

export const errors = {
  ID_CONFLICT: 'idconflict',
  IDENTITY: 'identity',
  TIMEOUT: 'timeout'
};

export const maxRetries = 5;
export const maxTimeout = 2500;
export const defaultInterval = (tries: number) => {
  switch (tries) {
    case 0:
      return 100;
    case 1:
      return 200;
    case 2:
      return 400;
    case 3:
      return 800;
    case 4:
      return 1600;
    default:
      return 3200;
  }
};

let logging = false;
interface ILog {
  info: (...args: any[]) => void;
  warning: (...args: any[]) => void;
  error: (...args: any[]) => void;
}
export const log = {
  disable(enable: boolean = false) {
    logging = enable;
  },
  enable(enable: boolean = true) {
    logging = enable;
  },
  info(...args: any[]) {
    if (!logging) return;
    console.log(...args);
  },
  error(...args: any[]) {
    if (!logging) return;
    console.error(...args);
  },
  warning(...args: any[]) {
    if (!logging) return;
    console.warn(...args);
  }
};

let logs = [];
const colorsjs = require('colors/safe');
export function createLog(name: string): ILog {
  const colors = [
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'gray'
  ];

  let options = {
    color: '',
    tabs: ''
  };
  return Object.keys(log).reduce(
    (state: any, key: string) => ({
      ...state,
      [key]: (...args: any[]) => {
        if (!options.color) {
          options.color = colors[logs.length % colors.length];
          options.tabs = Array(logs.length)
            .fill(0)
            .reduce(str => `${str}  `, '');
          logs.push(null);
        }
        return log[key](options.tabs + colorsjs[options.color](name), ...args);
      }
    }),
    {}
  );
}

const lg = createLog('utils');
