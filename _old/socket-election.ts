import { createService } from '../index';

interface ICalculator {
  multiply: (x1: number, x2: number) => Promise<number>;
}

async function goSimple() {
  const done = () => {
    clearTimeout(timeout);
    destroy();
  };
  const destroy = socketElectionMaster();
  const service1 = createService('calculator');
  service1.addMethod<number>('multiply', (x1: number, x2: number) => {
    return x1 * x2;
  });
  const client = createService('client');
  client.onConnect(async () => {
    const service = client.use<ICalculator>('calculator');
    const result = await service.multiply(2, 3);
    console.log('result', result);
    done();
  });
  client.onDisconnect(() => {
    console.log('Disconnected :(');
  });
  socketElectionClient(service1);
  socketElectionClient(client);
  const timeout = setTimeout(done, 20000);
}

goSimple();
