import { createBroker } from '@service-tunnel/core';
import {
  pluginSocketBroker,
  createSocketService,
  generateCertificate,
  createSocketClient
} from './index';

interface ICalculator {
  multiply: (x1: number, x2: number) => Promise<number>;
}

const port = 9991;
const maxTimeout = 10000;
test(
  'socket:method:basic',
  d => {
    let hasResult = false;
    const done = async () => {
      clearTimeout(timeout);
      services.forEach(x => x());
      await destroy();
      expect(hasResult).toBe(true);
      d();
    };
    const timeout = setTimeout(done, maxTimeout);
    const destroy = createBroker(broker => {
      broker.plugin(
        pluginSocketBroker({
          port
        })
      );
    });
    const services = [
      createSocketClient(`http://localhost:${port}`, async service => {
        const calculator = service.use<ICalculator>('calculator');
        try {
          const result = await calculator.multiply(2, 3);
          expect(result).toBe(6);
          hasResult = true;
        } catch (err) {
          expect({}).toBeNull();
        }
        done();
      }),
      createSocketService('calculator', `http://localhost:${port}`, service => {
        service.addMethod<number>('multiply', (x1: number, x2: number) => {
          return x1 * x2;
        });
      })
    ];
  },
  maxTimeout + 1000
);

test(
  'socket:method:identity',
  d => {
    let hasResult = false;
    const done = async () => {
      clearTimeout(timeout);
      services.forEach(x => x());
      await destroy();
      expect(hasResult).toBe(true);
      d();
    };
    const timeout = setTimeout(done, maxTimeout);
    const destroy = createBroker(broker => {
      broker.plugin(
        pluginSocketBroker({
          port,
          getIdentity: () => ({ name: 'broker123' }),
          verifyClientIdentity: (identity: any) =>
            identity.accessToken === 'Bearer 12345'
        })
      );
    });
    const services = [
      createSocketClient(
        `http://localhost:${port}`,
        async service => {
          const calculator = service.use<ICalculator>('calculator');
          try {
            const result = await calculator.multiply(2, 3);
            expect(result).toBe(6);
            hasResult = true;
          } catch (err) {
            expect({}).toBeNull();
          }
        },
        {
          getIdentity: () => ({ accessToken: 'Bearer 12345' }),
          verifyBrokerIdentity: (identity: any) => identity.name === 'broker123'
        }
      ),
      createSocketClient(
        `http://localhost:${port}`,
        async service => {
          const calculator = service.use<ICalculator>('calculator');
          try {
            const result = await calculator.multiply(2, 3);
            expect(result).toBe(-1);
          } catch (err) {
            expect(err).toBeTruthy();
          }
        },
        {
          getIdentity: () => ({ accessToken: 'Bearer 123' }),
          verifyBrokerIdentity: (identity: any) => identity.name === 'broker123'
        }
      ),
      createSocketService(
        'calculator',
        `http://localhost:${port}`,
        service => {
          service.addMethod<number>('multiply', (x1: number, x2: number) => {
            return x1 * x2;
          });
        },
        {
          getIdentity: () => ({ accessToken: 'Bearer 12345' }),
          verifyBrokerIdentity: (identity: any) => identity.name === 'broker123'
        }
      )
    ];
  },
  maxTimeout + 1000
);

test(
  'socket:method:https',
  d => {
    let hasResult = false;
    const done = async () => {
      clearTimeout(timeout);
      services.forEach(x => x());
      await destroy();
      expect(hasResult).toBe(true);
      d();
    };
    const timeout = setTimeout(done, maxTimeout);
    const { privateKey, cert } = generateCertificate();
    const destroy = createBroker(broker => {
      broker.plugin(
        pluginSocketBroker({
          port,
          ssl: [privateKey, cert]
        })
      );
    });
    const services = [
      createSocketClient(`https://localhost:${port}`, async service => {
        const calculator = service.use<ICalculator>('calculator');
        try {
          const result = await calculator.multiply(2, 3);
          expect(result).toBe(6);
          hasResult = true;
        } catch (err) {
          expect({}).toBeNull();
        }
        done();
      }),
      createSocketService(
        'calculator',
        `https://localhost:${port}`,
        service => {
          service.addMethod<number>('multiply', (x1: number, x2: number) => {
            return x1 * x2;
          });
        }
      )
    ];
  },
  maxTimeout + 1000
);

/*

test(
  'socket:method:withclient',
  () => {
    return new Promise(yay => {
      let disco = false;
      const done = async () => {
        clearTimeout(timeout);
        await broker.destroy();
        expect(disco).toBe(true);
        yay();
      };
      const timeout = setTimeout(done, maxTimeout);
      const broker = createBroker([
        pluginSocketBroker({
          port: 9999
        })
      ]);
      const service1 = createService('calculator');
      service1.addMethod<number>('multiply', (x1: number, x2: number) => {
        return x1 * x2;
      });
      const client = createService('client');
      client.on('connect', async () => {
        const service = client.use<ICalculator>('calculator');
        try {
          const result = await service.multiply(2, 3);
          expect(result).toBe(6);
        } catch (err) {
          expect(err).toBeNull();
        }
        setTimeout(done);
      });
      client.on('disconnect', () => {
        disco = true;
      });
      socketClient('http://localhost:9999', service1);
      socketClient('http://localhost:9999', client);
    });
  },
  maxTimeout
);

test(
  'socket:identity:basic',
  () => {
    return new Promise(yay => {
      const done = async () => {
        clearTimeout(timeout);
        await broker.destroy();
        yay();
      };
      const timeout = setTimeout(done, maxTimeout);
      const broker = createBroker([
        pluginSocketBroker({
          port: 9999,
          getIdentity: () => ({ key: '12345' }),
          verifyClientIdentity: identity =>
            identity.key === 'calc' || identity.key === '54321'
        })
      ]);
      const service1 = createService('calculator');
      service1.addMethod<number>('multiply', (x1: number, x2: number) => {
        return x1 * x2;
      });
      const client = createService('client');
      socketClient('http://localhost:9999', service1, {
        getIdentity: () => ({ key: 'calc' })
      });
      socketClient('http://localhost:9999', client, {
        getIdentity: () => ({ key: '54321' }),
        verifyBrokerIdentity: identity => identity.key === '12345'
      });
      const client2 = createService('client');
      socketClient('http://localhost:9999', client2, {
        getIdentity: () => ({ key: '54321' }),
        verifyBrokerIdentity: identity => {
          if (identity.key === '1234') {
            return true;
          }
          return false;
        }
      });
      const client3 = createService('client');
      socketClient('http://localhost:9999', client3, {
        getIdentity: () => ({ key: '5432' }),
        verifyBrokerIdentity: identity => {
          return true;
        }
      });

      Promise.all([
        async () => {
          const service = client.use<ICalculator>('calculator');
          try {
            const result = await service.multiply(2, 3);
            expect(result).toBe(6);
          } catch (err) {
            expect(err).toBeNull();
          }
        },
        async () => {
          const service = client2.use<ICalculator>('calculator');
          try {
            const result = await service.multiply(2, 3);
            expect(result).toBe(false);
          } catch (err) {
            expect(err).toBeTruthy();
          }
        },
        async () => {
          const service = client3.use<ICalculator>('calculator');
          try {
            const result = await service.multiply(2, 3);
            expect(result).toBe(false);
          } catch (err) {
            expect(err).toBeTruthy();
          }
        }
      ]).then(() => setTimeout(done));
    });
  },
  maxTimeout
);
*/
