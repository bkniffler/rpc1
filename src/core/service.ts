import { channels, errors } from './constants';
import {
  generate,
  isArgsWithCallback,
  createLog,
  extractLastArg,
  waitFor,
  requestReply,
  IEmitter
} from './utils';
import { Adapter } from './adapter';
const log = createLog('service');

type IHandler = (...args: any[]) => void;
export class Service {
  emitter?: IEmitter;
  name: string;
  adapter: Adapter;

  constructor(adapter: Adapter);
  constructor(name: string, adapter: Adapter);
  constructor(nameOrAdapter: string | Adapter, adapterOrUndefined?: Adapter) {
    this.name = (adapterOrUndefined === undefined
      ? 'local'
      : nameOrAdapter) as string;
    this.adapter = (adapterOrUndefined === undefined
      ? nameOrAdapter
      : adapterOrUndefined) as Adapter;
    this.adapter.connectToService(this);
  }
  methods = {};
  subscriptions = {};
  onConnectState?: (state: boolean) => void = undefined;
  connectToEmitter(emitter: IEmitter) {
    this.emitter = emitter;
    bindMethods(emitter, this.methods);
    bindSubscriptions(emitter, this.subscriptions);
    if (this.onConnectState) {
      this.onConnectState(true);
    }
  }
  brokerTimeout() {
    if (this.adapter) {
      this.adapter.disconnect();
    }
    this.disconnectFromEmitter();
  }
  disconnectFromEmitter() {
    this.emitter = undefined;
    if (this.onConnectState) {
      this.onConnectState(false);
    }
  }
  close() {
    if (this.adapter) {
      this.adapter.close();
    }
    this.disconnectFromEmitter();
  }
  addSubscription<T = any>(
    name: string,
    handler: (emit: IHandler, arg0?: T, ...args: any[]) => IHandler
  ) {
    this.subscriptions[name] = handler;
  }
  addMethod<T = any>(
    name: string,
    handler: (...args: any[]) => Promise<T> | T | void
  ) {
    this.methods[name] = handler;
  }
  use<T>(name: string, target?: string): T {
    return new Proxy<any>(
      {},
      {
        get: (t: string, methodName: string) => {
          if (filterObjKeys(methodName)) {
            return;
          }
          return (...args: [any]) => {
            const id = generate();
            const isCallback = isArgsWithCallback(args);
            log.info('Calling proxy', methodName, id, name);
            if (isCallback) {
              return callSubscription(this, id, name, methodName, args);
            } else {
              return callMethod(this, id, name, methodName, args);
            }
          };
        }
      }
    );
  }
}

// Filter object keys
export function filterObjKeys(methodName: string) {
  if (
    methodName === 'then' ||
    methodName === 'inspect' ||
    methodName === 'constructor' ||
    typeof methodName === 'symbol'
  ) {
    return true;
  }

  return false;
}

function callSubscription(
  service: Service,
  id: string,
  serviceName: string,
  method: string,
  args: any[]
) {
  log.info(`Subscription ${serviceName}.${method}.${id}`);
  const [handler, newArgs] = extractLastArg(args);
  let stopped = false;
  waitFor<IEmitter>(() => service.emitter).then(emitter => {
    if (stopped) {
      return;
    }
    if (!emitter) {
      log.info(`Could not connect to broker`);
      service.brokerTimeout();
      const [handler] = extractLastArg(args);
      return handler(errors.TIMEOUT);
    }
    // emitter.once('disconnect', unsubscribe);
    emitter.on(id, handler);
    emitter.emit(
      channels.SUBSCRIPTION,
      serviceName,
      null,
      method,
      id,
      ...newArgs
    );
  });
  const unsubscribe = () => {
    stopped = true;
    log.info(`Cancel subscription ${id}`);
    if (service.emitter) {
      service.emitter.emit(`${id}${channels.UNLISTEN}`);
      service.emitter.removeListener(id, handler);
    }
  };
  return unsubscribe;
}
async function callMethod(
  service: Service,
  id: string,
  serviceName: string,
  method: string,
  args: any[]
) {
  log.info(`Promise ${serviceName}.${method}.${id}`);
  const emitter = await waitFor<IEmitter>(() => service.emitter);
  log.info(`Is connected`, !!emitter);
  if (!emitter) {
    log.info(`Could not connect to broker`);
    service.brokerTimeout();
    return Promise.reject(errors.TIMEOUT);
  }
  try {
    const [err, arg0] = await requestReply<[any?, any?]>(
      emitter,
      [channels.METHOD, id],
      serviceName,
      '',
      method,
      id,
      ...args
    );
    if (err === errors.ID_CONFLICT) {
      log.info(`Cancel id ${id} due to id conflict`);
      return Promise.reject(errors.ID_CONFLICT);
    } else if (err) {
      log.info(`Error ${err}`);
      return Promise.reject(err);
    } else {
      log.info(`Resolved ${id}`, arg0);
      return arg0;
    }
  } catch (err) {
    log.error(err);
    return Promise.reject(err);
  }
}

function bindMethods(emitter: IEmitter, methods: any) {
  log.info('Binding methods to emitter');
  const listener = (name: string, id: string, ...args: any[]) => {
    const handler = methods[name];
    if (!handler) {
      emitter.emit(id, errors.NOT_EXIST);
      return;
    }
    log.info(`Called method ${name} ${id}`);
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
  };
  emitter.on(channels.METHOD, listener);
}

function bindSubscriptions(emitter: IEmitter, subscriptions: any) {
  const listener = (name: string, id: string, ...args: any[]) => {
    const handler = subscriptions[name];
    if (!handler) {
      emitter.emit(id, errors.NOT_EXIST);
      return;
    }
    log.info(`Called subscription ${name} ${id}`);
    let unlisten: (() => void) | null = null;
    try {
      const unlistener = () => (unlisten ? unlisten() : undefined);
      emitter.once(`${id}${channels.UNLISTEN}`, unlistener);
      // emitter.once('disconnect', unlistener);
      unlisten = handler((err: any, ...args: any[]) => {
        return emitter.emit(id, err, ...args);
      }, ...args);
    } catch (err) {
      emitter.emit(id, err);
      if (unlisten) {
        unlisten();
      }
    }
  };
  emitter.on(channels.SUBSCRIPTION, listener);
}
