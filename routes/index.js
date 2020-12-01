const initModels = require('../models');
const express = require('express');
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const router = express.Router();
const {
  findCourseByAuthor,
  findCoursesByTag,
  findCourseWithTittle,
  findAllCourses,
  getFavouriteCourses,
  getUserCourseProgress,
  userActivityComparison
} = require('../services/courseService');

router.get(
  '/userInfo',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();

    const coursesStillInProgress = await models.getModel('lessonprogress').find({ user: req.user.id });
    const courses = await findAllCourses(req.user);
    const favouriteCoursesList = await getFavouriteCourses(req.user.id);
    const watchingCourses = [];
    const courseIdsOfLessonsInProgress = new Set(coursesStillInProgress.map((lessons) => lessons.courseId));
    const courseIdsOfActiveCourses = courses.map((course) => course.id);
    const completedCourses = await models.getModel('completedcourse').find({ userId: req.user.id, watched: 1 });
    const completedCoursesExcludingInactiveCourses = completedCourses.filter((course) =>
      courseIdsOfActiveCourses.includes(course.courseId)
    );
    const courseIdsOfCompletedCourses = completedCoursesExcludingInactiveCourses.map((course) => course.courseId);

    const courseInProgressAndCompletedCollection = [...courseIdsOfLessonsInProgress].filter((courseId) =>
      courseIdsOfCompletedCourses.includes(courseId)
    );

    const totalCoursesInProgress = [...courseIdsOfLessonsInProgress].filter(
      (course) => !courseInProgressAndCompletedCollection.includes(course)
    );

    if (courseInProgressAndCompletedCollection.length > 0) {
      courseInProgressAndCompletedCollection.forEach(
        async (course) => await models.getModel('lessonprogress').destroy({ user: req.user.id, courseId: course })
      );
    }

    courses
      .filter((course) => courseIdsOfLessonsInProgress.has(course.id))
      .forEach((activeCourse) => {
        if (!courseInProgressAndCompletedCollection.includes(activeCourse.id)) {
          course = {
            id: activeCourse.id,
            image: activeCourse.image,
            lessonProgress: coursesStillInProgress.filter(
              (lesson) => lesson.courseId === activeCourse.id && lesson.progress === 1
            ).length,
            progress: activeCourse.lessonProgress,
            totalLessons: activeCourse.lessons.length,
            lastUpdate: activeCourse.updatedAt,
            title: activeCourse.title
          };
          watchingCourses.push(course);
        }
      });

    watchingCourses.length > 0 ? (isWatchingCourse = true) : (isWatchingCourse = false);

    if (favouriteCoursesList.length > 0) {
      favouriteCourses = favouriteCoursesList.filter((course) => course.status === 1);
      favouriteCoursesIds = favouriteCourses.map((course) => course.courseId);

      completedCoursesExcludingInactiveCourses.forEach((course) => {
        if (favouriteCoursesIds.includes(course.courseId)) {
          course.status = 1;
        } else {
          course.status = 0;
        }
      });

      favourites = favouriteCourses.length;
    } else {
      completedCoursesExcludingInactiveCourses.forEach((course) => (course.status = 0));
      favourites = 0;
    }

    completedCoursesExcludingInactiveCourses.filter((course) => course.watched).length > 0
      ? (hasCompletedCourse = true)
      : (hasCompletedCourse = false);

    res.status(HttpStatus.OK).send({
      watchingCourses,
      hasCompletedCourse,
      favourites,
      isWatchingCourse,
      user: req.user,
      completedCoursesExcludingInactiveCourses,
      numberOfCompletedCourses: completedCoursesExcludingInactiveCourses.length,
      numberOfCoursesStillInProgress: totalCoursesInProgress.length
    });
  })
);

router.get(
  '/search/:search',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Tag = models.getModel('tag');
    const Author = models.getModel('user');

    const tag = await Tag.find({ label: req.params.search });

    const author = await Author.find({ name: req.params.search });

    if (tag[0]) {
      const searchedByTag = await findCoursesByTag(req.user, tag[0].id);

      return res.status(HttpStatus.OK).send({
        courses: searchedByTag,
        role: req.role
      });
    } else if (author[0]) {
      const searchByAuthor = await findCourseByAuthor(req.user, author[0].id);

      return res.status(HttpStatus.OK).send({
        courses: searchByAuthor,
        role: req.role
      });
    }

    const searchByTitle = await findCourseWithTittle(req.user, req.params.search);

    if (searchByTitle[0]) {
      return res.status(HttpStatus.OK).send({
        courses: searchByTitle,
        role: req.role
      });
    } else {
      res.status(HttpStatus.OK).send({
        role: req.role
      });
    }
  })
);

router.get(
  '/userPersonalInformation',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const favourite = models.getModel('favourite');
    const completedCourses = models.getModel('completedcourse');
    const lessonProgress = models.getModel('lessonprogress');
    const course = models.getModel('course');

    const courses = await course.find({ where: { and: [{ isDeleted: 0, isPublished: 1 }] } });
    const favouriteCourses = await favourite.find({where:{ and:[{userId: req.user.id,status:1 }]}});
    const usersCompletedCourses = await completedCourses.find({
      where: { userId: req.user.id },
      select: ['image', 'courseName', 'createdAt', 'courseId']
    });
    const lessonsUserIsWatching = await lessonProgress.find({ user: req.user.id });

    const watchingCourses = await getUserCourseProgress(req.user.id);
    const userPerformanceComparison = await userActivityComparison(req.user.id);

    const idsOfUsersFavouriteCourses = favouriteCourses.map((course) => course.courseId);
    const idsOfActiveCourses = courses.map((course) => course.id);

    const user = req.user;
    const numberOfUsersFavouriteCourses = favouriteCourses.filter((course) =>
      idsOfActiveCourses.includes(course.courseId)
    ).length;
    const numberOfCompletedCoursesByUser = usersCompletedCourses.filter((course) =>
      idsOfActiveCourses.includes(course.courseId)
    ).length;
    const numberOfCoursesUserIsWatching = [
      ...new Set(
        lessonsUserIsWatching
          .filter((course) => idsOfActiveCourses.includes(course.courseId))
          .map((course) => course.courseId)
      )
    ].length;
    const usersFavouriteCourses = usersCompletedCourses.filter(
      (course) => idsOfUsersFavouriteCourses.includes(course.courseId) && idsOfActiveCourses.includes(course.courseId)
    );

    return res.status(HttpStatus.OK).send({
      user,
      numberOfUsersFavouriteCourses,
      numberOfCompletedCoursesByUser,
      numberOfCoursesUserIsWatching,
      watchingCourses,
      usersFavouriteCourses,
      usersCompletedCourses,
      userPerformanceComparison
    });
  })
);

module.exports = router;
