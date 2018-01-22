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
    this.c = getClient(address, { ...defaultOptions, ...options });
    this.c.on('error', e => console.log('GLOBAL ERROR:', e));
    this.serviceName = serviceName;
    this.splitChar = splitChar;
    this.runForever = runForever;
    this.credentials = credentials;
    this.credentialUrl = credentialsUrl;
    process.on('SIGTERM', () => this.close());
  }
  api;
  loopTimer;

  async fetchCredentials() {
    const reply = await fetch(this.credentialUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (reply.status !== 201) throw Error('Could not request credentials');
    return reply.json();
  }

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

  async onRpc(funcName, data = {}, response) {
    try {
      const result = await this.api[funcName].method(data);
      response.send(result);
    } catch (err) {
      console.log('RPC ERROR:', err);
      response.error(err.message);
    }
  }

  provideInterface() {
    if (this.api) {
      Object.keys(this.api).forEach(f =>
        this.c.rpc.provide(this.rpcPath(f), this.onRpc.bind(this, f)));
    }
  }

  idleLoop = () => {
    this.loopTimer = setTimeout(this.idleLoop, 100000);
  };

  async start() {
    // console.log('BaseService.start... runForever:', this.runForever);
    if (this.credentialUrl) this.credentials = await this.fetchCredentials();
    this.c.p.login(this.credentials);
    this.provideInterface();
    if (this.runForever) this.idleLoop();
  }

  close() {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    Object.keys(this.api).forEach(f => this.c.rpc.unprovide(this.rpcPath(f))); // unnecessary?
    this.c.close();
  }
}

// let service;
// if (require.main === module) {
//   service = new Service('deepstream:6020');
//   service.start();
// }
