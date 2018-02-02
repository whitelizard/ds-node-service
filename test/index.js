import test from 'blue-tape';
import express from 'express';
import bodyParser from 'body-parser';
import Deepstream from 'deepstream.io';
import getClient from 'extended-ds-client';
import Service, { createRpcService } from '../src/index';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.get('/getAuthToken', (req, res) => {
  try {
    const token = 'TEST';
    res.status(201).json({ token });
  } catch (err) {
    console.log('getAuthToken error:', err);
    res.status(500); // status Internal Server Error
  }
});
let restServer;
setTimeout(() => {
  restServer = app.listen(3000);
}, 3000);

const dss = new Deepstream();
const dss2 = new Deepstream();
let c;
let s;
let signal;
const rpcData = { arg1: 'val1', arg2: 2 };
const serviceName = 'testService';

let resolveConnected;
let connProm;

const options = {
  // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectInterval: 8000,
  maxReconnectAttempts: Infinity,
  heartbeatInterval: 60000,
};

test('Start service without deepstream.', async t => {
  connProm = new Promise(resolve => {
    resolveConnected = resolve;
  });
  s = createRpcService({
    serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  s.registerApi({
    testFunction: {
      method: (data, id) => {
        signal = 1;
        t.same(data, rpcData);
        t.equal(id, serviceName);
      },
      argDoc: [],
    },
  });
  await s.start();
  s.client.on('connectionStateChanged', cState => {
    if (cState === 'OPEN') resolveConnected();
  });
  t.ok(true);
});
test('Start deepstream server', async () => {
  dss.start();
  return connProm;
});

test('Create Test-client & request service', async t => {
  c = getClient('localhost:6020', options);
  c.on('error', e => console.log('Test-client Error:', e));
  c.login({});
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 1);
});

test('Close service', async t => {
  s.close();
  s = undefined;
  await new Promise(resolve => setTimeout(resolve, 1000));
  t.ok(true);
});

test('Inherit from Service', async t => {
  connProm = new Promise(resolve => {
    resolveConnected = resolve;
  }).then(state => console.log(state));
  class MyService extends Service {
    constructor({
      name, address, credentialsUrl, runForever,
    }) {
      super({
        serviceName: name,
        address,
        credentialsUrl,
        runForever,
      });
    }
    testFunc() {
      return true;
    }
  }
  Object.setPrototypeOf(MyService.prototype, Service.prototype);
  Object.setPrototypeOf(MyService, Service);
  const ms = new MyService({
    name: serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  ms.client.on('connectionStateChanged', cState => {
    console.log(cState);
    if (cState === 'OPEN') setTimeout(() => resolveConnected(cState), 500);
  });
  await ms.start();
  t.ok(true);
  t.ok(ms.testFunc());
  await connProm;
  ms.close();
});

test('Create & start service again with api registration', async t => {
  connProm = new Promise(resolve => {
    resolveConnected = resolve;
  }).then(state => console.log(state));
  s = createRpcService({
    serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  s.registerApi({
    testFunction: {
      method: (data, id) => {
        signal = 2;
        t.same(data, rpcData);
        t.equal(id, serviceName);
      },
      argDoc: [],
    },
  });
  s.client.on('connectionStateChanged', cState => {
    console.log(cState);
    if (cState === 'OPEN') setTimeout(() => resolveConnected(cState), 500);
  });
  await s.start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  t.ok(true);
  return connProm;
});

test('Request service', async t => {
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 2);
});

test('Restart deepstream', async () => {
  dss.stop();
  dss2.start();
});

test('Close clients', async t => {
  s.close();
  c.close();
  t.ok(true);
});

test('Shutdown servers', async () => {
  dss2.stop();
  restServer.close();
});
