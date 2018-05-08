# ds-node-service

Base module for Deepstream RPC based Node services

**Let's start with a comprehensive example:**

```js
import { createRpcService, typeAssert } from 'ds-node-service';

const serviceName = 'service1';
const address = 'localhost:6020';
const credentials = { password: 'secretPassword' };

function doSomething({ name, properties }) {
  // DB call or whatever
}

async function main() {
  const service = createRpcService({
    serviceName,
    address,
    runForever: true,
    credentials,
  });

  service.registerApi({
    doSomething: {
      method: ({ name, properties }) => {
        typeAssert('String', name);
        typeAssert('{...}', properties);
        return doSomething({ name, properties });
      },
      argDoc: [['name', 'String'], ['properties', '{...}']],
    },
  });

  await service.start();
}
if (require.main === module) main();
```

The base RPC service will on `start()`:

* Fetch credentials if a `credentialsUrl` was provided, otherwise use `credentials`.
* Log in to deepstream with `authParams` = `{ id: serviceName, ...credentials }`
* Provide (`rpc.provide(..)`) the RPC functions registered with `registerApi`.
* Start an idle loop if `runForever` is `true`.

The API registration and service start **will automatically add** a `getInterface` function that will return an API specification with all methods with argument names & types (given through the `argDoc` key). Example (from requesting client): `client.rpc.make('service1/getInterface')`.

Some more explanatory comments on the example above:

* The type assertion system is [`type-check`](https://www.npmjs.com/package/type-check).
* You can easily fetch [Deepstream](http://deepstream.io) (for instance as an npm package) and start it locally on its default port 6020, thus `localhost:6020` as address.
