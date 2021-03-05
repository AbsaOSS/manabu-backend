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
