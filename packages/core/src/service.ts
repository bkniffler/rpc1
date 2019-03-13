import { getServiceProxy, IServiceProxy } from './proxy';
import { channels, EventEmitter } from './common';

type IHandler = (...args: any[]) => void;

export interface IService {
  name: string;
  // connected: boolean;
  addSubscription: (
    name: string,
    handler: (emit: IHandler, ...args: any[]) => IHandler
  ) => void;
  addMethod: <T = any>(
    name: string,
    handler: (...args: any[]) => Promise<T> | T | void
  ) => void;
  use: <T = IServiceProxy>(name: string, target?: string) => T;
}
type IInitializerCallback = () => void;
export type IInitializer = (
  service: IService
) => IInitializerCallback | Promise<IInitializerCallback | void> | void;

export function createService(
  name: string,
  emitter: EventEmitter,
  initialize: IInitializer
) {
  const service: IService = {
    name,
    // connected: false,
    addSubscription(
      name: string,
      handler: (emit: IHandler, ...args: any[]) => IHandler
    ) {
      const listener = (id: string, ...args: any[]) => {
        emitter.once(`${id}${channels.UNLISTEN}`, function() {
          if (unlisten) {
            unlisten();
          }
        });
        const unlisten = handler((err: any, ...args: any[]) => {
          return emitter.emit(id, err, ...args);
        }, ...args);
      };
      emitter.on(name, listener);
    },
    addMethod<T = any>(
      name: string,
      handler: (...args: any[]) => Promise<T> | T | void
    ) {
      emitter.on(name, function(id: string, ...args: any[]) {
        try {
          const result = Promise.resolve<void | any>(handler(...args));
          result
            .then((data: any) => {
              emitter.emit(id, null, data);
            })
            .catch((err: any) => {
              emitter.emit(id, err);
            });
        } catch (err) {
          emitter.emit(id, err && err.toString() ? err.toString() : err);
        }
      });
    },
    use<T = IServiceProxy>(name: string, target?: string): T {
      return getServiceProxy(emitter /*, () => service.connected*/)(
        name,
        target
      ) as T;
    }
  };
  // service.connected = true;
  return initialize(service) || (() => {});
}
