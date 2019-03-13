import {
  errors,
  requestReply,
  createLog,
  EventEmitter,
  generate,
  createService,
  IInitializer
} from '@service-tunnel/core';
import * as socketIOClient from 'socket.io-client';
const log = createLog('client-socket');
const defaultPort = 61610;

interface IOptions {
  verifyBrokerIdentity?: (identity: any) => Promise<boolean> | boolean;
  getIdentity?: (identity: any, brokerIdentity: any) => Promise<any> | any;
  handleError?: (error: any) => Promise<any> | any;
}

export function createSocketClient(
  hostName: string,
  initializer: IInitializer,
  options: IOptions = {}
) {
  return createSocketService('client', hostName, initializer, options);
}

export function createSocketService(
  serviceName: string,
  hostName: string,
  initializer: IInitializer,
  options: IOptions = {}
) {
  log.info(`Creating ${serviceName} on ${hostName}`);
  const id = generate();
  let globalClient: SocketIOClient.Socket | undefined = undefined;
  let cancel = false;
  function disconnect() {
    if (globalClient) {
      globalClient.disconnect();
      globalClient.close();
      globalClient = undefined;
    }
  }
  async function connect(hostName: string = 'localhost') {
    disconnect();
    if (cancel) {
      return;
    }
    if (hostName.indexOf('http') !== 0) {
      hostName = `http://${hostName}:${defaultPort}`;
    }
    log.info(`Connecting ${serviceName}`);
    clientSocket(hostName, client => {
      log.info(`Socket for ${serviceName} created`);
      globalClient = client;
      // client.on(channels.DISCONNECT, disconnect);
      client.once('identify', async function accept(brokerIdentity: any) {
        log.info('Identifying', serviceName);
        if (
          options.verifyBrokerIdentity &&
          !(await options.verifyBrokerIdentity(brokerIdentity))
        ) {
          log.info('Server identification invalid', serviceName);
          if (
            options.handleError &&
            (await options.handleError(errors.TIMEOUT))
          ) {
            disconnect();
            return;
          }
          return setTimeout(connect, 5000);
        }
        const identity = options.getIdentity
          ? await options.getIdentity({ type: serviceName, id }, brokerIdentity)
          : {};
        identity.type = serviceName;
        identity.id = id;
        log.info('Identifying myself', serviceName);
        try {
          await requestReply(
            (client as any) as EventEmitter,
            ['identify', 'accepted'],
            identity
          );
          log.info('All OKAY on', serviceName);
          createService(serviceName, client as any, initializer);
        } catch (err) {
          log.info('Identification of myself failed', serviceName);
          if (
            options.handleError &&
            (await options.handleError(errors.TIMEOUT))
          ) {
            client.disconnect();
            return;
          } else {
            return setTimeout(connect, 5000);
          }
        }
        return;
      });
    });
  }
  connect(hostName);
  return function destroy() {
    log.info('Destroy', serviceName);
    cancel = true;
    disconnect();
  };
}

function clientSocket(
  uri: string,
  channels?: (socket: SocketIOClient.Socket) => void
) {
  return new Promise(async (yay, nay) => {
    const client = socketIOClient.connect(uri, {
      secure: uri.indexOf('https') === 0,
      rejectUnauthorized: false
    });
    if (channels) {
      channels(client);
    }
    yay(client);
  });
}
