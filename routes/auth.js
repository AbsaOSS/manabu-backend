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
