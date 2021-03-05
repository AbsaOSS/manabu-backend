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
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

async function updateProfileUrl(userId, url) {
  const models = await initModels();
  const User = models.getModel('user');

  await User.update({ id: userId }).set({ image: url });
}
async function findAllUsers(userId) {
  const models = await initModels();
  const User = models.getModel('User');

  await User.findAll();
}

async function updateUserImage(userId, source) {
  const models = await initModels();
  const User = models.getModel('user');

  await User.update({ id: userId }).set({
    image: source
  });
}

async function getUsersEmails() {
  const models = await initModels();
  const users = await models.getModel('user').find();

  const emails = users.map((user) => user.email);
  const filteredEmails = [...new Set(emails)];

  return filteredEmails;
}

async function sendEMail(mailData) {
  let transporter = nodemailer.createTransport(
    smtpTransport({
      host: process.env.EMAIL_IP,
      port: process.env.EMAIL_PORT
    })
  );

  mailOptions = {
    from: process.env.MANABU_EMAIL_WITH_NAME,
    to: mailData.to,
    subject: mailData.subject,
    html: mailData.html
  };

  await transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

module.exports = {
  updateProfileUrl,
  findAllUsers,
  updateUserImage,
  getUsersEmails,
  sendEMail
};
