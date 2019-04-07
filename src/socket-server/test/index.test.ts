import { SocketAdapter } from 'rpc1-socket';
import { createTests } from 'rpc1/test/adapter.test';
import { pluginSocketBroker } from '../broker';

const port = 50000;
createTests(
  'socket',
  (broker, i) => new SocketAdapter(`http://localhost:${port + i}`),
  i => [pluginSocketBroker({ port: port + i })]
);
