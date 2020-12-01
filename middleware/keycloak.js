const Keycloak = require('keycloak-connect');
const memoryStore = require('./memoryStore');

const kcConfig = 
{
    "realm": "Manabu",
    "bearer-only": true,
    "auth-server-url": process.env.AUTH_SERVER_URL,
    "ssl-required": "external",
    "resource": "test-backend",
    "confidential-port": 0
  }

const keycloak = new Keycloak({ store: memoryStore },  kcConfig);

module.exports = keycloak;
