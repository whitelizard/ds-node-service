import test from 'blue-tape';
import express from 'express';
import bodyParser from 'body-parser';
import Deepstream from 'deepstream.io';
import getClient from 'extended-ds-client';
import Service, { createRpcService } from '../src/index';

const dss = new Deepstream('./test/testDsConfig.yml');
const dss2 = new Deepstream('./test/testDsConfig.yml');
const dss3 = new Deepstream('./test/testDsConfig.yml');
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
};

// AuthenticationHandler mocking
const app = express();
let currentTokenIndex = 0;
const activeTokens = {};
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.get('/getAuthToken', (req, res) => {
  try {
    currentTokenIndex += 1;
    const token = `TEST${currentTokenIndex}`;
    activeTokens[token] = setTimeout(() => delete activeTokens[token], 5000);
    console.log('Generated token:', token);
    res.status(201).json({ token });
  } catch (err) {
    console.log('getAuthToken error:', err);
    res.status(500); // status Internal Server Error
  }
});
app.post('/authenticate', (req, res) => {
  try {
    const { id, token } = req.body.authData;
    console.log('Auth from:', id, ', token:', token);
    if (id === 'testClient') {
      return res.status(200).json({
        username: id,
        clientData: { id },
        serverData: { id },
      });
    }
    // Service login
    if (token in activeTokens) {
      delete activeTokens[token];
      return res.status(200).json({
        username: id,
        clientData: { id },
        serverData: { id, service: true },
      });
    }
    console.log('Failed token login.');
    return res.status(401).send();
  } catch (err) {
    return res.status(500).send();
  }
});
const restServer = app.listen(3000);

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
  console.log('S.LOGIN:::::', s.client.eventNames());
  s.registerApi({
    testFunction: {
      method: data => {
        signal = 1;
        t.same(data, rpcData);
        // t.equal(id, serviceName);
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
  c.login({ id: 'testClient' });
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 1);
});

test('Close service', async t => {
  s.close();
  s = undefined;
  await new Promise(resolve => setTimeout(resolve, 1000));
  t.ok(true);
});

let cs;
test('Inherit from Service', async t => {
  connProm = new Promise(resolve => {
    resolveConnected = resolve;
  }).then(state => console.log(state));
  class CustomService extends Service {
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
  Object.setPrototypeOf(CustomService.prototype, Service.prototype);
  Object.setPrototypeOf(CustomService, Service);
  cs = new CustomService({
    name: serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  cs.client.on('connectionStateChanged', cState => {
    console.log(cState);
    if (cState === 'OPEN') setTimeout(() => resolveConnected(cState), 500);
  });
  cs.registerApi({
    testFunction: {
      method: data => {
        signal = 2;
        t.same(data, rpcData);
      },
      argDoc: [],
    },
  });
  await cs.start();
  await connProm;
  t.ok(true);
  t.ok(cs.testFunc());
});

test('Request service', async t => {
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 2);
});

test('Restart deepstream', async () => {
  dss.stop();
  await new Promise(resolve => setTimeout(resolve, 500));
  dss2.start();
  await new Promise(resolve => setTimeout(resolve, 500));
});

test('Request service', async t => {
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 2);
});

test('Close custom service', async t => {
  cs.close();
  t.ok(true);
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
      method: data => {
        signal = 3;
        t.same(data, rpcData);
        // t.equal(id, serviceName);
      },
      argDoc: [],
    },
  });
  s.client.on('connectionStateChanged', cState => {
    console.log(cState);
    if (cState === 'OPEN') setTimeout(() => resolveConnected(cState), 500);
  });
  await s.start();
  await new Promise(resolve => setTimeout(resolve, 500));
  t.ok(true);
  return connProm;
});

test('Request service', async t => {
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 3);
});

test('Restart deepstream', async () => {
  dss2.stop();
  await new Promise(resolve => setTimeout(resolve, 500));
  dss3.start();
  await new Promise(resolve => setTimeout(resolve, 500));
});

test('Request service', async t => {
  await new Promise(resolve => setTimeout(resolve, 500));
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 3);
});

test('Close clients', async t => {
  s.close();
  c.close();
  t.ok(true);
});

test('Shutdown servers', async () => {
  dss3.stop();
  restServer.close();
});
