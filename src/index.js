import 'core-js/stable';
import 'regenerator-runtime/runtime';
// import { typeCheck } from 'type-check';
import { DeepstreamClient } from '@deepstream/client';
import joi from '@hapi/joi';
import mapValues from 'lodash.mapvalues';
import fetch from 'node-fetch';

export const rpcSplitChar = '/';

const defaultOptions = {
  // Reconnection procedure: R 1s R 2s R 3s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectAttempts: Infinity,
};

async function fetchCredentials(url) {
  if (this.state.closing) return undefined;
  try {
    const reply = await fetch(url);
    // const unpacked = await reply.json();
    // console.log('Credential fetch status:', reply.status);
    if (reply.status === 201) {
      return reply.json();
    }
  } catch (err) {
    console.log('Will retry credentials fetch due to:', err);
  }
  return new Promise(r => setTimeout(r, 1000)).then(fetchCredentials.bind(this, url));
}

async function updateCredentials() {
  if (this.config.credentialsUrl) {
    this.state.credentials = {
      ...this.state.credentials,
      ...(await this.fetchCredentials(this.config.credentialsUrl)),
    };
    console.log('Service.updateCredentials:', this.state.credentials);
    this.client.services.connection.authParams = this.state.credentials;
  }
}

function connectionStateChangedCallback(state) {
  if (state === 'RECONNECTING' && this.config.credentialsUrl && !this.state.closing) {
    console.log('Re-fetching credentials...');
    this.updateCredentials();
  }
}

let loopTimer;
const idleLoop = () => {
  loopTimer = setTimeout(idleLoop, 100000);
};

const createOnRpc = (spec, impl) => async (data = {}, response) => {
  console.log('Incomming RPC to Service, args:', data);
  try {
    const args = spec.validate(data);
    if (args.error) {
      response.error(args.error.details[0].message);
    } else {
      const result = await impl(args.value);
      response.send(result);
    }
  } catch (err) {
    console.log('RPC ERROR:', err);
    response.error(err.message);
  }
};
function loadApi(client, pathFunc, apiSpec, apiImpl) {
  Object.keys(apiSpec).forEach(f => {
    // console.log('Service.loadApi:', pathFunc(f));
    client.rpc.provide(
      pathFunc(f),
      createOnRpc(apiSpec[f].args.keys({ _id: joi.string() }), apiImpl[f]),
    );
  });
}

function getInterface() {
  return this.state.apiDesc;
}

function registerApi(apiSpec = {}, apiImpl = {}) {
  // api: { name: spec }, impl: { name: func }
  const getInterfaceDescription = {
    description: 'Returns the interface of the service.',
    args: joi.object(),
    return: joi
      .object()
      .unknown()
      .pattern(
        joi.any(),
        joi.object().keys({
          description: joi.string(),
          args: joi.object(),
          return: joi.object(),
        }),
      ),
  };
  apiSpec = { ...apiSpec, getInterface: getInterfaceDescription };
  apiImpl = { ...apiImpl, getInterface: this.getInterface };
  const apiDesc = mapValues(apiSpec, v => ({
    description: v.description,
    args: v.args && v.args.describe(),
    return: v.return && v.return.describe(),
  }));
  this.setState({ apiSpec, apiImpl, apiDesc });
}

function rpcPath(name) {
  return `${this.name}${this.config.splitChar}${name}`;
}

async function start() {
  this.state.closing = false;
  this.client.on('connectionStateChanged', connectionStateChangedCallback.bind(this));
  await this.updateCredentials();
  // console.log('Credentials updated. Will try to login.');
  await this.client.login(this.state.credentials);
  loadApi(this.client, this.rpcPath.bind(this), this.state.apiSpec, this.state.apiImpl);
  // provideInterface(this.client, this.rpcPath.bind(this), this.api);
  if (this.config.runForever) idleLoop();
  // console.log('start:', this.state.apiSpec, this.state.apiImpl);
}

function close() {
  this.state.closing = true;
  if (loopTimer) clearTimeout(loopTimer);
  return this.client.close();
}

