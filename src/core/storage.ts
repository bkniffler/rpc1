import { generate, IEmitter } from './utils';

export interface IIdStorage {
  add: (id: string) => Promise<void> | void;
  remove: (id: string) => Promise<void> | void;
  has: (id: string) => Promise<boolean> | boolean;
}

export function createDefaultIDStorage() {
  const ids = {};
  const idStorage: IIdStorage = {
    add: (id: string) => {
      ids[id] = true;
    },
    remove: (id: string) => {
      delete idStorage[id];
    },
    has: (id: string) => ids[id] === true
  };
  return idStorage;
}

export interface IServiceStorage {
  remove: (type: string, id: string) => void;
  add: (type: string, emitter: IEmitter) => string;
  get: (type: string, id?: string) => IEmitter | undefined;
  map: (mapper: (emitter: IEmitter) => void) => void;
  count: () => number;
}

export function createDefaultServiceStorage() {
  const services = {};
  const idStorage: IServiceStorage = {
    remove: (type, id) => {
      if (!services[type]) {
        services[type] = {};
      }
      delete services[type][id];
    },
    add: (type, emitter) => {
      if (!services[type]) {
        services[type] = {};
      }
      const id = generate();
      services[type][id] = emitter;
      return id;
    },
    get: (type, id) => {
      if (services && services[type] && id) {
        return services[type][id];
      } else if (services && services[type]) {
        const firstKey = Object.keys(services[type])[0];
        return services[type][firstKey];
      }
      return undefined;
    },
    map: mapper => {
      Object.keys(services).forEach(key =>
        Object.keys(services[key]).forEach(key2 => mapper(services[key][key2]))
      );
    },
    count: () => {
      let count = 0;
      Object.keys(services).forEach(key =>
        Object.keys(services[key]).forEach(key2 => (count = count + 1))
      );
      return count;
    }
  };
  return idStorage;
}
