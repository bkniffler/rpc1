import { defaultInterval, maxRetries } from './timeout';

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
  while (!(result = cb()) && tries <= maxRetries) {
    tries += 1;
    await new Promise(yay =>
      setTimeout(
        yay,
        typeof interval === 'function' ? interval(tries) : interval
      )
    );
  }
  return Promise.resolve(result);
}
