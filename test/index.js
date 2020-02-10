import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { test } from 'tap';
import joi from '@hapi/joi';
// import * as R from 'ramda';
// import { Deepstream } from '@deepstream/server';
// import { DeepstreamClient } from "@deepstream/client";
import { createAuthServer } from 'i4-js-commons/dist/testing/authMock';
import {
  getStartedDeepstreamServer,
  stopDeepstreamServer,
  getLoggedInTestClient,
} from 'i4-js-commons/dist/testing/utils';
import { wait, asyncWithTimeout, triggerPromise } from 'i4-js-commons/dist/ctrl-utils';
import { createService } from '../src/index';

const rpcTestArgs = { arg1: 'val1', arg2: 2 };
const rpcTestFuncSpec = {
  description: 'My rpc function',
  args: joi.object().keys({
    arg1: joi.string(),
    arg2: joi.number().positive(),
  }),
  return: undefined,
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

  const serviceName = 'testService';
  const service = createService({
    name: serviceName,
    address: 'localhost:6020',
    credentialsUrl: 'http://localhost:8000/getAuthToken',
    credentials: { id: serviceName },
    runForever: false,
    options: { reconnectIntervalIncrement: 10 },
  });
  service.registerApi({ testFunction: rpcTestFuncSpec }, { testFunction: data => data.arg2 + 1 });
  service.start();

  let [serviceConnectedPromise, serviceConnected] = triggerPromise();
  service.client.on('connectionStateChanged', cState => {
    console.log('Service client connection state changed:', cState);
    if (cState === 'OPEN') serviceConnected();
  });

  const [serverPromise, dss] = getStartedDeepstreamServer('withAuth');
  await serverPromise;
  await asyncWithTimeout(serviceConnectedPromise);
  await wait(500); // Wait an extra moment for the service to provide its API

  const testClient = await getLoggedInTestClient({ doLog: true });

  const rpcReply = await testClient.rpc.make(`${serviceName}/testFunction`, rpcTestArgs);
  t.equal(rpcReply, 3, 'Simple RPC reply');

  const apiReply = await testClient.rpc.make(`${serviceName}/getInterface`);
  t.same(Object.keys(apiReply), Object.keys(service.state.apiSpec), 'getInterface vs apiSpec');
  t.same(Object.keys(apiReply), Object.keys(service.state.apiImpl), 'getInterface vs apiImpl');

  // await wait(200);
  await stopDeepstreamServer(dss);
  await wait(100);

  [serviceConnectedPromise, serviceConnected] = triggerPromise();
  const [serverPromise2, dss2] = getStartedDeepstreamServer();
  await serverPromise2;
  await asyncWithTimeout(serviceConnectedPromise);
  await wait(500); // Wait an extra moment for the service to provide its API

  const apiReplyAfter = await testClient.rpc.make(`${serviceName}/testFunction`, rpcTestArgs);
  t.equal(apiReplyAfter, 3, 'Simple RPC reply after server restart');

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
  function doSomething(/* { name, properties } */) {
    // DB call or whatever
    return 5;
  }
  const implementation = {
    doSomething,
  };

  // Create service, register API (spec & implementation) and start the service.
  const service = createService({
    name,
    address,
    runForever: true,
    credentials,
    credentialsUrl: 'http://localhost:8000/getAuthToken',
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
  await wait(500); // Wait an extra moment for the service to provide its API

  const testClient = await getLoggedInTestClient({ doLog: true });

  t.equals(
    await testClient.rpc.make(`${name}/doSomething`, {
      name: 'foo4',
      properties: { birth: new Date() },
    }),
    5,
  );
  await t.rejects(testClient.rpc.make(`${name}/doSomething`, rpcTestArgs), '"arg1" is not allowed');
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
