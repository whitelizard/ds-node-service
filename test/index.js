import { test } from 'tap';
import joi from 'joi';
import * as R from 'ramda';
import { Deepstream } from '@deepstream/server';
import { DeepstreamClient } from '@deepstream/client';
import { createRpcService } from '../src/index';
import { createAuthServer } from './authMock';

const wait = delay => new Promise(r => setTimeout(r, delay));

const asyncWithTimeout = (promise, timeout = 3000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('asyncWithTimeout: Timeout')), timeout)),
  ]);

const triggerPromise = () => {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return [promise, resolve];
};

const pollUntil = R.curry(async (compareFn, fn, interval = 10) => {
  const [promise, resolve] = triggerPromise();
  const inner = async () => {
    const result = await fn();
    if (compareFn(result) === true) resolve(result);
    else setTimeout(inner, interval);
  };
  inner();
  return promise;
});

const rpcTestArgs = { arg1: 'val1', arg2: 2 };
const rpcTestFuncSpec = {
  description: 'My rpc function',
  args: joi.object().keys({
    arg1: joi.string(),
    arg2: joi.number().positive(),
  }),
  return: undefined,
};

const getStartedDeepstreamServer = () => {
  // const dss = new Deepstream();
  const dss = new Deepstream('./test/testDsConfig.yml');
  const [serverStartPromise, serverStartResolve] = triggerPromise();
  dss.on('started', serverStartResolve);
  dss.start();
  return [asyncWithTimeout(serverStartPromise), dss];
};

const stopDeepstreamServer = server => {
  const [serverStopPromise, serverStopResolve] = triggerPromise();
  server.on('stopped', serverStopResolve);
  server.stop();
  return asyncWithTimeout(serverStopPromise);
};

// test('Deepstream server', async t => {
//   const [serverPromise, dss] = getStartedDeepstreamServer();
//   await serverPromise;
//   await wait(200);
//   await stopDeepstreamServer(dss);
//   new Promise(() => setTimeout(process.exit, 0)); // eslint-disable-line no-new
//   t.end();
// });

test('Start service, Deepstream server, and try simple RPC.', async t => {
  const authServer = createAuthServer().start();
  let signal = 0;

  const serviceName = 'testService';
  const service = createRpcService({
    name: serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:3000/getAuthToken',
    credentials: { id: serviceName },
    runForever: false,
  });
  service.registerApi(
    { testFunction: rpcTestFuncSpec },
    {
      testFunction: data => {
        signal += 1;
        t.same(data, rpcTestArgs);
      },
    },
  );
  service.start();

  const [serviceConnectedPromise, serviceConnected] = triggerPromise();
  service.client.on('connectionStateChanged', cState => {
    console.log('Service client connection state changed:', cState);
    if (cState === 'OPEN') serviceConnected();
  });

  const [serverPromise, dss] = getStartedDeepstreamServer();
  await serverPromise;
  await asyncWithTimeout(serviceConnectedPromise);
  await wait(200); // Wait an extra moment for the service to provide its API

  const options = { reconnectIntervalIncrement: 500, maxReconnectAttempts: 5 };
  const testClient = new DeepstreamClient('localhost:6020', options);
  testClient.on('error', e => console.log('Test-client Error:', e.message));
  testClient.on('connectionStateChanged', cState =>
    console.log('testClient connection state changed:', cState));
  await testClient.login({ id: 'testClient' });

  await testClient.rpc.make(`${serviceName}/testFunction`, rpcTestArgs);
  t.equal(signal, 1);

  const reply = await testClient.rpc.make(`${serviceName}/getInterface`);
  t.same(Object.keys(reply), Object.keys(service.state.apiSpec));
  t.same(Object.keys(reply), Object.keys(service.state.apiImpl));

  await wait(2000);
  await stopDeepstreamServer(dss);
  await wait(500);

  const [serverPromise2, dss2] = getStartedDeepstreamServer();
  await serverPromise2;
  await asyncWithTimeout(serviceConnectedPromise);
  await wait(1000); // Wait an extra moment for the service to provide its API

  await testClient.rpc.make(`${serviceName}/testFunction`, rpcTestArgs);
  t.equal(signal, 2);

  await stopDeepstreamServer(dss2);
  service.close();
  testClient.close();
  authServer.stop();
  t.end();
});

test('Test the README example', async t => {
  const authServer = createAuthServer().start();

  // ________________________________________________________
  // CODE FROM README (with some minor tweeks)

  const name = 'testService';
  const address = 'localhost:6020';
  const credentials = { id: name, password: 'secretPassword' };

  // The API schema should actually rather be placed in a separate file.
  const apiSchema = {
    doSomething: {
      description: 'Description for api-function that does something.',
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
      return: joi.number(), // joi-schema for return value or null if no return value
    },
  };

  // The implementation part would also rather have its own file.
  function doSomething({ name, properties }) {
    // DB call or whatever
    return 5;
  }
  const implementation = {
    doSomething,
  };

  // Create service, register API (spec & implementation) and start the service.
  const service = createRpcService({
    name,
    address,
    runForever: true,
    credentials,
    credentialsUrl: 'http://localhost:3000/getAuthToken',
  });

  service.registerApi(apiSchema, implementation);

  service.start();

  // ________________________________________________________

  const [serviceConnectedPromise, serviceConnected] = triggerPromise();
  service.client.on('connectionStateChanged', cState => {
    console.log('Service client connection state changed:', cState);
    if (cState === 'OPEN') serviceConnected();
  });

  const [serverStartedPromise, dss] = getStartedDeepstreamServer();
  await serverStartedPromise;
  await asyncWithTimeout(serviceConnectedPromise);
  await wait(200); // Wait an extra moment for the service to provide its API

  const options = { reconnectIntervalIncrement: 500, maxReconnectAttempts: 5 };
  const testClient = new DeepstreamClient('localhost:6020', options);
  testClient.on('error', e => console.log('Test-client Error:', e.message));
  // testClient.on('connectionStateChanged', cState =>
  //   console.log('testClient connection state changed:', cState));
  await testClient.login({ id: 'testClient' });

  t.equals(
    await testClient.rpc.make(`${name}/doSomething`, {
      name: 'foo4',
      properties: { birth: new Date() },
    }),
    5,
  );
  await t.rejects(testClient.rpc.make(`${name}/doSomething`, rpcTestArgs), '"arg1" is not allowed');
  console.log('WE GOT HERE');
  await t.rejects(
    testClient.rpc.make(`${name}/doSomething`, {
      name: '  !  ',
      properties: { birth: new Date() },
    }),
    '"name" must only contain alpha-numeric characters',
  );

  await stopDeepstreamServer(dss);
  service.close();
  testClient.close();
  authServer.stop();
  t.end();
});

test('Special extra clean-up due to Deepstream server not releasing context', async t => {
  new Promise(() => setTimeout(process.exit, 0)); // eslint-disable-line no-new
  t.end();
});
