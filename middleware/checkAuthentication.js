const HttpStatus = require('http-status-codes');
const initModels = require('../models');

module.exports = async (req, res, next) => {
  if (req.url === '/auth/login' || req.url === '/setup') {
    return next();
  }

  if (!req.cookies || !req.cookies.userId) {
    if (req.is('application/json')) {
      return res.status(HttpStatus.FORBIDDEN).send({ error: 'You are not logged in' });
    }

    return res.redirect('/auth/login');
  }

  const models = await initModels();
  const User = models.getModel('user');
  const user = await User.find(req.cookies.userId).limit(1);
  res.locals.user = user;
  req.user = user;

  return next();
};
