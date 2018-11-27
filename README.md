# ds-node-service

Base module for Deepstream RPC based Node services

**Let's start with a comprehensive example:**

```js
import { createRpcService } from 'ds-node-service';
import joi from 'joi';

const name = 'service1';
const address = 'localhost:6020';
const credentials = { id: 'serviceId', password: 'secretPassword' };

// The API schema should actually rather be placed in a separate file.
const apiSchema = {
  doSomething: {
    description: 'Description for api-function that does something.'
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
    return: joi.number() // joi-schema for return value or null if no return value
  }
};

// The implementation part would also rather have its own file.
function doSomething({ name, properties }) {
  // DB call or whatever
}
const implementation = {
  doSomething,
};

// Create service, register API (spec & implementation) and start the service.
async function main() {
  const service = createRpcService({
    name,
    address,
    runForever: true,
    credentials,
  });

  service.registerApi(apiSchema, implementation);

  await service.start();
}
if (require.main === module) main();
```

The base RPC service will on `start()`:

- Fetch credentials, if a `credentialsUrl` was provided, and merge the result with the directly specified `credentials` object.
- Log in to deepstream with `authParams` = `credentials`
- Provide (`rpc.provide(..)`) the RPC functions registered with `registerApi`.
- Start an idle loop if `runForever` is `true`.

The API registration and service start **will automatically add** a `getInterface` function that will return an API specification with all methods with argument names & types. Example (from requesting client): `client.rpc.make('service1/getInterface')`.

Some more explanatory comments on the example above:

- The type assertion system is [`joi`](https://www.npmjs.com/package/joi), that needs to be used in the API specification.
- You can easily fetch [Deepstream](http://deepstream.io) (for instance as an npm package) and start it locally on its default port 6020, thus `localhost:6020` as address.

## Change Log

### 4.0

- New structure for the api-description object, adding API-description and return value joi-schema in addition to the existing args joi-schema.
