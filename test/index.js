import test from 'blue-tape';
import express from 'express';
import bodyParser from 'body-parser';
import Deepstream from 'deepstream.io';
import getClient from 'extended-ds-client';
import BaseService from '../src/index';

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
const restServer = app.listen(3000);

const dss = new Deepstream();
const dss2 = new Deepstream();
let c;
let s;
let signal;

let resolveConnected;
let connProm;

const options = {
  // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectInterval: 8000,
  maxReconnectAttempts: Infinity,
  heartbeatInterval: 60000,
};

// class Service extends BaseService {
//   signal;
//   constructor() {
//     super({
//       address: 'localhost:6020',
//       options,
//       credentialsUrl: 'http://localhost:3000/getAuthToken',
//       runForever: false,
//     });
//     this.registerApi({
//       testFunction: {
//         method: () => {
//           signal = 1;
//         },
//         argDoc: [],
//       },
//     });
//   }
// }

connProm = new Promise(resolve => {
  resolveConnected = resolve;
});
test('Start service without deepstream.', async t => {
  s = new BaseService({
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  s.registerApi({
    testFunction: {
      method: () => {
        signal = 1;
      },
      argDoc: [],
    },
  });
  // s = new Service();
  await s.start();
  s.c.on('connectionStateChanged', cState => {
    if (cState === 'OPEN') resolveConnected();
  });
  t.ok(true);
});
test('Start deepstream server', async () => {
  dss.start();
  // return new Promise(resolve => setTimeout(resolve, 3000));
  return connProm;
});

test('Create Test-client & request service', async t => {
  c = getClient('localhost:6020', options);
  c.on('error', e => console.log('Test-client Error:', e));
  c.login({});
  await c.rpc.p.make('service/testFunction');
  t.equal(signal, 1);
});

test('Close service', async t => {
  s.close();
  s = undefined;
  await new Promise(resolve => setTimeout(resolve, 1000));
  t.ok(true);
});

connProm = new Promise(resolve => {
  resolveConnected = resolve;
}).then(state => console.log(state));
test('Create & start service again with api registration', async t => {
  s = new BaseService({
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    runForever: false,
  });
  s.registerApi({
    testFunction: {
      method: () => {
        signal = 2;
      },
      argDoc: [],
    },
  });
  s.c.on('connectionStateChanged', cState => {
    console.log(cState);
    if (cState === 'OPEN') setTimeout(() => resolveConnected(cState), 500);
  });
  await s.start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  t.ok(true);
  return connProm;
});

test('Request service', async t => {
  await c.rpc.p.make('service/testFunction');
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
