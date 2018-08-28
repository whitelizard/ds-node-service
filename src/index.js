import 'idempotent-babel-polyfill';
import { typeCheck } from 'type-check';
import getClient from 'extended-ds-client';
import joi from 'joi';
import mapValues from 'lodash.mapvalues';
import fetch from 'node-fetch';

export const rpcSplitChar = '/';

export function typeAssert(type, variable, code) {
  if (!typeCheck(type, variable)) {
    throw new TypeError(`${code ? `[${code}] ` : ''}${JSON.stringify(variable)} not of type ${type}`);
  }
}

const defaultOptions = {
  // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectInterval: 8000,
  maxReconnectAttempts: Infinity,
};

async function fetchCredentials(url) {
  if (this.closing) return undefined;
  let reply;
  try {
    reply = await fetch(url);
    if (reply.status === 201) {
      return reply.json();
    }
  } catch (err) {
    console.log('Will retry credentials fetch due to:', err);
  }
  return new Promise(r => setTimeout(r, 1000)).then(this.fetchCredentials.bind(this, url));
}

async function updateCredentials() {
  if (this.credentialsUrl) {
    this.credentials = await this.fetchCredentials(this.credentialsUrl);
    this.credentials.id = this.serviceName;
    this.client._connection._authParams = this.credentials;
  }
}

function connectionStateChangedCallback(state) {
  if (state === 'RECONNECTING' && this.credentialsUrl && !this.closing) {
    console.log('Re-fetching credentials...');
    this.updateCredentials();
  }
}

let loopTimer;
const idleLoop = () => {
  loopTimer = setTimeout(idleLoop, 100000);
};

async function onRpc(data = {}, response) {
  try {
    const result = await this.method(data);
    response.send(result);
  } catch (err) {
    // console.log('RPC ERROR:', err);
    response.error(err.message);
  }
}
function provideInterface(client, pathFunc, api) {
  Object.keys(api).forEach(f => client.rpc.provide(pathFunc(f), onRpc.bind(api[f])));
}

const createOnRpc = (spec, impl) => async (data = {}, response) => {
  try {
    const args = joi.validate(data, spec);
    if (args.error) {
      response.error(args.error.details[0].message);
    } else {
      const result = await impl(args);
      response.send(result);
    }
  } catch (err) {
    // console.log('RPC ERROR:', err);
    response.error(err.message);
  }
};
function loadApi(client, pathFunc, apiSpec, apiImpl) {
  Object.keys(apiSpec).forEach(f =>
    client.rpc.provide(pathFunc(f), createOnRpc(apiSpec[f], apiImpl[f])));
}

function registerApi(apiSpec = {}, apiImpl) {
  // api: { name: spec }, impl: { name: func }
  if (apiImpl) {
    // New api with verifiable spec objects, and separate implemented functions
    this.apiSpec = apiSpec;
    this.apiImpl = apiImpl;
    this.apiSpec.getInterface = joi.any();
    this.apiImpl.getInterface = () => mapValues(this.apiSpec, v => v.describe());
  } else {
    this.api = apiSpec;
    this.api.getInterface = {
      method: () => mapValues(this.api, v => v.argDoc),
      argDoc: [],
    };
  }
}

function rpcPath(name) {
  return `${this.serviceName}${this.splitChar}${name}`;
}

async function start() {
  this.closing = false;
  this.client.on('connectionStateChanged', connectionStateChangedCallback.bind(this));
  await this.updateCredentials();
  await this.client.login(this.credentials, this.authCallback);
  if (this.apiImpl) {
    loadApi(this.client, this.rpcPath.bind(this), this.apiSpec, this.apiImpl);
  } else {
    provideInterface(this.client, this.rpcPath.bind(this), this.api);
  }
  if (this.runForever) idleLoop();
}

function close() {
  this.closing = true;
  if (loopTimer) clearTimeout(loopTimer);
  return this.client.close();
}

function getApi() {
  return this.api;
}

export function createRpcService({
  serviceName = 'service',
  address,
  options = {},
  splitChar = rpcSplitChar,
  runForever = true,
  credentials = {},
  credentialsUrl,
  clientErrorCallback = Function.prototype,
}) {
  const obj = {
    serviceName,
    splitChar,
    runForever,
    credentials,
    credentialsUrl,
  };
  obj.api = {};
  obj.client = getClient(address, { ...defaultOptions, ...options });
  obj.client.on('error', clientErrorCallback);
  // if (clientErrorCallback) obj.client.on('error', clientErrorCallback);
  obj.close = close.bind(obj);
  obj.fetchCredentials = fetchCredentials.bind(obj);
  obj.getApi = getApi.bind(obj);
  obj.registerApi = registerApi.bind(obj);
  obj.rpcPath = rpcPath.bind(obj);
  obj.start = start.bind(obj);
  obj.updateCredentials = updateCredentials.bind(obj);
  process.on('SIGTERM', () => obj.close());
  return Object.assign(Object.create({ constructor: createRpcService }), obj);
  // return obj;
}
createRpcService.of = createRpcService;

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
Service.prototype.close = close;
Service.prototype.fetchCredentials = fetchCredentials;
Service.prototype.getApi = getApi;
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
