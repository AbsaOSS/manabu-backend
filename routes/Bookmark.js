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
const initModels = require('../models');
const HttpStatus = require('http-status-codes');
const showdown = require('showdown');

const _ = require('lodash');
const getDurationFromSeconds = require('../lib/getDurationFromSeconds');

const markdownConverter = new showdown.Converter();

const {
  findAllCourses,
  findOneCourse,
  getTagsOfOneCourse,
  findUserAndCompletedCoursesFromDb,
  findCoursesWithUserProgress,
  getFavouriteCourses
} = require('../services/courseService');

const { getLessonWithContributors, convertBookmarkedTimeToSeconds } = require('../services/lessonService');

const router = express.Router();

router.get(
  '/getLessonBookmarks/:lessonId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const bookmarks = await models.getModel('bookmark').find({ lessonId: req.params.lessonId });

    return res.status(HttpStatus.OK).send({
      bookmarks: bookmarks
    });
  })
);

router.get(
  '/bookmark/:courseId/:lessonId/:bookmarkedTime',
  asyncMiddleware(async (req, res) => {
    const courseId = req.params.courseId;
    const courses = await findAllCourses(req.user);
    const completedCourses = await findUserAndCompletedCoursesFromDb(req.user.id);
    const coursesStillInProgress = await findCoursesWithUserProgress(req.user.id);
    const course = await findOneCourse(courseId, req.user);
    const favouriteCourses = await getFavouriteCourses(req.user.id);
    const lesson = await getLessonWithContributors({
      lessonId: req.params.lessonId,
      lessonTitle: req.body.title,
      courseWithProgress: course,
      role: req.role
    });

    const courseThatIsBeingWatched = Object.assign({}, course, {
      descriptionMarkdown: markdownConverter.makeHtml(course.description)
    });
    const models = await initModels();
    const Bookmark = models.getModel('bookmark');
    const bookmarks = await Bookmark.find({ userId: req.user.id });
    const Lesson = models.getModel('lesson');
    const lessonsOfCourse = await Lesson.find({ course: courseId })
      .populate('trueOrFalseQuestions')
      .populate('multipleChoiceQuestions');
    const courseCategories = [];

    for (let counter = 0; counter < course.lessons.length; counter++) {
      courseCategories.push(course.lessons[counter].category);
    }

    const tagsOfCourse = await getTagsOfOneCourse(courseId);

    const bookmarkedTimeInSeconds = await convertBookmarkedTimeToSeconds(req.params.bookmarkedTime);
    lesson.progress = bookmarkedTimeInSeconds / lesson.durationInSeconds;

    res.status(HttpStatus.OK).send({
      user: req.user,
      currentUrl: req.path,
      courses,
      completedCourses,
      numberOfCompletedCourses: completedCourses.length,
      numberOfCoursesStillInProgress: coursesStillInProgress.length,
      coursesStillInProgress,
      course: courseThatIsBeingWatched,
      tags: tagsOfCourse,
      courseCategories: _.uniq(courseCategories),
      lesson,
      bookmarks,
      favouriteCourses,
      lessonsOfCourse
    });
  })
);

router.post(
  '/bookmarkLesson',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Bookmark = models.getModel('bookmark');
    const bookmark = req.body;

    const createdBookmark = await Bookmark.create({
      courseId: bookmark.courseId,
      lessonId: bookmark.lessonId,
      userId: req.user.id,
      duration: getDurationFromSeconds(req.body.duration)
    }).fetch();
    return res.status(HttpStatus.OK).send(createdBookmark);
  })
);

module.exports = router;
