// import 'babel-polyfill';
import getClient from 'extended-ds-client';
import mapValues from 'lodash.mapvalues';
import fetch from 'node-fetch';

export const rpcSplitChar = '/';

const defaultOptions = {
  // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
  reconnectIntervalIncrement: 1000,
  maxReconnectInterval: 8000,
  maxReconnectAttempts: Infinity,
  heartbeatInterval: 60000,
};

async function fetchCredentials(url) {
  const reply = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (reply.status !== 201) throw Error('Could not request credentials');
  return reply.json();
}

async function onRpc(data = {}, response) {
  try {
    const result = await this.f(data);
    response.send(result);
  } catch (err) {
    console.log('RPC ERROR:', err);
    response.error(err.message);
  }
}
function provideInterface(client, pathFunc, api) {
  Object.keys(api).forEach(f => client.rpc.provide(pathFunc(f), onRpc.bind({ f: api[f].method })));
}

let loopTimer;
function idleLoop() {
  loopTimer = setTimeout(idleLoop, 100000);
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
  if (this.credentialsUrl) this.credentials = await fetchCredentials(this.credentialsUrl);
  this.c.p.login(this.credentials);
  provideInterface(this.c, this.rpcPath, this.api);
  if (this.runForever) idleLoop();
}

function close() {
  if (loopTimer) clearTimeout(loopTimer);
  Object.keys(this.api).forEach(f => this.c.rpc.unprovide(this.rpcPath(f))); // unnecessary?
  this.c.close();
}

export const createRpcService = ({
  serviceName = 'service',
  address,
  options,
  splitChar = rpcSplitChar,
  runForever = true,
  credentials = {},
  credentialsUrl,
}) => {
  const obj = {
    serviceName,
    splitChar,
    runForever,
    credentials,
    credentialsUrl,
    c: getClient(address, { ...defaultOptions, ...options }),
  };
  obj.c.on('error', e => console.log('GLOBAL ERROR:', e));

  obj.registerApi = registerApi.bind(obj);
  obj.rpcPath = rpcPath.bind(obj);
  obj.start = start.bind(obj);
  obj.close = close.bind(obj);

  return Object.assign(Object.create({ constructor: createRpcService }), obj);
};
createRpcService.of = createRpcService;
