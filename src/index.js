// import 'babel-polyfill';
import { typeCheck } from 'type-check';
import getClient from 'extended-ds-client';
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
  heartbeatInterval: 60000,
};

async function fetchCredentials(url) {
  let reply;
  try {
    reply = await fetch(url);
    if (reply.status === 201) {
      return reply.json();
    }
  } catch (err) {
    console.log('Will retry credentials fetch due to:', err);
  }
  return new Promise(r => setTimeout(r, 1000)).then(fetchCredentials.bind(this, url));
}

let loopTimer;
const idleLoop = () => {
  loopTimer = setTimeout(idleLoop, 100000);
};

async function onRpc(data = {}, response) {
  try {
    const { id } = response._connection._authParams;
    const result = await this.method(data, id);
    response.send(result);
  } catch (err) {
    // console.log('RPC ERROR:', err);
    response.error(err.message);
  }
}
function provideInterface(client, pathFunc, api) {
  Object.keys(api).forEach(f => client.rpc.provide(pathFunc(f), onRpc.bind(api[f])));
}

function registerApi(api = {}) {
  this.api = api;
  this.api.getInterface = {
    method: () => mapValues(this.api, v => v.argDoc),
    argDoc: [],
  };
}

function rpcPath(name) {
  return `${this.serviceName}${this.splitChar}${name}`;
}

async function start() {
  if (this.credentialsUrl) {
    this.credentials = await fetchCredentials(this.credentialsUrl);
    this.credentials.id = this.serviceName;
  }
  this.client.login(this.credentials);
  provideInterface(this.client, this.rpcPath, this.api);
  if (this.runForever) idleLoop();
}

async function close() {
  if (loopTimer) clearTimeout(loopTimer);
  Object.keys(this.api).forEach(f => this.client.rpc.unprovide(this.rpcPath(f))); // unnecessary?
  await this.client.close();
}

export function createRpcService({
  serviceName = 'service',
  address,
  options = {},
  splitChar = rpcSplitChar,
  runForever = true,
  credentials = {},
  credentialsUrl,
}) {
  const obj = {
    serviceName,
    splitChar,
    runForever,
    credentials,
    credentialsUrl,
  };
  obj.client = getClient(address, { ...defaultOptions, ...options });
  obj.client.on('error', e => console.log('GLOBAL ERROR:', e));
  obj.api = {};
  obj.registerApi = registerApi.bind(obj);
  obj.rpcPath = rpcPath.bind(obj);
  obj.start = start.bind(obj);
  obj.close = close.bind(obj);
  process.on('SIGTERM', () => this.close());

  // return Object.assign(Object.create({ constructor: createRpcService }), obj);
  return obj;
}
createRpcService.of = createRpcService;

// const Service = createRpcService;
// Service.prototype = {};
// export default Service;

function Service(args) {
  const obj = createRpcService(args);
  Object.getOwnPropertyNames(obj).forEach(k => {
    this[k] = typeof obj[k] === 'function' ? obj[k].bind(this) : obj[k];
  });
}
export default Service;
// this[k] = obj[k];
// Service.prototype.start = start;
// Service.prototype.close = close;

// function _Service(args) {
//   // this = createRpcService(args);
//   this.prototype = createRpcService.bind(this)(args);
// }
// const Service = _Service.bind(createRpcService({ address: '' }));
// Service.prototype = null;

// let service;
// if (require.main === module) {
//   service = createRpcService('deepstream:6020');
//   service.start();
// }
