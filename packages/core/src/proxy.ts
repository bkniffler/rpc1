import {
  channels,
  errors,
  maxRetries,
  generate,
  //  waitFor,
  isArgsWithCallback,
  extractLastArg,
  filterObjKeys,
  createLog,
  EventEmitter
} from './common';
const log = createLog('proxy');

export interface IServiceProxy {
  subscription: (methodName: string, ...args: any[]) => void;
  method: <T = any>(methodName: string, ...args: any[]) => Promise<T>;
}

export function getServiceProxy(
  emitter: EventEmitter /*, isConnected: Function*/
) {
  function callServiceMethod(
    retries = 0,
    service: string,
    target: string | undefined,
    method: string,
    ...args: any[]
  ) {
    const id = generate();
    const isCallback = isArgsWithCallback(args);
    if (isCallback) {
      log.info(`Subscription ${service}.${method}.${id}`);
      const [handler, newArgs] = extractLastArg(args);
      let stopped = false;
      // waitFor<EventEmitter>(() => isConnected()).then(connected => {
      if (stopped) {
        return;
      }
      /*if (!connected) {
          log.info(`Could not connect to broker`);
          const [handler] = extractLastArg(args);
          return handler(errors.TIMEOUT);
        }*/
      emitter.on(id, handler);
      emitter.emit(
        channels.SUBSCRIPTION,
        service,
        target,
        method,
        id,
        ...newArgs
      );
      // });
      return () => {
        stopped = true;
        log.info(`Cancel subscription ${id}`);
        if (emitter) {
          emitter.emit(`${id}${channels.UNLISTEN}`);
          emitter.removeListener(id, handler);
        }
      };
    } else {
      log.info(`Promise ${service}.${method}.${id}`);
      // return waitFor<EventEmitter>(() => isConnected()).then(connected => {
      /*if (!connected) {
          log.info(`Could not connect to broker`);
          return Promise.reject(errors.TIMEOUT);
        }*/
      return new Promise((yay, nay) => {
        const listener = (err: any, ...args: []) => {
          if (err === errors.ID_CONFLICT) {
            if (retries > maxRetries) {
              log.info(`Cancel id ${id} due to id conflict`);
              return nay(errors.ID_CONFLICT);
            }
            return callServiceMethod(
              retries + 1,
              service,
              target,
              method,
              ...args
            );
          }
          emitter.removeListener(id, listener);
          if (err) {
            log.info(`Error ${err}`);
            nay(err);
          } else {
            log.info(`Resolved ${id}`);
            yay(...args);
          }
        };
        emitter.on(id, listener);
        emitter.emit(channels.METHOD, service, target, method, id, ...args);
      });
      // });
    }
  }
  return function serviceCreator(serviceName: string, target?: string) {
    return new Proxy<any>(
      {},
      {
        get: function(t: string, methodName: string) {
          if (filterObjKeys(methodName)) {
            return;
          }
          if (methodName === 'subscription' || methodName === 'method') {
            methodName = '';
          }
          return (...args: [any]) => {
            if (!methodName) {
              return callServiceMethod(0, serviceName, target, ...args);
            }
            return callServiceMethod(
              0,
              serviceName,
              target,
              methodName,
              ...args
            );
          };
        }
      }
    );
  };
}
