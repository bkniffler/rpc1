import {
  errors,
  requestReply,
  createLog,
  Adapter,
  IEmitter,
  Service
} from 'rpc1';
import * as socketIOClient from 'socket.io-client';

const log = createLog('client-socket');
const defaultPort = 61610;

interface IOptions {
  verifyBrokerIdentity?: (identity: any) => Promise<boolean> | boolean;
  getIdentity?: (identity: any, brokerIdentity: any) => Promise<any> | any;
  handleError?: (error: any) => Promise<any> | any;
}

export class SocketAdapter extends Adapter {
  private cancel = false;
  private hostName: string;
  private options: IOptions;
  private service: Service;
  private client: SocketIOClient.Socket | undefined = undefined;
  constructor(hostName = 'localhost', options: IOptions = {}) {
    super();
    log.info(`Creating on ${hostName}`);
    this.options = options;
    if (hostName.indexOf('http') !== 0) {
      hostName = `http://${hostName}:${defaultPort}`;
    }
    this.hostName = hostName;
  }
  connectToService(service: Service) {
    this.service = service;
    this.initialize();
  }
  close() {
    log.info('Destroy', this.service.name);
    this.cancel = true;
    this.disconnect();
  }
  disconnect() {
    if (this.service) {
      this.service.disconnectFromEmitter();
    }
    if (this.client) {
      this.client.disconnect();
    }
    if (this.client) {
      this.client.close();
    }
    this.client = undefined;
  }
  initialize() {
    this.disconnect();
    if (this.cancel) {
      return;
    }
    log.info(`Connecting ${this.service.name}`);

    this.client = socketIOClient.connect(this.hostName, {
      secure: this.hostName.indexOf('https') === 0,
      rejectUnauthorized: false
    });

    log.info(`Socket for ${this.service.name} created`);
    this.client.once('disconnect', () => {
      this.initialize();
    });
    this.client.once('identify', (r: any) => this.identify(r));
  }
  private async identify(brokerIdentity: any) {
    log.info('Identifying', this.service.name);
    if (
      this.options.verifyBrokerIdentity &&
      !(await this.options.verifyBrokerIdentity(brokerIdentity))
    ) {
      log.info('Server identification invalid', this.service.name);
      if (
        this.options.handleError &&
        (await this.options.handleError(errors.TIMEOUT))
      ) {
        this.disconnect();
        return;
      }
      return setTimeout(this.initialize, 5000);
    }
    const identity = this.options.getIdentity
      ? await this.options.getIdentity(
          { type: this.service.name },
          brokerIdentity
        )
      : {};
    identity.type = this.service.name;
    log.info('Identifying myself', this.service.name);
    try {
      await requestReply(
        (this.client as any) as IEmitter,
        ['identify', 'accepted'],
        identity
      );
      log.info('All OKAY on', this.service.name);
      this.service.connectToEmitter(this.client as IEmitter);
    } catch (err) {
      log.info('Identification of myself failed', this.service.name);
      if (
        this.options.handleError &&
        (await this.options.handleError(errors.TIMEOUT))
      ) {
        (this.client as any).disconnect();
        return;
      } else {
        return setTimeout(this.initialize, 5000);
      }
    }
    return;
  }
}
