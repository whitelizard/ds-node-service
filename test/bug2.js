const { Deepstream } = require('@deepstream/server');

const run = async () => {
  const server = new Deepstream('./test/emptyConf.yml');
  server.start();
  await new Promise(r => setTimeout(r, 5000));
  server.stop();
};

run();
