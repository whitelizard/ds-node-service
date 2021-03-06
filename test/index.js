import test from 'blue-tape';
import express from 'express';
import joi from 'joi';
import bodyParser from 'body-parser';
import Deepstream from 'deepstream.io';
import getClient from 'extended-ds-client';
import Service, { createRpcService } from '../src/index';

const dss = new Deepstream('./test/testDsConfig.yml');
const dss2 = new Deepstream('./test/testDsConfig.yml');
const dss3 = new Deepstream('./test/testDsConfig.yml');
const dss4 = new Deepstream();
let c;
let s;
let cs;
let signal;
const rpcData = { arg1: 'val1', arg2: 2 };
const rpcDataSpec = {
  description: 'My rpc function',
  args: joi.object().keys({
    arg1: joi.string(),
    arg2: joi.number().positive(),
  }),
  return: undefined,
};
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
let lastLoginId;
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
      lastLoginId = id;
      return res.status(200).json({
        username: id,
        clientData: { id },
        serverData: { id },
      });
    }
    // Service login
    if (token in activeTokens) {
      delete activeTokens[token];
      lastLoginId = id;
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
    name: serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    credentials: { id: serviceName },
    runForever: false,
  });
  s.registerApi(
    {
      testFunction: rpcDataSpec,
    },
    {
      testFunction: data => {
        signal = 1;
        t.same(data, rpcData);
      },
    },
  );
  await s.start();
  s.client.on('connectionStateChanged', cState => {
    if (cState === 'OPEN') {
      t.equals(lastLoginId, serviceName);
      resolveConnected();
    }
  });
  t.ok(true);
});

test('Start deepstream server', async () => {
  dss.start();
  return connProm;
});

test('Create Test-client & request service', async () => {
  c = getClient('localhost:6020', options);
  c.on('error', e => console.log('Test-client Error:', e));
  c.login({ id: 'testClient' });
});

test('Request Service', async t => {
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 1);
});

test('Request getInterface', async t => {
  const reply = await c.rpc.p.make(`${serviceName}/getInterface`);
  t.same(Object.keys(reply), Object.keys(s.state.apiSpec));
  t.same(Object.keys(reply), Object.keys(s.state.apiImpl));
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
  class CustomService extends Service {
    testFunc() {
      return true;
    }
  }
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
  cs.registerApi(
    {
      testFunction: rpcDataSpec,
    },
    {
      testFunction: data => {
        signal = 2;
        t.same(data, rpcData);
      },
    },
  );
  await cs.start();
  await connProm;
  t.ok(cs.testFunc());
});

test('Request service', async t => {
  await new Promise(resolve => setTimeout(resolve, 10));
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 2);
});

test('Restart deepstream', async () => {
  dss.stop();
  await new Promise(resolve => setTimeout(resolve, 500));
  dss2.start();
  await new Promise(resolve => setTimeout(resolve, 1000));
});

test('Request service', async t => {
  await new Promise(resolve => setTimeout(resolve, 10));
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
    name: serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  s.registerApi(
    {
      testFunction: rpcDataSpec,
    },
    {
      testFunction: data => {
        signal = 3;
        t.same(data, rpcData);
      },
    },
  );
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
  await new Promise(resolve => setTimeout(resolve, 1000));
});

test('Request service', async t => {
  // await new Promise(resolve => setTimeout(resolve, 500));
  await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
  t.equal(signal, 3);
});

test('Restart deepstream', async () => {
  dss3.stop();
  await new Promise(resolve => setTimeout(resolve, 500));
  dss4.start();
  await new Promise(resolve => setTimeout(resolve, 500));
});

test('Test the README example', async t => {
  connProm = new Promise(resolve => {
    resolveConnected = resolve;
  }).then(state => console.log(state));

  // const serviceName = 'service1';
  const address = 'localhost:6020';
  const credentials = { password: 'secretPassword' };

  // The API schema should actually rather be placed in a separate file.
  const apiSchema = {
    doSomething: {
      description: 'Test function that does something',
      args: joi.object().keys({
        name: joi
          .string()
          .trim()
          .alphanum(),
        properties: joi
          .object()
          .unknown()
          .keys({
            birth: joi.date(),
          }),
      }),
      return: joi.number(),
    },
  };

  // eslint-disable-next-line
  function doSomething({ name, properties }) {
    // DB call or whatever
    return 5;
  }
  const implementation = {
    doSomething,
  };

  const service = createRpcService({
    name: serviceName,
    address,
    runForever: true,
    credentials,
  });

  service.registerApi(apiSchema, implementation);

  s.client.on('connectionStateChanged', cState => {
    console.log(cState);
    if (cState === 'OPEN') setTimeout(() => resolveConnected(cState), 500);
  });

  await service.start();

  cs = service;
  await new Promise(resolve => setTimeout(resolve, 500));
  t.ok(true);
  return connProm;
});

test('Request README example service FAIL', async t => {
  await new Promise(resolve => setTimeout(resolve, 500));
  let message;
  try {
    await c.rpc.p.make(`${serviceName}/doSomething`, rpcData);
  } catch (err) {
    ({ message } = err);
  }
  console.log(message);
  t.equal(message, '"arg1" is not allowed');
  try {
    await c.rpc.p.make(`${serviceName}/doSomething`, {
      name: '  !  ',
      properties: { birth: new Date() },
    });
  } catch (err) {
    ({ message } = err);
  }
  console.log(message);
  t.equal(message, '"name" must only contain alpha-numeric characters');
});

test('Request README example service SUCCESS', async t => {
  await new Promise(resolve => setTimeout(resolve, 500));
  let message;
  try {
    await c.rpc.p.make(`${serviceName}/doSomething`, {
      name: 'foo4',
      properties: { birth: new Date() },
    });
  } catch (err) {
    ({ message } = err);
  }
  console.log(message);
  t.equal(message, undefined);
});

test('Close clients', async t => {
  cs.close();
  s.close();
  c.close();
  t.ok(true);
});

test('Shutdown servers', async () => {
  dss4.stop();
  restServer.close();
});
