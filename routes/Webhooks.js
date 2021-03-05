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
