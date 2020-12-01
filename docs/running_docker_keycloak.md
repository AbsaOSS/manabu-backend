#### Test Keycloak
In order to test the authentication/authorisation, you need to run a Keycloak instance locally.
This can be achieved by running a Docker container.

1. To run a Docker container, type the following commands in the terminal:
```console
$ docker run -p 8081:8080 \
  -e KEYCLOAK_USER=admin \
  -e KEYCLOAK_PASSWORD=admin \
  -e KEYCLOAK_HTTP_PORT=8081 \
  jboss/keycloak:6.0.1
```
The Keycloak instance will be available at http://localhost:8081/auth

#### Import realm settings

1. Once your Keycloak container is running, login into the _Administration Console_  with username and password of `admin` / `admin`.
2. Then click the _Select realm_ dropdown and choose _Add realm_.. You'll find this option by hovering over the Master heading in the top left hand corner.
3. Give your realm a name (e.g. Manabu) and then click _Save_.
4. Create one or more clients by clicking _Clients_ on the left panel, then click on _Create_, which is on the right. 
   1. Fill in the required fields, i.e. `Client ID`, `Client Protocol`, and `Root URL`.
   2. For a redirect URI, use `http://localhost:4200/*`. 
   3. Use a name for the Client ID like `Mababu`
   4. Leave `Client Protocol` as openid-connect. Click Save.
5. Now navigate to the _Installation_ tab on the top right. Select the format option as `Keycloak OIDC JSON`
   1.  Click on the _Format Option_ dropdown list, and select `Keycloak OIDC JSON`.
   2.  Copy the json from here and past it in the `keycloak.json` file in the manabu-ui project.
   3. The json should be similar to 
```json
{
  "realm": "Manabu",
  "auth-server-url": "http://localhost:8081/auth",
  "ssl-required": "external",
  "resource": "test",
  "public-client": true,
  "confidential-port": 0
}
```



Now that we added the auth for the UI, we need to be able to ensure that authentication to the backend app is also setup.

1. Go back to _Clients_ on the left panel and click _Create_
2. Similar to pt 4. 
   1. Name the `Client ID` as `Manabu-backend` 
   2. leave the `Root URL` empty
3.  After clicking save, in the _Settings_ tab, change the `Access Type` to `bearer-only`
4.  Click `Save`
5.  Go to the Installation file and copy the json (similar to pt 5 above)
    1.  It should look like 
```json
{
  "realm": "Manabu-backend",
  "auth-server-url": "http://localhost:8081/auth",
  "ssl-required": "external",
  "resource": "test",
  "public-client": true,    
  "confidential-port": 0
}
```
    2. Update the `AUTH_SERVER_URL` in the `.env` file with the value of `auth-server-url` from the json
    3. Update the values in the `kcConfig` constant in both the `app.js` and the `keycloak.js` files with the respective values from the json file.


#### Create Roles

          
Next click on `Roles` on the left hand menu. Click `Add Role` and add the following three roles
    - manabu-admin
    - manabu-user
    - manabu-superuser  



#### Create Users

Next create one or more test users by clicking _Users_ on the left panel. 
Click _Add user_, fill out the details and click _Save_.

![Keycloak - Add user](docs/keycloak-add-user.png)

Once the user is created, you need to add the one of the roles defined above to the user by clicking the
_Role Mappings_ tab, selecting the e.g. `manabu-admin` (or one of the other two role) and clicking _Add selected_

![Keycloak - Add role](docs/keycloak-add-role.png)

Finally, set the credentials for your user by selecting the _Credentials_ tab and filling in the
password fields and clicking _Reset Password_

![Keycloak - Change password](docs/keycloak-change-password.png)