export function createRpcService({
  name = 'service',
  address,
  options = {},
  splitChar = rpcSplitChar,
  runForever = true,
  credentials = {},
  credentialsUrl,
  clientErrorCallback = Function.prototype,
}) {
  const service = Object.assign(Object.create({ constructor: createRpcService }), {
    name,
    state: {
      closing: false,
      apiSpec: {},
      apiImpl: {},
      credentials,
    },
    config: {
      runForever,
      splitChar,
      credentialsUrl,
    },
    client: new DeepstreamClient(address, { ...defaultOptions, ...options }),
  });
  service.client.on('error', clientErrorCallback);
  service.setState = updates => {
    service.state = { ...service.state, ...updates };
  };

  service.close = close.bind(service);
  service.fetchCredentials = fetchCredentials.bind(service);
  service.getInterface = getInterface.bind(service);
  service.registerApi = registerApi.bind(service);
  service.rpcPath = rpcPath.bind(service);
  service.start = start.bind(service);
  service.updateCredentials = updateCredentials.bind(service);
  process.on('SIGTERM', service.close);
  return service;
}
createRpcService.of = createRpcService;

// // Another pattern. For future? Better? Using closure instead of bind(this). Class not possible
// //
// const obj = Object.assign(Object.create({ constructor: createRpcService }), {
//   name,
//   state: {
//     closing: false,
//     apiSpec: {},
//     apiImpl: {},
//     credentials,
//   },
//   client: getClient(address, { ...defaultOptions, ...options }),
// });
// obj.client.on('error', clientErrorCallback);
// obj.setState = updates => {
//   obj.state = { ...obj.state, ...updates };
// };
// obj.close = () => {
//   obj.state.closing = true;
//   if (loopTimer) clearTimeout(loopTimer);
//   return obj.client.close();
// };
//
// obj.fetchCredentials = async (url) => {
//   if (obj.state.closing) return undefined;
//   try {
//     const reply = await fetch(url);
//     if (reply.status === 201) {
//       return reply.json();
//     }
//   } catch (err) {
//     console.log('Will retry credentials fetch due to:', err);
//   }
//   return new Promise(r => setTimeout(r, 1000)).then(() => obj.fetchCredentials(url));
// };
// obj.rpcPath = id => `${obj.name}${obj.splitChar}${id}`;
//
// obj.registerApi = (apiSpec = {}, apiImpl) => obj.setState({
//   apiSpec: { ...apiSpec, getInterface: joi.any() },
//   apiImpl: { ...apiImpl, getInterface: () => mapValues(apiSpec, v => v.describe()) },
// });
//
// obj.updateCredentials = async () => {
//   if (credentialsUrl) {
//     this.credentials = await this.fetchCredentials(credentialsUrl);
//     this.credentials.id = this.serviceName;
//     this.client._connection._authParams = this.credentials;
//   }
// }
//
// function connectionStateChangedCallback(state) {
//   if (state === 'RECONNECTING' && credentialsUrl && !obj.state.closing) {
//     console.log('Re-fetching credentials...');
//     this.updateCredentials();
//   }
// }
//
// obj.start = async () => {
//   obj.state.closing = false;
//   obj.client.on('connectionStateChanged', connectionStateChangedCallback.bind(this));
//   await this.updateCredentials();
//   await this.client.login(this.credentials, this.authCallback);
//   if (this.apiImpl) {
//     loadApi(this.client, this.rpcPath.bind(this), this.apiSpec, this.apiImpl);
//   } else {
//     provideInterface(this.client, this.rpcPath.bind(this), this.api);
//   }
//   if (this.runForever) idleLoop();
// };

// ================================================================================
//  Class simulation for backward compatibility and cases where inheritance fit

function Service(args) {
  const obj = createRpcService(args);
  Object.getOwnPropertyNames(obj).forEach(k => {
    if (typeof obj[k] !== 'function') {
      this[k] = obj[k];
    }
  });
}
Service.prototype.setState = function setState(updates) {
  this.state = { ...this.state, ...updates };
};
Service.prototype.close = close;
Service.prototype.fetchCredentials = fetchCredentials;
Service.prototype.getInterface = getInterface;
Service.prototype.updateCredentials = updateCredentials;
Service.prototype.start = start;
Service.prototype.rpcPath = rpcPath;
Service.prototype.registerApi = registerApi;
export default Service;

// let service;
// if (require.main === module) {
//   service = createRpcService('deepstream:6020');
//   service.start();
// }
