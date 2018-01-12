import test from 'blue-tape';
import DeepstreamServer from 'deepstream.io';
import getClient from 'extended-ds-client';
import BaseService from '../src/index';

// const rpcSplitChar = '/';
// const serviceName = 'notification-v1';
const dss = new DeepstreamServer();
const dss2 = new DeepstreamServer();
let c;
let s;
const options = {
  // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectInterval: 8000,
  maxReconnectAttempts: Infinity,
  heartbeatInterval: 60000,
};

test('Start service without deepstream.', async () => {
  s = new BaseService('localhost:6020');
  s.registerApi({
    testFunction: () => {},
    method: [],
  });
  s.start();
});

test('Start deepstream server', async () => {
  dss.start();
  return new Promise(resolve => setTimeout(resolve, 500));
});

test('Close client', async t => {
  s.close();
  t.ok(true);
});

test('Create & start service again with api registration', async () => {
  s = new BaseService('localhost:6020');
  s.registerApi({
    testFunction: () => {},
    method: [],
  });
  s.start();
  return new Promise(resolve => setTimeout(resolve, 1000));
});

test('Create Test-client', async () => {
  c = getClient('localhost:6020', options);
  c.on('error', e => console.log('Test-client Error:', e));
});

test('Shutdown deepstream', async () => {
  dss.stop();
  return new Promise(resolve => setTimeout(resolve, 500));
});

test('Restart new deepstream', async () => {
  dss2.start();
  return new Promise(resolve => setTimeout(resolve, 1000));
});

test('Close clients', async t => {
  s.close();
  c.close();
  t.ok(true);
});

test('Shutdown deepstream final', async () => {
  dss2.stop();
});
