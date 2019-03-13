import { createBroker } from '../src';

interface ICalculator {
  sub: (x1: number, x2: number, cb: (err: any, result: number) => void) => void;
  multiply: (x1: number, x2: number) => Promise<number>;
}

test('method', () => {
  return new Promise(yay => {
    let disco = false;
    const done = async () => {
      await destroy();
      expect(disco).toBe(true);
      yay();
    };
    const destroy = createBroker(broker => {
      broker.local('calculator', service => {
        service.addMethod<number>(
          'multiply',
          (x1: number, x2: number) => x1 * x2
        );
      });
      broker.client(async client => {
        const service = client.use<ICalculator>('calculator');
        try {
          const result = await service.multiply(2, 3);
          expect(result).toBe(6);
        } catch (err) {
          console.log(err);
          expect(err).toBeNull();
        }
        setTimeout(done);
        return () => {
          disco = true;
        };
      });
    });
  });
}, 15000);

/*test('method:err', () => {
  return new Promise(yay => {
    let disco = false;
    const done = async () => {
      await broker.destroy();
      expect(disco).toBe(true);
      yay();
    };
    const broker = createBroker();
    const service1 = createService('calculator', (service) => {
      service.addMethod<number>('multiply', () => {
        throw new Error('Jadda');
      });
    });
    const client = createService('client');

    client.on('connect', async () => {
      const service = client.use<ICalculator>('calculator');
      try {
        const result = await service.multiply(2, 3);
        expect(result).toBe(1234);
      } catch (err) {
        expect(err).toBeTruthy();
      }
      setTimeout(done);
    });
    client.on('disconnect', () => {
      disco = true;
    });
    broker.local(service1);
    broker.local(client);
  });
});

test('subscription', () => {
  return new Promise(yay => {
    let calls = 0;
    let disco = false;
    const done = async () => {
      await broker.destroy();
      expect(calls).toBe(3);
      expect(disco).toBe(true);
      yay();
    };
    const broker = createBroker();
    const service1 = createService('calculator');
    service1.addSubscription('sub', (emit, x1: number, x2: number) => {
      const interval = setInterval(() => {
        emit(null, x1 * x2);
      }, 1000);
      return () => {
        return clearInterval(interval);
      };
    });
    const client = createService('client');
    client.on('connect', async () => {
      const service = client.use<ICalculator>('calculator');
      const unsub = service.sub(1, 2, (err, res) => {
        calls += 1;
        expect(res).toBe(2);
        expect(err).toBeNull();
      });
      setTimeout(unsub, 3500);
      setTimeout(done, 4000);
    });
    client.on('disconnect', () => {
      disco = true;
    });
    broker.local(service1);
    broker.local(client);
  });
}, 5000);

test('subscription:err', () => {
  return new Promise(yay => {
    let calls = 0;
    let disco = false;
    const done = async () => {
      await broker.destroy();
      expect(calls).toBe(3);
      expect(disco).toBe(true);
      yay();
    };
    const broker = createBroker();
    const service1 = createService('calculator');
    service1.addSubscription('sub', (emit, x1: number, x2: number) => {
      const interval = setInterval(() => {
        emit(new Error('Error'));
      }, 1000);
      return () => {
        return clearInterval(interval);
      };
    });
    const client = createService('client');
    client.on('connect', async () => {
      const service = client.use<ICalculator>('calculator');
      const unsub = service.sub(1, 2, (err, res) => {
        calls += 1;
        expect(res).toBe(undefined);
        expect(err).toBeTruthy();
      });
      setTimeout(unsub, 3500);
      setTimeout(done, 4000);
    });
    client.on('disconnect', () => {
      disco = true;
    });
    broker.local(service1);
    broker.local(client);
  });
}, 5000);
*/
