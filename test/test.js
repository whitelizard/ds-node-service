import test from 'blue-tape';
import pt from 'prop-types';
import ptDoc, { withPropDocs } from 'prop-types-docs';
// import patchPropTypes from 'prop-types-definition';

// patchPropTypes(PropTypes);

export const transformable = pt.array;
export const transformableOr = typeSpec => pt.oneOfType([typeSpec, transformable]);

export const assetTypeMinimum = {
  rid: pt.string.isRequired,
  id: pt.string.isRequired,
};
export const assetTypeMinimumShape = pt.shape(assetTypeMinimum);

export const widgetMenuItem = {
  label: transformableOr(pt.string),
  icon: pt.string,
  method: transformable,
};
export const widgetMenuItemShape = pt.shape(widgetMenuItem);

export const widget = {
  id: pt.string,
  component: pt.string,
  align: pt.string,
  justify: pt.string,
  responsive: pt.bool,
  frameProps: pt.shape({
    title: transformableOr(pt.string),
    menuItems: pt.arrayOf(widgetMenuItemShape),
  }),
  contentProps: pt.object,
  hoc: transformable,
};
export const widgetShape = pt.shape(widget);

export const assetTypeBase = {
  ...assetTypeMinimum,
  channels: pt.objectOf(pt.string),
  rpcs: pt.objectOf(pt.string),
  widgetsInDashboard: pt.arrayOf(pt.oneOfType(pt.string, pt.number)),
  widgets: pt.arrayOf(widgetShape),
};
export const assetTypeBaseShape = pt.shape(assetTypeBase);

// import Deepstream from 'deepstream.io';
// import getClient from 'extended-ds-client';
// import Service, { createRpcService, typeAssert } from '../src/index';

// const dss = new Deepstream();
// let c;
// let s;
// const serviceName = 'testService';

// const options = {
//   // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
//   reconnectIntervalIncrement: 1000,
//   maxReconnectInterval: 8000,
//   maxReconnectAttempts: Infinity,
// };

// test('Set up', async t => {
//   dss.start();
//   c = getClient('localhost:6020', options);
//   c.on('error', e => console.log('Test-client Error:', e));
//   c.login({ id: 'testClient' });
//   await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
//   t.equal(signal, 1);
// });

// const myMethod = args => {
//   // console.log(myFunc.prototype.propTypes);
//   PropTypes.checkPropTypes(myFunc.propTypes, args);
//   return args;
// };

export const myFunc = withPropDocs({
  name: 'My Function',
  description: 'This does this and this',
  props: {
    name: { type: ptDoc.string, required: true },
    age: { type: ptDoc.number, required: true },
    contacts: { type: ptDoc.array, default: [] },
    // type: { type: assetTypeBase, required: true },
  },
})(args => {
  // console.log(myFunc.prototype.propTypes);
  pt.checkPropTypes(myFunc.propTypes, args);
  return args;
});

test('Try proptypes', async t => {
  console.log(myFunc.propTypes);
  // console.log(myMethod.propTypes);
  console.log(myFunc.defaultProps);
  // console.log(myMethod.defaultProps);
  const out = myFunc({ name: 'Test', age: 'foo' });
  t.ok(true);
});

export const myApiFunc = args => {
  // console.log(myFunc.prototype.propTypes);
  pt.checkPropTypes(myApiFunc.propTypes, args);
  return args;
};
myApiFunc.propTypes = {
  /** Name of the asset */
  name: pt.string.isRequired,
  /** Number of children */
  childCount: pt.number.isRequired,
  /** Number of children */
  tags: pt.arrayOf(pt.string),
  /** The asset type */
  type: assetTypeBase,
};
myApiFunc.defaultProps = {
  tags: [],
};

test('Try proptypes', async t => {
  console.log(myApiFunc.propTypes);
  // console.log(myMethod.propTypes);
  console.log(myApiFunc.defaultProps);
  Object.entries(myApiFunc.propTypes).forEach(([key, type]) =>
    console.log(
      key,
      typeof type.getTypeDefinition === 'function' ? type.getTypeDefinition() : 'N/A',
    ));
  // if (typeof type.getTypeDefinition === 'function') {
  //   console.log(key, type.getTypeDefinition());
  // }
  // console.log(myMethod.defaultProps);
  const out = myApiFunc({ name: 'Test', age: 'foo' });
  t.ok(true);
});

// export const evalPropType = str => 5;
// const T = PropTypes;

export const myApiFunc2 = args => {
  // console.log(myFunc.prototype.propTypes);
  pt.checkPropTypes(myApiFunc2.propTypes, args);
  return args;
};
// applyApiDoc({
//   name: { description: 'Name of the asset', 'type': 'T.string' },
//   childCount: { description: 'Number of children', 'type': 'T.number' },
//   name: { description: 'Asset tags', 'type': 'T.arrayOf(T.string)' },
//   type: { description: 'Name of the asset', 'type': 'T.string' },
// })
myApiFunc2.propTypes = {
  /** Name of the asset */
  name: pt.string.isRequired,
  /** Number of children */
  childCount: pt.number.isRequired,
  /** Number of children */
  tags: pt.arrayOf(pt.string),
  /** The asset type */
  type: assetTypeBase,
};
myApiFunc2.defaultProps = {
  tags: [],
};
myApiFunc2.displayName = 'createAsset';
myApiFunc2.description = 'Create a new asset';
myApiFunc2.propInfo = {};

test('Try proptypes', async t => {
  console.log(myApiFunc2.propTypes);
  // console.log(myMethod.propTypes);
  console.log(myApiFunc2.defaultProps);
  Object.entries(myApiFunc2.propTypes).forEach(([key, type]) => {
    console.log(key, typeof type, type);
    Object.entries(type).forEach(([k, v]) => console.log(key, '::', k, v));
  });
  // if (typeof type.getTypeDefinition === 'function') {
  //   console.log(key, type.getTypeDefinition());
  // }
  // console.log(myMethod.defaultProps);
  const out = myApiFunc2({ name: 'Test', age: 'foo' });
  t.ok(true);
});

// test('Tear down', async t => {
//   s.close();
//   c.close();
//   dss.stop();
// });
