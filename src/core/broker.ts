import {
  errors,
  channels,
  waitFor,
  requestReply,
  createLog,
  EventEmitter
} from './common';
import {
  createDefaultServiceStorage,
  createDefaultIDStorage,
  IIdStorage,
  IServiceStorage
} from './storage';
import { IInitializer, createService } from './service';
import { getServiceProxy } from './proxy';
const log = createLog('broker');

export type IPluginCallback = () => void;
export type IPlugin = (broker: IBroker) => () => void;
export interface IBroker {
  connect: (name: string, emitter: EventEmitter) => () => void;
  local: (name: string, initializer: IInitializer) => () => void;
  client: (initializer: IInitializer) => () => void;
  plugin: (plugin: IPlugin) => void;
  use: <T>(name: string, target?: string) => T;
}
export interface IBrokerOptions {
  plugins?: IPlugin[];
}
export function createBroker(
  initializer: (broker: IBroker) => void,
  options: IBrokerOptions = {}
) {
  log.info('Creating a new broker');
  const brokerEmitter = new EventEmitter();
  // const useBase = getServiceProxy(brokerEmitter, () => true);
  const useBase = getServiceProxy(brokerEmitter);
  const localServices: (() => void)[] = [];
  const plugins: (() => void)[] = [];
  const idStorage = createDefaultIDStorage();
  const serviceStorage = createDefaultServiceStorage();
  const broker: IBroker = {
    use<T>(name: string, target?: string): T {
      return useBase(name, target) as T;
    },
    connect(name, emitter) {
      log.info(`Connecting service ${name}`);
      const handlers = createBrokerHandlers(emitter, idStorage, serviceStorage);
      emitter.on(channels.METHOD, handlers.method);
      emitter.on(channels.SUBSCRIPTION, handlers.subscription);
      const id = serviceStorage.add(name, emitter);
      log.info(`Service ${name} connection successful, id ${id}`);
      return function disconnect() {
        log.info(`Service ${name} disconnected, id ${id}`);
        if (id) {
          serviceStorage.remove(name, id);
        }
      };
    },
    local(name, initializer) {
      log.info(`Adding local service ${name}`);
      const emitter = new EventEmitter();
      broker.connect(name, emitter);
      const close = createService(name, emitter, initializer);
      const closeFN = () => {
        if (close && close['then']) {
          return (close as any).then((close: any) => close());
        } else if (close) {
          return (close as any)();
        }
      };
      localServices.push(closeFN);
      emitter.emit('connect');
      return closeFN;
    },
    client(initializer) {
      return broker.local('client', initializer);
    },
    plugin(createPlugin) {
      plugins.push(createPlugin(broker));
    }
  };
  const handlers = createBrokerHandlers(
    brokerEmitter,
    idStorage,
    serviceStorage
  );
  brokerEmitter.on(channels.METHOD, handlers.method);
  brokerEmitter.on(channels.SUBSCRIPTION, handlers.subscription);
  if (options.plugins) options.plugins.forEach(plugin => broker.plugin(plugin));
  initializer(broker);
  return async function destroy() {
    log.info('Destroying broker');
    localServices.forEach(x => x());
    // await waitFor(() => broker.serviceStorage.count() === 0);
    await Promise.all(plugins.map(cb => cb()));
    log.info('Finished destroying broker');
  };
}

export function createBrokerHandlers(
  proxy: EventEmitter,
  idStorage: IIdStorage,
  services: IServiceStorage
) {
  async function innerHandler(
    isSubscription = false,
    serviceName: string,
    target: string | undefined,
    method: string,
    id: string,
    ...args: any[]
  ) {
    if (idStorage.has(id)) {
      log.info(`Conflicting id ${id}`);
      proxy.emit(id, errors.ID_CONFLICT);
      return;
    }
    const service = await waitFor<EventEmitter>(() =>
      services.get(serviceName, target)
    );
    if (!service) {
      log.info(`No ${serviceName} service for request ${id}`);
      proxy.emit(id, errors.TIMEOUT);
      return;
    }
    idStorage.add(id);
    if (isSubscription) {
      const handler = (err: any, ...args: any[]) => {
        log.info(`Subscription ${id} fired`);
        return proxy.emit(id, err, ...args);
      };
      service.on(id, handler);
      service.emit(method, id, ...args);
      // Cleanup
      const cleanup = () => {
        log.info(`Subscription ${id} cleanup`);
        idStorage.remove(id);
        service.removeListener(id, handler);
        proxy.removeListener(channels.KICK, cleanup);
        service.removeListener(channels.KICK, cleanup);
        service.emit(`${id}${channels.UNLISTEN}`);
      };
      proxy.once(`${id}${channels.UNLISTEN}`, cleanup);
      proxy.once(channels.KICK, cleanup);
      service.once(channels.KICK, cleanup);
      log.info(`Subscription ${id} started`);
    } else {
      log.info(`Promise ${id} started`);
      try {
        const [err, ...rest] = await requestReply(
          service,
          [method, id],
          id,
          ...args
        );
        log.info(`Promise ${id} resolved, error ${!!err}`);
        proxy.emit(id, err, ...rest);
      } catch (err) {
        log.info(`Promise ${id} timeout`);
        proxy.emit(id, errors.TIMEOUT);
      }
      idStorage.remove(id);
    }
  }

  return {
    method: (
      serviceName: string,
      target: string | undefined,
      method: string,
      invocationId: string,
      ...args: any[]
    ) =>
      innerHandler(false, serviceName, target, method, invocationId, ...args),
    subscription: (
      serviceName: string,
      target: string | undefined,
      method: string,
      invocationId: string,
      ...args: any[]
    ) => innerHandler(true, serviceName, target, method, invocationId, ...args)
  };
}
