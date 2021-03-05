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
const initModels = require('../models');
const express = require('express');
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const router = express.Router();
const fs = require('fs');
const handlebars = require('handlebars');
const { getTotalUsersThatCompletedCourse, getTotalUsersWatchingCourse } = require('../services/courseService');
const { sendEMail } = require('../services/userService');

router.post(
  '/userAdminRequestPermissionApproval/:requestId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const requests = await models.getModel('adminrequest');
    const user = await models.getModel('user');
    const requestId = req.params.requestId;

    const requester = await requests.find({ id: requestId });

    await user.update({ email: requester[0].email }).set({ role: 'admin' });
    await requests.destroy({ id: requestId });

    let readHTMLFile = (path, data) => {
      fs.readFile(path, { encoding: 'utf-8' }, (err, html) => {
        if (err) {
          throw err;
        } else {
          data(null, html);
        }
      });
    };

    readHTMLFile('public/pages/welcome-admin-template.html', (err, html) => {
      const template = handlebars.compile(html);
      let supportingData = {
        name: requester[0].name,
        manabuUrlLink: process.env.APPLICATION_URL,
        manabuEmailLink: `mailto:${process.env.MANABU_EMAIL}`
      };
      let htmlFile = template(supportingData);
      sendEMail({
        to: requester[0].email,
        subject: 'Manabu Administration Request Approval',
        html: htmlFile
      });
    });

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.get(
  '/viewData',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();

    const course = models.getModel('course');
    const lessonProgress = models.getModel('lessonprogress');
    const completedCourse = models.getModel('completedcourse');
    const request = models.getModel('adminrequest');
    const contributionRequest = models.getModel('acceptedcontributionrequest');

    const courses = await course.find({ isDeleted: 0 }).populate('authors', { select: ['name', 'surname'] });
    const completedCourses = await completedCourse.find({});
    const courseLessonsInProgress = await lessonProgress.find({});
    const requests = await request.find({});
    const contributionRequests = await contributionRequest.find({});

    courses.forEach((course) => {
      let usersWatchingCourse = courseLessonsInProgress.filter((lesson) => lesson.courseId === course.id);
      let usersThatCompletedCourse = completedCourses.filter(
        (completedCourse) => completedCourse.courseId === course.id
      );

      let totalUsersWatchingCourse = getTotalUsersWatchingCourse(usersWatchingCourse);
      let totalUsersThatCompletedCourse = getTotalUsersThatCompletedCourse(usersThatCompletedCourse);

      course.totalUsersWatching = totalUsersWatchingCourse;
      course.totalUsersThatCompletedCourse = totalUsersThatCompletedCourse;
    });

    return res.status(HttpStatus.OK).send({
      adminPermissionRequests: requests,
      courses: courses,
      authorContributionRequests: contributionRequests
    });
  })
);

router.post(
  '/approveAuthorContributionRequest/:requestId/:userId/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const acceptedContributionRequest = models.getModel('acceptedcontributionrequest');
    const course = await models.getModel('course');
    const user = await models.getModel('user');

    const { userId, requestId, courseId } = req.params;

    await user.updateOne({ id: userId }).set({ role: 'admin' });
    await acceptedContributionRequest.destroy({ id: requestId });

    await course.addToCollection(courseId, 'authors', userId);

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

module.exports = router;
