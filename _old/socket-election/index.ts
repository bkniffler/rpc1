import {
  createDefaultServiceStorage,
  createDefaultIDStorage
} from '../../storage';
import { Service } from '../../service';
import { createMasterHandlers } from '../../broker';
import { channels } from '../../common';
import { clientSocket, serverSocket } from '../../socket/socket';
import { elect } from './leader-election';

const defaultType = 'diego-data';
const defaultPort = 61610;

export function socketElectionMaster() {
  const idStorage = createDefaultIDStorage();
  const serviceStorage = createDefaultServiceStorage();

  let server: any = undefined;
  const elector = elect(defaultType);
  elector.on('leader', async () => {
    console.log('This node was elected as leader');
    server = await serverSocket(socket => {
      socket.once(channels.IDENTIFY, ({ type }: { type: string }) => {
        const handlers = createMasterHandlers(
          socket,
          idStorage,
          serviceStorage
        );

        socket.on(channels.METHOD, handlers.method);
        socket.on(channels.SUBSCRIPTION, handlers.subscription);
        socket.on(channels.READY, function onReady() {
          socket.removeListener(channels.READY, onReady);
          serviceStorage.add(type, socket);
        });
        socket.emit(channels.CONNECT);
      });
    }, defaultPort);
  });
  elector.start();

  return () => {
    serviceStorage.map(emitter => emitter.emit(channels.DISCONNECT));
    elector.stop();
    if (server) {
      server.close();
    }
  };
}

const isTrusted = (ad: any) => Promise.resolve(ad && true);
export function socketElectionClient(service: Service) {
  let globalClient: SocketIOClient.Socket | undefined = undefined;
  function disconnect() {
    if (globalClient) {
      globalClient.disconnect();
      globalClient.close();
      globalClient = undefined;
    }
  }
  async function connect(hostName: string) {
    disconnect();
    if (await isTrusted(hostName)) {
      clientSocket(`http://${hostName}:${defaultPort}`, client => {
        globalClient = client;
        service.connect(client);
        client.emit(channels.IDENTIFY, { type: service.name });
      });
    } else {
      globalClient = undefined;
    }
  }

  const follower = elect(defaultType, {
    forceFollow: true,
    checkLeaderValidity: leader => !!leader
  });
  follower.on('follower', service => {
    console.log('Found a server');
    connect(service.ipV4[0]);
  });
  follower.on('reelection', () => {
    console.log('Server disconnected');
    disconnect();
  });
  follower.on('error', err => {
    console.log('ERR', err);
  });

  follower.start();
  return () => {
    follower.stop();
    disconnect();
  };
}

/*import { socketClient, socket } from './socket';
import { Elector, elect } from './leader-election';
import { machineHash } from '../utils';

const channels = {
  SUBSCRIPTION: 'subscription',
  INIT: 'init',
  METHOD: 'method',
  IDENTIFY: 'identify'
};
const TIMEOUT = 1000;
const MAX_RETRIES = 5;
export async function registryServer(
  serverChannel?: (socket: SocketIO.Socket) => void,
  identity = 'server'
) {
  console.log('Starting leader election');

  let server: any = undefined;
  const services = {};
  const elector = elect(TYPE);
  elector.on('leader', async () => {
    console.log('This node was elected as leader');
    server = await socket(socket => {
      socket.once(
        channels.IDENTIFY,
        ({ type, key }: { type: string; key: string }) => {
          if (!services[type]) {
            services[type] = {};
          }
          services[type][key] = socket;
          socket.emit(channels.INIT, true);
          if (serverChannel) {
            serverChannel(socket);
          }

          socket.on(channels.METHOD, handleMethodOrSubscription(false));
          socket.on(channels.SUBSCRIPTION, handleMethodOrSubscription(true));
        }
      );
    }, defaultPort);
  });
  const disconnect = getSocketClient(elector, identity, machineHash);
  elector.start();

  return () => {
    elector.stop();
    disconnect();
    if (server) {
      server.close();
    }
  };
}


*/
