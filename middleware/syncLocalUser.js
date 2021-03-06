/*
 * Copyright 2020 ABSA Group Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const initModels = require('../models');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { sendEMail } = require('../services/userService');
const handlebars = require('handlebars');

module.exports = async (req, res, next) => {
  let token;
  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }

    const decoded = jwt.decode(token);
    const models = await initModels();
    const User = models.getModel('user');
    let user = await User.find({ email: decoded.email });

    if (user.length === 0) {
      user = await createUser(decoded, User);
      res.locals.user = user;
      req.user = user;
    } else {
      res.locals.user = user[0];
      req.user = user[0];
    }
  }

  return next();
};

async function createUser(decoded, User) {
  newUser = await User.create({
    email: decoded.email,
    name: decoded.given_name,
    surname: decoded.family_name
  }).fetch();

  let readHTMLFile = (path, data) => {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, html) {
      if (err) {
        throw err;
      } else {
        data(null, html);
      }
    });
  };

  readHTMLFile('public/pages/welcome-template.html', (err, html) => {
    const template = handlebars.compile(html);
    let supportingData = {
      name: decoded.given_name,
      manabuUrlLink: process.env.APPLICATION_URL,
      manabuEmailLink: `mailto:${process.env.MANABU_EMAIL}`
    };
    let htmlFile = template(supportingData);
      sendEMail({
      to: decoded.email,
      subject: 'Welcome To Manabu',
      html: htmlFile
    }); 
  });

  return newUser;
}
