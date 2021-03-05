// Copyright 2020 ABSA Group Limited
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const debug = require('debug')('manabu:auth');
const express = require('express');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const initModels = require('../models');

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('auth/login');
});

router.get('/logout', (req, res) => {
  res.clearCookie('userId');
  res.redirect('/');
});

router.post(
  '/login',
  asyncMiddleware(async (req, res) => {
    const email = req.param('email');
    const models = await initModels();
    const user = await models.getModel('user').findOne({
      email
    });

    if (!user) {
      debug('could not find the user');
      return res.render('auth/login', {
        error: 'Could not find user with that email'
      });
    }

    res.cookie('userId', user.id);
    return res.redirect('/courses');
  })
);

router.get(
  '/profile/:id',
  asyncMiddleware(async (req, res) => {
    const email = req.param('id');
    const models = await initModels();
    const user = await models.getModel('user').findOne({
      id
    });
    res.cookie('id', user.id);
    return res.redirect('/courses');
  })
);

module.exports = router;
