// import 'babel-polyfill';
import getClient from 'extended-ds-client';
import mapValues from 'lodash.mapvalues';

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
  }) {
    this.c = getClient(address, { ...defaultOptions, ...options });
    this.c.on('error', e => console.log('GLOBAL ERROR:', e));
    this.serviceName = serviceName;
    this.splitChar = splitChar;
    this.runForever = runForever;
    process.on('SIGTERM', () => this.close());
  }
  api;
  loopTimer;

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
        this.c.rpc.provide(this.rpcPath(f), this.onRpc.bind(this, f)),
      );
    }
  }

  idleLoop = () => {
    this.loopTimer = setTimeout(this.idleLoop, 100000);
  };

  start() {
    // console.log('BaseService.start... runForever:', this.runForever);
    this.c.p.login({});
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
