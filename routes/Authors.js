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
const {
  getActiveCoursesAuthoredByUser,
  getArchivedCoursesByUser,
  courseStatisticsForAuthor,
  getNumberOfFavouriteCourses,
  findUsersThatCompletedAuthoredCourses,
  findCourseByAuthor
} = require('../services/courseService');

router.get(
  '/home',
  asyncMiddleware(async (req, res) => {
    const coursesAuthoredByUser = await getActiveCoursesAuthoredByUser(req.user.id);

    const archivedCoursesByUser = await getArchivedCoursesByUser(req.user.id);

    return res.status(HttpStatus.OK).send({
      coursesAuthoredByUser,
      archivedCoursesByUser
    });
  })
);

router.get(
  '/profile',
  asyncMiddleware(async (req, res) => {
    const user = req.user;

    const courseStats = await courseStatisticsForAuthor(req.user.id);

    const numberOfPeopleWhoAreWatchingCoursesByThisAuthor = courseStats.inProgress;

    const numberOfPeopleWhoCompletedCoursesByThisAuthor = courseStats.completed;

    const numberOfFavouriteCoursesForAuthor = await getNumberOfFavouriteCourses(req.user.id);

    return res.status(HttpStatus.OK).send({
      user,
      numberOfPeopleWhoAreWatchingCoursesByThisAuthor,
      numberOfPeopleWhoCompletedCoursesByThisAuthor,
      numberOfFavouriteCoursesForAuthor
    });
  })
);

router.get(
  '/usersThatCompletedAuthoredCourses',
  asyncMiddleware(async (req, res) => {
    const usersThatCompletedAuthoredCourses = await findUsersThatCompletedAuthoredCourses(req.user.id);

    return res.status(HttpStatus.OK).send(usersThatCompletedAuthoredCourses);
  })
);

router.delete(
  '/deleteAuthor/:authorId/:courseId/:lessonId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const author = await models.getModel('user');

    const { courseId, authorId, lessonId } = req.params;

    await author.find({
      id: authorId
    });

    const { name, surname } = author[0];

    const deleteMessage = name + ' ' + surname + ' has been removed successfully.';
    const CourseAndAuthor = await models.getModel('course_authors__user_courses');

    await CourseAndAuthor.destroy({
      course_authors: courseId,
      user_courses: authorId
    });

    const LessonAndAuthor = await models.getModel('lesson_authors__user_lessons');

    await LessonAndAuthor.destroy({
      lesson_authors: lessonId,
      user_lessons: authorId
    });

    return res.status(HttpStatus.OK).send(deleteMessage);
  })
);

router.post(
  '/addAuthorToCourse/:courseId/:lessonId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const { courseId, lessonId } = req.params;
    const author = await models.getModel('user').find({
      email: req.body.email
    });
    if (!author[0] || author[0] === undefined) {
      return res.status(HttpStatus.OK).send({ authorAddedSuccessfully: false });
    }
    const Course = models.getModel('course');
    await Course.addToCollection(courseId, 'authors', author[0].id);
    const Lesson = models.getModel('lesson');
    await Lesson.addToCollection(lessonId, 'authors', author[0].id);
    return res.status(HttpStatus.OK).send({ authorAddedSuccessfully: true });
  })
);

router.get(
  '/user/:userId/:authorFilter',
  asyncMiddleware(async (req, res) => {
    const courses = await findCourseByAuthor(req.user, req.params.userId);

    return res.status(HttpStatus.OK).send({
      courses,
      role: req.role
    });
  })
);

module.exports = router;
