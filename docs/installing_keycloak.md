#### Authentication with Keycloak - The Setup
Keycloak is a solution, aimed at modern applications and services, that manages identity and access. In other words, it provides security for an application or service. Here is a summary of how to go about setting up Keycloak in an express application:

1. Run `npm install keycloak-connect --save`.
2. Navigate to the middleware folder, and create a file called `keycloak.js`.
3. Inside this file, import `keycloak-connect` and `express-session`:
   `const KeycloakConnect = require('keycloak-connect');`
   `const session = require('express-session');`
4. Now configure the session to use memoryStore. This is done as follows:
   `const memoryStore = new session.MemoryStore();`
   `const keycloak = new KeycloakConnect({ store: memoryStore });`
5. Create a function that sets up the necessary parameters that are to be stored in a given session:
    `function createSession() {`
      `session({`
        `secret: 'thisIsASecretSoMakeItLongAndUnpredictable',`
        `resave: false,`
        `saveUninitialized: true,`
        `store: memoryStore,`
      `});`
    `}`
6. At the end of the `keycloak.js` file, export `keycloak` and the `createSession` function:
    `module.exports = {`
      `keycloak,`
      `createSession,`
    `};`
7. Navigate to the `app.js` file. Import `keycloak` and the `createSession` function:
    `const keycloak = require('./middleware/keycloak');`
    `const createSession = require('./middleware/keycloak');`
8. Somewhere inside the `app.js` file, tell the application to use keycloak:
    `app.use(createSession());`
    `app.use(keycloak.middleware());`
9. The previous step ensures that only a logged in user will be allowed to visit protected routes.
10. To kill the session, use the following: `app.use(keycloak.middleware({ logout: '/' }));`
11. If you wish to protect a particular route, let's call it `/getUsers`, then call `keycloak.protect()` for that route:
    `app.get(‘/getUsers’, keycloak.protect(), (req, res) =>`
      `//do something`
    `});`
12. If you wish to protect all your routes, then inside the `app.js` file, insert the following line of code:
    `app.use(keycloak.protect());`