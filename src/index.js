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
  const reply = await fetch(url);
  if (reply.status !== 201) throw new Error('Could not request credentials');
  return reply.json();
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
    console.log('RPC ERROR:', err);
    response.error(err.message);
  }
}

export default class BaseService {
  constructor({
    serviceName = 'service',
    address,
    options,
    splitChar = rpcSplitChar,
    runForever = true,
    credentials = {},
    credentialsUrl,
  }) {
    // TODO: Merge credentials in start, add arguments for defaultCredentials and
    // overrideCredentials (Don't set id to serviceName)
    this.c = getClient(address, { ...defaultOptions, ...options });
    this.c.on('error', e => console.log('GLOBAL ERROR:', e));
    this.serviceName = serviceName;
    this.splitChar = splitChar;
    this.runForever = runForever;
    this.credentials = credentials;
    this.credentialsUrl = credentialsUrl;
    process.on('SIGTERM', () => this.close());
  }
  api = {};

  registerApi(api = {}) {
    this.api = api;
    this.api.getInterface = {
      method: this.getInterface,
      argDoc: [],
    };
  }

  rpcPath(name) {
    return `${this.serviceName}${this.splitChar}${name}`;
  }

  getInterface = () => mapValues(this.api, v => v.argDoc);

  provideInterface() {
    Object.keys(this.api).forEach(f =>
      this.c.rpc.provide(this.rpcPath(f), onRpc.bind(this.api[f])));
  }

  async start() {
    // console.log('BaseService.start... runForever:', this.runForever);
    if (this.credentialsUrl) {
      this.credentials = await fetchCredentials(this.credentialsUrl);
      this.credentials.id = this.serviceName;
    }
    this.c.login(this.credentials);
    this.provideInterface();
    if (this.runForever) idleLoop();
  }

  async close() {
    if (loopTimer) clearTimeout(loopTimer);
    Object.keys(this.api).forEach(f => this.c.rpc.unprovide(this.rpcPath(f))); // unnecessary?
    await this.c.close();
  }
}

// let service;
// if (require.main === module) {
//   service = new Service('deepstream:6020');
//   service.start();
// }
