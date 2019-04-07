import { maxTimeout } from './timeout';
import { errors } from '../constants';
import { IEmitter } from '.';

export function requestReply<T = any[]>(
  emitter: IEmitter,
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
      nay(errors.TIMEOUT);
    }, maxTimeout);
  });
}
