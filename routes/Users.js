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
const router = express.Router();
const initModels = require('../models');
const https = require('https');
const aws = require('aws-sdk');
const cors = require('cors');
const multer = require('multer');
const multerS3 = require('multer-s3');
const HttpStatus = require('http-status-codes');
const jwt = require('jsonwebtoken');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const { updateProfileUrl, updateUserImage, getUsersEmails } = require('../services/userService');
const { findUserAndCompletedCoursesFromDb, findCoursesWithUserProgress } = require('../services/courseService');

router.get(
  '/profile',
  asyncMiddleware(async (req, res) => {
    const user = req.user;

    const userAndCompletedCourses = await findUserAndCompletedCoursesFromDb(user.id);

    const coursesWithUserProgress = await findCoursesWithUserProgress(user.name);

    res.status(HttpStatus.OK).send({
      heading: 'Your profile',
      email: user.email,
      name: user.name,
      surname: user.surname,
      image: user.image,
      abNumber: user.preferred_username,
      userAndCompletedCourses,
      coursesWithUserProgress,
      role: req.role
    });
  })
);

router.post('/profile', (req, res, next) => {
  const s3 = new aws.S3();

  const storage = multerS3({
    s3,
    bucket: 'manabu',
    key: (multerReq, file, cb) => {
      cb(null, `${req.user.id}.jpg`);
    }
  });

  const uploadMulter = multer({ storage: storage });

  uploadMulter.single('file')(req, res, async (err) => {
    if (err) {
      debug('Error while uploading file', err);
      return next(err);
    }

    await updateProfileUrl(req.user.id, req.file.location);
    return res.status(HttpStatus.OK).send({ success: true });
  });
});

router.post(
  '/updateUserImage',
  cors(),
  asyncMiddleware(async (req, res) => {
    let fileName;
    const s3 = new aws.S3({
      s3BucketEndpoint: true,
      endpoint: process.env.AWS_S3_ENDPOINT,
      accessKeyId:process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      region: 'symphony'
    });

    aws.config.update({
      httpOptions: {
        agent: new https.Agent({
          rejectUnauthorized: false
        })
      }
    });

    const storage = multerS3({
      s3,
      bucket: 'manabu',
      acl: 'public-read',
      key: (multerReq, file, cb) => {
        fileName = req.body.id + '-' + Date.now() + '.' + req.body.fileExtension;
        cb(null, fileName);
      }
    });

    let upload = multer({ storage: storage });

    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.log('Error while uploading file ', err);
        return next(err);
      }

      await updateUserImage(req.body.id, s3.endpoint.href + req.file.key);
      return res.status(HttpStatus.OK).send({ success: true });
    });
  })
);

router.put(
  '/updateUserPersonalInfo/:userId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const user = await models.getModel('user');
    const updatedUserPersonalInfo = req.body;

    await user
      .update({
        id: req.params.userId
      })
      .set(updatedUserPersonalInfo);

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.post(
  '/requestAdminPermission',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const request = await models.getModel('adminrequest');

    let token;

    if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }

      const decoded = jwt.decode(token);

      const requests = await request.find({ abNumber: decoded.preferred_username, email: decoded.email });

      if (requests.length === 0) {
        await request.create({
          abNumber: decoded.preferred_username,
          name: decoded.given_name,
          lastName: decoded.family_name,
          email: decoded.email
        });

        return res.status(HttpStatus.OK).send({ success: true });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
      }
    } else {
      return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
    }
  })
);

router.get('/getEmails', asyncMiddleware(async(req, res) => {
  const email = await getUsersEmails();
  res.status(HttpStatus.OK).send({email});
}));

module.exports = router;
