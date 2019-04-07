import { waitFor, requestReply, createLog, IEmitter } from './utils';
import { errors, channels } from './constants';
import { createDefaultServiceStorage, createDefaultIDStorage } from './storage';
import { Service } from './service';

const log = createLog('broker');

export type IPluginCallback = () => void;
export type IPlugin = () => void;
export type IPluginCreator = (broker: Broker) => IPlugin;

export class Broker {
  isClosed = false;
  localServices: Service[] = [];
  plugins: IPlugin[] = [];
  idStorage = createDefaultIDStorage();
  serviceStorage = createDefaultServiceStorage();
  constructor(plugins: IPluginCreator[] = []) {
    if (plugins) plugins.forEach(plugin => this.plugin(plugin));
  }
  close() {
    log.info('Closing broker');
    this.localServices.forEach(x => x.close());
    // await waitFor(() => broker.serviceStorage.count() === 0);
    this.plugins.map(close => close());
    log.info('Finished destroying broker');
    this.isClosed = true;
  }
  connect(name: string, emitter: IEmitter) {
    log.info(`Connecting service ${name}`);
    const handlers = this.createHandlers(emitter);
    emitter.on(channels.METHOD, handlers.method);
    emitter.on(channels.SUBSCRIPTION, handlers.subscription);
    const id = this.serviceStorage.add(name, emitter);
    log.info(`Service ${name} connection successful, id ${id}`);
    return () => {
      emitter.removeListener(channels.METHOD, handlers.method);
      emitter.removeListener(channels.SUBSCRIPTION, handlers.subscription);
      log.info(`Service ${name} disconnected, id ${id}`);
      if (id) {
        this.serviceStorage.remove(name, id);
      }
    };
  }
  plugin(createPlugin: IPluginCreator) {
    this.plugins.push(createPlugin(this));
  }
  createHandlers(emitter: IEmitter) {
    const getService = async (
      id: string,
      serviceName: string,
      target?: string
    ): Promise<[IEmitter?, Function?]> => {
      if (this.idStorage.has(id)) {
        log.info(`Conflicting id ${id}`);
        emitter.emit(id, errors.ID_CONFLICT);
        return [undefined, undefined];
      }
      const service = await waitFor<IEmitter>(() =>
        this.serviceStorage.get(serviceName, target)
      );
      if (!service) {
        log.info(`No ${serviceName} service for request ${id}`);
        emitter.emit(id, errors.TIMEOUT);
        return [undefined, undefined];
      }
      log.info(`Found a service for ${serviceName} for request ${id}`);
      this.idStorage.add(id);
      return [
        service,
        () => {
          this.idStorage.remove(id);
        }
      ];
    };
    return {
      async method(
        serviceName: string,
        target: string | undefined,
        method: string,
        id: string,
        ...args: any[]
      ) {
        const [service, cleanup] = await getService(id, serviceName, target);
        if (!service || !cleanup) {
          return;
        }
        log.info(`Promise ${id} started`);
        try {
          log.info(1);
          const [err, ...rest] = await requestReply(
            service,
            [channels.METHOD, id],
            method,
            id,
            ...args
          );
          log.info(2);
          log.info(`Promise ${id} resolved, error ${!!err}`);
          emitter.emit(id, err, ...rest);
        } catch (err) {
          log.info(3);
          log.info(`Promise ${id} timeout`);
          emitter.emit(id, errors.TIMEOUT);
        }
        log.info(4);
        cleanup();
      },
      async subscription(
        serviceName: string,
        target: string | undefined,
        method: string,
        id: string,
        ...args: any[]
      ) {
        const [service, cleanup2] = await getService(id, serviceName, target);
        if (!service || !cleanup2) {
          return;
        }
        const handler = (err: any, ...args: any[]) => {
          log.info(`Subscription ${id} fired`);
          return emitter.emit(id, err, ...args);
        };
        service.on(id, handler);
        service.emit(channels.SUBSCRIPTION, method, id, ...args);
        // Cleanup
        const cleanup = () => {
          cleanup2();
          log.info(`Subscription ${id} cleanup`);
          service.removeListener(id, handler);
          emitter.removeListener(channels.KICK, cleanup);
          service.removeListener(channels.KICK, cleanup);
          service.emit(`${id}${channels.UNLISTEN}`);
        };
        emitter.once(`${id}${channels.UNLISTEN}`, cleanup);
        emitter.once(channels.KICK, cleanup);
        service.once(channels.KICK, cleanup);
        log.info(`Subscription ${id} started`);
      }
    };
  }
}
