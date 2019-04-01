<div align="center">
  <h2>rpc1</h2>
  <strong>Proxy any async service through sockets or other transport. Works with promises and subscriptions.</strong>
  <br />
  <br />
  <a href="https://travis-ci.org/bkniffler/rpc1">
    <img src="https://img.shields.io/travis/bkniffler/rpc1.svg?style=flat-square" alt="Build Status">
  </a>
  <a href="https://codecov.io/github/bkniffler/rpc1">
    <img src="https://img.shields.io/codecov/c/github/bkniffler/rpc1.svg?style=flat-square" alt="Coverage Status">
  </a>
  <a href="https://github.com/bkniffler/rpc1">
    <img src="http://img.shields.io/npm/v/rpc1.svg?style=flat-square" alt="Version">
  </a>
  <a href="https://github.com/bkniffler/rpc1">
    <img src="https://img.shields.io/badge/language-typescript-blue.svg?style=flat-square" alt="Language">
  </a>
  <a href="https://github.com/bkniffler/rpc1/master/LICENSE">
    <img src="https://img.shields.io/github/license/bkniffler/rpc1.svg?style=flat-square" alt="License">
  </a>
  <br />
  <br />
</div>

## Bindings

## Why

## Install

### Yarn

## Example

### Local

```jsx
createBroker(broker => {
  // Add a local service
  broker.local('calculator', service => {
    service.addMethod('multiply', (x1, x2) => x1 * x2);
  });
  // Add a local client
  broker.client(async client => {
    const service = client.use('calculator');
    try {
      console.log(await service.multiply(2, 3));
    } catch (err) {
      console.log(err);
    }
  });
});
```

### Socket

```jsx
const port = 9999;

createBroker(
  broker => {
    console.log('Broker is listening');
  },
  {
    plugins: [
      pluginSocketBroker({
        port
      })
    ]
  }
);

// Add a remote service
createSocketService('calculator', 'http://localhost:9999', service => {
  service.addMethod('multiply', (x1, x2) => x1 * x2);
});

// Add a remote client
createSocketClient('http://localhost:9999', async client => {
  const service = client.use('local-calculator');
  try {
    console.log(await service.multiply(2, 3));
  } catch (err) {
    console.log(err);
  }
});
```

### React

```jsx
export default () => {};
```
