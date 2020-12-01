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
