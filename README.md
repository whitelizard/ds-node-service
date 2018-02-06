# ds-node-service

Base module for Deepstream RPC based Node services

**Let's start with a comprehensive example:**

```js
import { createRpcService, typeAssert } from 'ds-node-service';

const serviceName = 'conf-v1';
const defaultCredentialsUrl = 'http://auth:8009/getAuthToken';

function createService(address, runForever, credentialsUrl) {
  const obj = createRpcService({ serviceName, address, runForever, credentialsUrl });

  obj.items = dataset(); // Attach whatever needed in any suitable way

  obj.registerApi({
    createItem: {
      method: ({ id, properties }) => {
        typeAssert('String', name);
        typeAssert('{...}', properties);
        const res = obj.items.create({ id, properties });
        return res;
      },
      argDoc: [['id', 'String'], ['properties', '{...}']],
    },
  });

  return obj;
}

async function main() {
  service = createService('deepstream:6020', true, defaultCredentialsUrl);
  await service.start();
}
if (require.main === module) main();
```

The base RPC service will on `start()`:

* Fetch credentials, if a URL for that was provided.
* Log in to deepstream with `authParams` = `{ id: serviceName, ...<return from fetch> }`
* Provide the RPC functions registered with `registerApi`.
* Start an idle loop if `runForever` is `true`.

The API registration and service start **will automatically add** a `getInterface` function that will return an API specification with all methods with argument names & types (given through the `argDoc` key).
