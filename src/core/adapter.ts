import { EventEmitter } from 'events';
import { Broker } from './broker';
import { Service } from './service';

export abstract class Adapter {
  abstract connectToService(service: Service): void;
  abstract close(): void;
  abstract disconnect(): void;
}

export class LocalAdapter extends Adapter {
  emitter: EventEmitter | undefined;
  service: Service;
  broker: () => Broker;
  disc?: Function;
  constructor(broker: Broker | (() => Broker)) {
    super();
    this.broker = (broker && broker['plugins'] ? () => broker : broker) as any;
  }
  connectToService(service: Service) {
    this.service = service;
    this.connect();
  }
  connect() {
    const broker = this.broker();
    if (broker && !broker.isClosed) {
      this.emitter = new EventEmitter();
      this.service.connectToEmitter(this.emitter);
      this.disconnect = broker.connect(
        this.service.name || 'local',
        this.emitter
      );
    } else {
      this.disconnect();
      setTimeout(this.connect, 2000);
    }
  }
  disconnect() {
    if (this.disc) {
      this.disc();
    }
    if (this.emitter) {
      this.emitter.removeAllListeners();
    }
    if (this.service) {
      console.log('Disconnect', this.service.name);
      this.service.disconnectFromEmitter();
    }
    this.emitter = undefined;
  }
  close() {
    this.disconnect();
  }
}
