const express = require('express');
const initModels = require('../models');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');

router.get(
  '/webhooks',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');
    const WebhookEmail = models.getModel('webhookemail');

    const courses = await Course.find();

    const webhookemails = await WebhookEmail.find();

    const user = req.user;

    res.status(HttpStatus.OK).send({
      email: user.email,
      courses,
      role: req.role,
      webhookemails
    });
  })
);

router.post(
  '/webhooks/email',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const WebhookEmail = models.getModel('webhookemail');

    await WebhookEmail.create({
      email: req.body.email,
      course: req.body.course,
      completion: req.body.completion
    }).fetch();

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

module.exports = router;
