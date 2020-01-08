import express from 'express';
import bodyParser from 'body-parser';

// AuthenticationHandler mocking
let currentTokenIndex = 0;

export const createAuthServer = () => {
  const app = express();
  const activeTokens = {};
  let lastLoginId;
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.get('/getAuthToken', (req, res) => {
    try {
      currentTokenIndex += 1;
      const token = `TEST${currentTokenIndex}`;
      activeTokens[token] = setTimeout(() => delete activeTokens[token], 5000);
      console.log('Generated token:', token);
      res.status(201).json({ token });
    } catch (err) {
      console.log('getAuthToken error:', err);
      res.status(500); // status Internal Server Error
    }
  });
  app.get('/lastLoginId', (req, res) => {
    try {
      res.status(201).json({ lastLoginId });
    } catch (err) {
      console.log('lastLoginId error:', err);
      res.status(500); // status Internal Server Error
    }
  });
  app.post('/authenticate', (req, res) => {
    try {
      // console.log('Auth req:', req.body);
      const { id, token } = req.body.authData;
      console.log('Auth from:', id, ', token:', token);
      if (id === 'testClient') {
        lastLoginId = id;
        return res.status(200).json({
          id,
          clientData: { id },
          serverData: { id },
        });
      }
      // Service login
      if (token in activeTokens) {
        delete activeTokens[token];
        lastLoginId = id;
        return res.status(200).json({
          id,
          clientData: { id },
          serverData: { id, service: true },
        });
      }
      console.log('Failed token login.');
      return res.status(401).send();
    } catch (err) {
      return res.status(500).send();
    }
  });

  return {
    app,
    server: undefined,
    start() {
      this.server = app.listen(3000);
      return this;
    },
    stop() {
      this.server.close();
      return this;
    },
  };
};
