const express = require('express');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const {
  getNumberOfPeopleWhoCompletedCoursesForEveryCourse,
  mapOfNumberOfPeopleWatchingACourse,
  findUsersAndTheirCompletedCourses,
  findUsersWithProgress
} = require('../services/courseService');

router.get(
  '/quickStats',
  asyncMiddleware(async (req, res) => {
    const numberOfPeopleWhoCompletedCoursesForEveryCourse = await getNumberOfPeopleWhoCompletedCoursesForEveryCourse();
    const mapOfAmountOfPeopleWatchingACourse = await mapOfNumberOfPeopleWatchingACourse();

    return res.status(HttpStatus.OK).send({
      mapOfAmountOfPeopleWatchingACourse,
      numberOfPeopleWhoCompletedCoursesForEveryCourse
    });
  })
);

router.get(
  '/courseStatistics/:user',
  asyncMiddleware(async (req, res) => {
    const userAndCompletedCourses = await findUsersAndTheirCompletedCourses();
    const orderedUserAndCompletedCourses = [];

    for (let i = userAndCompletedCourses.length - 1; i >= 0; i--) {
      orderedUserAndCompletedCourses.push(userAndCompletedCourses[i]);
    }

    const usersWithProgress = await findUsersWithProgress();

    return res.status(HttpStatus.OK).send({
      orderedUserAndCompletedCourses,
      usersWithProgress,
      role: req.role
    });
  })
);

module.exports = router;
