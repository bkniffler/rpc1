import { requestReply, createLog, IBroker } from 'rpc1';
import { findPort } from './utils';
import * as https from 'https';
import { Server, Socket } from 'socket.io';
//@ts-ignore
import * as _socketIO from 'socket.io';
const socketIO = _socketIO;
const log = createLog('broker-socket');

const defaultPort = 61610;

interface IOptions {
  ssl?: [string, string];
  port?: number;
  check?: number;
  verifyClientIdentity?: (identity: any) => Promise<boolean> | boolean;
  getIdentity?: () => Promise<any> | any;
}

interface IIdentity {
  id: string;
  type: string;
}
export function pluginSocketBroker(options: IOptions = {}) {
  return function(broker: IBroker) {
    log.info('Adding socket plugin to broker');
    let server = serverSocket(options as IOptions, async socket => {
      log.info('New socket, trying identification...');
      const identity = await requestReply<[IIdentity]>(
        socket,
        ['identify', 'identify'],
        options.getIdentity ? await options.getIdentity() : {}
      )
        .then(identity => identity[0])
        .catch(x => undefined);
      if (!identity) {
        log.info('No identity');
        // socket.emit('error', errors.TIMEOUT);
        socket.disconnect();
        return;
      }
      if (
        options.verifyClientIdentity &&
        !(await options.verifyClientIdentity(identity))
      ) {
        log.info(`Could not verify identity ${identity.type}`);
        // socket.emit('error', errors.IDENTITY);
        socket.disconnect();
        return;
      }
      log.info(`Successfully identified and verified ${identity.type}`);
      socket.once('disconnect', broker.connect(identity.type, socket));
      socket.emit('accepted');
    });
    return () => {
      return new Promise(yay => {
        if (server) {
          return server.then(s => {
            s.close(() => {
              if (s.closeServer) {
                s.closeServer(yay);
              } else {
                yay();
              }
            });
          });
        } else {
          return yay();
        }
      });
    };
  };
}

interface IServer extends Server {
  port: number;
  closeServer?: (cb: () => void) => void;
}

function serverSocket(options: IOptions, channels?: (socket: Socket) => void) {
  let port = options.port || defaultPort;
  return new Promise<IServer>(async (yay, nay) => {
    if (!port) {
      try {
        port = await findPort(13121);
      } catch (err) {
        return nay(err);
      }
    }

    let io: IServer;
    if (options.ssl) {
      const server = https.createServer({
        key: options.ssl[0],
        cert: options.ssl[1]
      });
      io = socketIO(server) as IServer;
      server.listen(port);
      io.closeServer = cb => {
        server.close(cb);
        setImmediate(function() {
          server.emit('close');
        });
      };
      log.info(`Listening to port ${port} with SSL`);
    } else {
      io = socketIO.listen(port, {}) as IServer;
      log.info(`Listening to port ${port}, no SSL`);
    }

    io.on('connection', function(socket) {
      socket.setMaxListeners(50);
      if (channels) {
        channels(socket);
      }
    });
    io.port = port;
    yay(io);
  });
}
