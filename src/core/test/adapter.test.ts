import { Service } from '../service';
import { Broker, IPluginCreator } from '../broker';
import { Adapter } from '../adapter';

test('test', () => {
  expect(true).toBe(true);
});

export function createTests(
  name: string,
  createAdapter: (broker: () => Broker, i: number) => Adapter,
  plugins: (i: number) => IPluginCreator[] = () => []
) {
  test(`${name}:method:basic`, async d => {
    const broker = new Broker(plugins(0));
    const getBroker = () => broker;
    const service = new Service('calculator', createAdapter(getBroker, 0));
    service.addMethod<number>('multiply', (x1: number, x2: number) => {
      return x1 * x2;
    });
    service.addMethod<number>('multiplyAsync', (x1: number, x2: number) => {
      return new Promise(yay => setTimeout(() => yay(x1 * x2 * 2), 1000));
    });
    const client = new Service(createAdapter(getBroker, 0));
    let calc = client.use<any>('calculator');
    expect(await calc.multiply(5, 5)).toBe(25);
    expect(await calc.multiplyAsync(5, 5)).toBe(50);
    await Promise.all([broker.close(), service.close(), client.close()]);
    d();
  }, 3000);

  test(`${name}:method:timeout`, async d => {
    const broker = new Broker(plugins(1));
    const getBroker = () => broker;
    const client = new Service(createAdapter(getBroker, 1));
    let calc = client.use<any>('calculator');
    try {
      const result = await calc.multiply(5, 5);
      expect(result).toBe(99);
    } catch (err) {
      expect(err).toBeTruthy();
    }
    await Promise.all([broker.close(), client.close()]);
    d();
  }, 10000);

  test(`${name}:method:reconnect:service`, async d => {
    const broker = new Broker(plugins(1));
    const getBroker = () => broker;
    let service = new Service('calculator', createAdapter(getBroker, 1));
    service.addMethod<number>('multiply', (x1: number, x2: number) => {
      return x1 * x2;
    });
    const client = new Service(createAdapter(getBroker, 1));
    let calc = client.use<any>('calculator');
    let result = await calc.multiply(5, 5);
    expect(result).toBe(25);
    await service.close();
    try {
      result = await calc.multiply(5, 5);
      expect(result).toBe(99);
    } catch (err) {
      expect(err).toBeTruthy();
    }
    service = new Service('calculator', createAdapter(getBroker, 1));
    service.addMethod<number>('multiply', (x1: number, x2: number) => {
      return x1 * x2;
    });
    result = await calc.multiply(5, 5);
    expect(result).toBe(25);
    await Promise.all([broker.close(), client.close(), service.close()]);
    d();
  }, 10000);

  test(`${name}:method:reconnect:broker`, async d => {
    let broker = new Broker(plugins(1));
    const getBroker = () => broker;
    let service = new Service('calculator', createAdapter(getBroker, 1));
    service.addMethod<number>('multiply', (x1: number, x2: number) => {
      return x1 * x2;
    });
    const client = new Service(createAdapter(getBroker, 1));
    let calc = client.use<any>('calculator');
    let result = await calc.multiply(5, 5);
    expect(result).toBe(25);
    await broker.close();
    try {
      result = await calc.multiply(5, 5);
      expect(result).toBe(99);
    } catch (err) {
      expect(err).toBeTruthy();
    }
    broker = new Broker(plugins(1));
    result = await calc.multiply(5, 5);
    expect(result).toBe(25);
    await Promise.all([broker.close(), client.close(), service.close()]);
    d();
  }, 10000);

  test(`${name}:subscription`, async d => {
    const getBroker = () => broker;
    const broker = new Broker(plugins(2));
    const service = new Service('calculator', createAdapter(getBroker, 2));
    service.addSubscription<number>(
      'multiplySub',
      (emit, x1: number, x2: number) => {
        const interval = setInterval(() => emit(x1 * x2), 1000);
        return () => clearInterval(interval);
      }
    );
    service.addSubscription<number>(
      'multiplySub2',
      (emit, x1: number, x2: number) => {
        const interval = setInterval(() => emit(x1 * x2), 1000);
        return () => clearInterval(interval);
      }
    );
    const client = new Service(createAdapter(getBroker, 2));
    let calc = client.use<any>('calculator');
    let called = [];
    const unsub = calc.multiplySub(5, 5, (err: any, result: number) => {
      called.push('');
    });
    await new Promise(yay => setTimeout(yay, 4500));
    expect(called.length).toBe(4);
    unsub();
    await new Promise(yay => setTimeout(yay, 2000));
    expect(called.length).toBe(4);
    await Promise.all([broker.close(), service.close(), client.close()]);
    d();
  }, 10000);

  test(`${name}:subscription:err`, async d => {
    const getBroker = () => broker;
    const broker = new Broker(plugins(3));
    const service = new Service('calculator', createAdapter(getBroker, 3));
    service.addSubscription<number>(
      'immediate',
      (emit, x1: number, x2: number) => {
        throw new Error('error');
      }
    );
    service.addSubscription<number>(
      'delayed',
      (emit, x1: number, x2: number) => {
        const interval = setInterval(() => {
          emit(new Error('Error'));
        }, 1000);
        return () => clearInterval(interval);
      }
    );

    const client = new Service(createAdapter(getBroker, 3));
    let calc = client.use<any>('calculator');
    let err;
    let unsub = calc.immediate(5, 5, (e: any, result: number) => {
      err = e;
    });
    await new Promise(yay => setTimeout(yay, 2000));
    unsub();
    expect(err).toBeTruthy();
    err = undefined;
    unsub = calc.delayed(5, 5, (e: any, result: number) => {
      err = e;
    });
    await new Promise(yay => setTimeout(yay, 2000));
    expect(err).toBeTruthy();
    unsub();
    await Promise.all([broker.close(), service.close(), client.close()]);
    d();
  }, 10000);
}
