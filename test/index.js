import test from 'blue-tape';
import express from 'express';
import bodyParser from 'body-parser';
import DeepstreamServer from 'deepstream.io';
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
app.listen(3000);

const dss = new DeepstreamServer();
const dss2 = new DeepstreamServer();
let c;
let s;
let signal;
const options = {
  // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectInterval: 8000,
  maxReconnectAttempts: Infinity,
  heartbeatInterval: 60000,
};

test('Start service without deepstream.', async () => {
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
  s.start();
});

test('Start deepstream server', async () => {
  dss.start();
  await new Promise(resolve => setTimeout(resolve, 100));
});

test('Create Test-client', async () => {
  c = getClient('localhost:6020', options);
  c.on('error', e => console.log('Test-client Error:', e));
  await new Promise(resolve => setTimeout(resolve, 20));
});

test('Request service', async t => {
  const res = await c.rpc.p.make('service/testFunction');
  t.ok(res === undefined);
  t.ok(signal === 1);
});

test('Close service', async t => {
  s.close();
  t.ok(true);
});

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
  s.start();
  // await new Promise(resolve => setTimeout(resolve, 1000));
  await c.rpc.p.make('service/testFunction');
  t.ok(signal === 2);
});

test('Restart new deepstream', async () => {
  dss.stop();
  dss2.start();
});

test('Close clients', async t => {
  s.close();
  c.close();
  t.ok(true);
});

test('Shutdown deepstream final', async () => {
  dss2.stop();
});
