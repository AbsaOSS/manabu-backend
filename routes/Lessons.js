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
const path = require('path');
const multer = require('multer');
const { updateCourseWhenLessonIsEdited } = require('../services/courseService');
const {
  updateLessonMarkdown,
  addLessonWithOnlyAuthor,
  updateLessonUrl,
  continueWhereILeftOff,
  getPreviousLessonOrderNumber,
  addLesson,
  getContributions,
  moveLesson,
  getLessonWithContributors,
  deleteLesson,
  markdDownWordCount
} = require('../services/lessonService');
const {
  assignAuthorToCourse,
  saveLatestCourseCompleted,
  addCompletedCourse,
  findInitialisingCourse,
  getTagsOfOneCourse,
  findOneCourse,
  titleCasing
} = require('../services/courseService');

router.get(
  '/courseLessons/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const lessons = await models
      .getModel('course')
      .find({ where: { id: req.params.courseId }, select: ['description'] })
      .populate('authors', { select: ['name', 'surname'] })
      .populate('tags', { select: ['label'] })
      .populate('lessons', {
        select: ['title', 'type', 'source', 'durationInSeconds'],
        sort: 'order ASC'
      });

    return res.status(HttpStatus.OK).send({
      lessons
    });
  })
);

router.get(
  '/initiateCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const courseId = req.params.courseId;
    const models = await initModels();
    const Lesson = models.getModel('lesson');
    const bookMarks = models.getModel('bookmark');
    const courseDetails = await findInitialisingCourse(courseId, req.user);

    const lessonProgress = [];
    const lessons = await models.getModel('lessonprogress').find({ courseId: courseId, user: req.user.id });
    const lessonsUserHasCompleted = lessons.filter((lesson) => lesson.progress === 1);

    lessons.forEach((activeLesson) => {
      lesson = {
        id: activeLesson.lessonId,
        progress: activeLesson.progress
      };
      lessonProgress.push(lesson);
    });

    const showIntro = lessonProgress.length === 0;
    let isLastLesson = false;

    const courseCompletion = models.getModel('completedcourse');
    const userHasCompletedCourse = await courseCompletion.find({ courseId: courseId, userId: req.user.id });

    if (userHasCompletedCourse.length > 0) {
      await courseCompletion.destroy({ courseId: courseId, userId: req.user.id });
    }

    const currentLesson = await Lesson.findOne({
      where: { id: courseDetails.lessons[0].id },
      select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
    })
      .populate('trueOrFalseQuestions')
      .populate('multipleChoiceQuestions')
      .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

    let latestLessonId = courseDetails.lessons[0].id;
    let lessonStartTime = 0;
    let videoStartTime = 0;

    if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
      if (currentLesson.type === 'VIDEO') {
        let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
        let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
        if (lessonIsActive.length > 0) {
          lessonStartTime = lessonIsActive[0].progress;
          videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
          currentLesson.videoStartTime = videoStartTime;
          currentLesson.bookMarks = lessonBookMarks;
        }
      }
    }

    let indexOfCurentLesson = courseDetails.lessons.indexOf(currentLesson.id);

    if (indexOfCurentLesson + 1 === courseDetails.lessons.length - 1) {
      isLastLesson = true;
    }

    const tagsOfCourse = await getTagsOfOneCourse(courseId);
    const tags = tagsOfCourse.map((tag) => {
      return { label: tag };
    });

    const courseLessons = courseDetails.lessons;
    const { id, title, description, image, coursePreRequisites, courseAudience, authors } = courseDetails;
    const course = {
      id,
      title,
      description,
      image,
      coursePreRequisites,
      courseAudience,
      authors
    };

    const currentLessonNumber = 1;
    return res.status(HttpStatus.OK).send({
      course: course,
      currentLesson: currentLesson,
      tags: tags,
      lessonsProgress: lessonProgress,
      courseLessons: courseLessons,
      completedLessons: lessonProgress.filter((lesson) => lesson.progress === 1).length,
      showIntro,
      isLastLesson,
      currentLessonNumber
    });
  })
);

router.get(
  '/getLesson/:courseId/:lessonId',
  asyncMiddleware(async (req, res) => {
    const courseId = req.params.courseId;
    const models = await initModels();
    const Lesson = models.getModel('lesson');
    const bookMarks = models.getModel('bookmark');
    const courseDetails = await findInitialisingCourse(courseId, req.user);

    const lessonProgress = [];
    const lessons = await models.getModel('lessonprogress').find({ courseId: courseId, user: req.user.id });
    const lessonsUserHasCompleted = lessons.filter((lesson) => lesson.progress === 1);

    lessons.forEach((activeLesson) => {
      lesson = {
        id: activeLesson.lessonId,
        progress: activeLesson.progress
      };
      lessonProgress.push(lesson);
    });

    let showIntro = lessonProgress.length === 0;
    let isLastLesson = false;

    const preceedingLesson = courseDetails.lessons.filter((lesson) => lesson.id === req.params.lessonId);
    const indexOfPreceeding = courseDetails.lessons.indexOf(preceedingLesson[0]);

    if (indexOfPreceeding === courseDetails.lessons.length - 1) {
      isLastLesson = true;

      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[indexOfPreceeding].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let latestLessonId = currentLesson.id;
      let lessonStartTime = 0;
      let videoStartTime = 0;

      if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
          if (lessonIsActive.length > 0) {
            lessonStartTime = lessonIsActive[0].progress;
            videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
            currentLesson.videoStartTime = videoStartTime;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      }
    } else {
      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[indexOfPreceeding].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let latestLessonId = currentLesson.id;
      let lessonStartTime = 0;
      let videoStartTime = 0;

      if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
          if (lessonIsActive.length > 0) {
            lessonStartTime = lessonIsActive[0].progress;
            videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
            currentLesson.videoStartTime = videoStartTime;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      }
    }

    const tagsOfCourse = await getTagsOfOneCourse(courseId);
    const tags = tagsOfCourse.map((tag) => {
      return { label: tag };
    });

    const courseLessons = courseDetails.lessons;
    const { id, title, description, image, coursePreRequisites, courseAudience, authors } = courseDetails;
    const course = {
      id,
      title,
      description,
      image,
      coursePreRequisites,
      courseAudience,
      authors
    };
    const currentLessonNumber = indexOfPreceeding + 1;
    return res.status(HttpStatus.OK).send({
      course: course,
      currentLesson: currentLesson,
      tags: tags,
      lessonsProgress: lessonProgress,
      courseLessons: courseLessons,
      completedLessons: lessonProgress.filter((lesson) => lesson.progress === 1).length,
      showIntro,
      isLastLesson,
      currentLessonNumber
    });
  })
);

router.get(
  '/loadNextLesson/:courseId/:lessonId',
  asyncMiddleware(async (req, res) => {
    const courseId = req.params.courseId;
    const models = await initModels();
    const Lesson = models.getModel('lesson');
    const bookMarks = models.getModel('bookmark');
    const courseDetails = await findInitialisingCourse(courseId, req.user);

    const lessonProgress = [];
    const lessons = await models.getModel('lessonprogress').find({ courseId: courseId, user: req.user.id });
    const lessonsUserHasCompleted = lessons.filter((lesson) => lesson.progress === 1);

    lessons.forEach((activeLesson) => {
      lesson = {
        id: activeLesson.lessonId,
        progress: activeLesson.progress
      };
      lessonProgress.push(lesson);
    });

    let showIntro = lessonProgress.length === 0;
    let isLastLesson = false;

    const preceedingLesson = courseDetails.lessons.filter((lesson) => lesson.id === req.params.lessonId);
    const indexOfPreceeding = courseDetails.lessons.indexOf(preceedingLesson[0]);

    if (indexOfPreceeding + 1 === courseDetails.lessons.length - 1) {
      isLastLesson = true;

      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[indexOfPreceeding + 1].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let latestLessonId = currentLesson.id;
      let lessonStartTime = 0;
      let videoStartTime = 0;

      if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
          if (lessonIsActive.length > 0) {
            lessonStartTime = lessonIsActive[0].progress;
            videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
            currentLesson.videoStartTime = videoStartTime;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      }
    } else {
      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[indexOfPreceeding + 1].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let latestLessonId = currentLesson.id;
      let lessonStartTime = 0;
      let videoStartTime = 0;

      if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
          if (lessonIsActive.length > 0) {
            lessonStartTime = lessonIsActive[0].progress;
            videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
            currentLesson.videoStartTime = videoStartTime;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      }
    }

    const tagsOfCourse = await getTagsOfOneCourse(courseId);
    const tags = tagsOfCourse.map((tag) => {
      return { label: tag };
    });

    const courseLessons = courseDetails.lessons;
    const { id, title, description, image, coursePreRequisites, courseAudience, authors } = courseDetails;
    const course = {
      id,
      title,
      description,
      image,
      coursePreRequisites,
      courseAudience,
      authors
    };

    const currentLessonNumber = indexOfPreceeding + 2;

    return res.status(HttpStatus.OK).send({
      course: course,
      currentLesson: currentLesson,
      tags: tags,
      lessonsProgress: lessonProgress,
      courseLessons: courseLessons,
      completedLessons: lessonProgress.filter((lesson) => lesson.progress === 1).length,
      showIntro,
      isLastLesson,
      currentLessonNumber
    });
  })
);

router.get(
  '/loadPreviousLesson/:courseId/:lessonId',
  asyncMiddleware(async (req, res) => {
    const courseId = req.params.courseId;
    const models = await initModels();
    const Lesson = models.getModel('lesson');
    const bookMarks = models.getModel('bookmark');
    const courseDetails = await findInitialisingCourse(courseId, req.user);

    const courseModel = models.getModel('course');

    const lessonsInCourse = await courseModel.find({ id: courseId }).populate('lessons');

    const courseVideoLessonsDuration = [];
    const courseTextLessonDuration = [];

    lessonsInCourse[0].lessons.forEach((lesson) => {
      if (lesson.type === 'TEXT') {
        courseTextLessonDuration.push(markdDownWordCount(lesson.markdown));
      } else {
        courseVideoLessonsDuration.push(lesson.durationInSeconds);
      }
    });

    const totalVideoLessonDuration = courseVideoLessonsDuration.reduce((duration, item) => {
      return duration + item;
    }, 0);
    const totalMarkdownLessonDuration = courseTextLessonDuration.reduce((duration, item) => {
      return duration + item;
    }, 0);

    const convertedVideoLessonDuration = +(totalVideoLessonDuration / 60).toFixed(2);
    const convertedMarkdownLessonDuration = +(totalMarkdownLessonDuration / 258).toFixed(2);
    const combinedCourseDuration = ((convertedVideoLessonDuration + convertedMarkdownLessonDuration) / 60).toFixed(2);
    const courseDuration = {
      time: combinedCourseDuration >= 1 ? combinedCourseDuration : parseInt(combinedCourseDuration * 60),
      unit: combinedCourseDuration >= 1 ? 'hours' : 'minutes'
    };

    const preceedingLesson = courseDetails.lessons.filter((lesson) => lesson.id === req.params.lessonId);
    const indexOfPreceeding = courseDetails.lessons.indexOf(preceedingLesson[0]);

    const lessonProgress = [];
    const lessons = await models.getModel('lessonprogress').find({ courseId: courseId, user: req.user.id });
    const lessonsUserHasCompleted = lessons.filter((lesson) => lesson.progress === 1);

    const currentCourseAndAuthorId = await models
      .getModel('course_authors__user_courses')
      .find({ course_authors: courseId });
    const allActiveCourses = await models
      .getModel('course')
      .find({ where: { isPublished: 1, isDeleted: 0 }, select: ['title', 'image'] });
    const authorId = currentCourseAndAuthorId.map((author) => author.user_courses)[0];

    const authorsCourses = await models
      .getModel('course_authors__user_courses')
      .find({ where: { user_courses: authorId }, select: ['course_authors'] });
    const courseIdsOfCoursesByAuthor = authorsCourses.map((course) => course.course_authors);
    const coursesByAuthor = allActiveCourses.filter(
      (course) => courseIdsOfCoursesByAuthor.includes(course.id) && course.id !== courseId
    );

    lessons.forEach((activeLesson) => {
      lesson = {
        id: activeLesson.lessonId,
        progress: activeLesson.progress
      };
      lessonProgress.push(lesson);
    });

    let showIntro = lessonProgress.length === 0;
    let isLastLesson = false;

    if (indexOfPreceeding === 0) {
      showIntro = true;

      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[indexOfPreceeding].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let latestLessonId = currentLesson.id;
      let lessonStartTime = 0;
      let videoStartTime = 0;

      if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
          if (lessonIsActive.length > 0) {
            lessonStartTime = lessonIsActive[0].progress;
            videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
            currentLesson.videoStartTime = videoStartTime;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      }
    } else {
      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[indexOfPreceeding - 1].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let latestLessonId = currentLesson.id;
      let lessonStartTime = 0;
      let videoStartTime = 0;

      if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          let lessonIsActive = lessonProgress.filter((lesson) => lesson.id === latestLessonId);
          if (lessonIsActive.length > 0) {
            lessonStartTime = lessonIsActive[0].progress;
            videoStartTime = lessonStartTime * currentLesson.durationInSeconds;
            currentLesson.videoStartTime = videoStartTime;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      }
    }
    const tagsOfCourse = await getTagsOfOneCourse(courseId);
    const tags = tagsOfCourse.map((tag) => {
      return { label: tag };
    });

    const courseLessons = courseDetails.lessons;
    const { id, title, description, image, coursePreRequisites, courseAudience, authors } = courseDetails;
    const course = {
      id,
      title,
      description,
      image,
      coursePreRequisites,
      courseAudience,
      authors
    };

    const currentLessonNumber = indexOfPreceeding;

    return res.status(HttpStatus.OK).send({
      course: course,
      currentLesson: currentLesson,
      tags: tags,
      lessonsProgress: lessonProgress,
      courseLessons: courseLessons,
      completedLessons: lessonProgress.filter((lesson) => lesson.progress === 1).length,
      showIntro,
      isLastLesson,
      currentLessonNumber,
      coursesByAuthor,
      courseDuration
    });
  })
);

router.get(
  '/uploadMarkdown/:lesson',
  asyncMiddleware(async (req, res) => {
    const lessonTitle = req.params.lesson;

    const models = await initModels();
    const Lesson = models.getModel('lesson');

    const lesson = await Lesson.find({ title: lessonTitle });

    res.status(HttpStatus.Ok).send({
      role: req.role,
      lessonTitle,
      lesson,
      markdown: lesson[0].markdown
    });
  })
);

router.get(
  '/lessonMarkDown/:lessonId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    let lessons = await models.getModel('lesson').find({ id: req.params.lessonId });

    return res.status(HttpStatus.OK).send({ lessons });
  })
);

router.get(
  '/uploadMarkdown/:lesson',
  asyncMiddleware(async (req, res) => {
    const lessonTitle = req.params.lesson;

    const models = await initModels();
    const Lesson = models.getModel('lesson');

    const lesson = await Lesson.find({ title: lessonTitle });

    res.status(HttpStatus.Ok).send({
      role: req.role,
      lessonTitle,
      lesson,
      markdown: lesson[0].markdown
    });
  })
);

router.post(
  '/lessonTitle',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Lesson = models.getModel('lesson');

    const { title, course } = req.body;

    const searchedLesson = await Lesson.find({ title: title, course: course });

    if (searchedLesson.length === 0) {
      const lesson = {
        title: titleCasing(title),
        type: '',
        source: '',
        course: course,
        durationInSeconds: 0,
        order: 0,
        markdown: '',
        category: ''
      };

      await addLessonWithOnlyAuthor(lesson, req.user);

      return res.status(HttpStatus.OK).send({
        success: false
      });
    }

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.put(
  '/orderlessons',
  asyncMiddleware(async (req, res) => {
    let { lessonBeingMoved, orderedLessons } = req.body;

    const models = await initModels();
    const Lesson = models.getModel('lesson');

    let newLessonOrderNumber = 0;
    for (let counter = 0; counter < orderedLessons.length; counter++) {
      if (orderedLessons[counter].course == lessonBeingMoved.course) {
        await Lesson.update({
          id: orderedLessons[counter].id
        }).set({
          order: newLessonOrderNumber++
        });
      }
    }

    return res.status(HttpStatus.OK).send(req.body);
  })
);

router.post(
  '/:courseId/lessons/:lessonId/EditLesson',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Lesson = models.getModel('lesson');

    const { lessonId, type, courseId } = req.params;

    const { title, markdown } = req.body;

    const updatedLesson = await Lesson.update({ id: lessonId })
      .set({
        title: titleCasing(title),
        type: type,
        markdown: markdown
      })
      .fetch();

    await updateCourseWhenLessonIsEdited(lessonId, courseId);

    return res.status(HttpStatus.OK).send(updatedLesson);
  })
);

router.post(
  '/uploadMarkdown/:lesson',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Lesson = models.getModel('lesson');

    await Lesson.update({
      title: titleCasing(req.params.lesson)
    }).set({
      markdown: req.body.markdown
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/:courseId/lessons/:lessonId/edit',
  asyncMiddleware(async (req, res) => {
    const { courseId, lessonId } = req.params;

    const models = await initModels();
    const course = await findOneCourse(courseId);

    const lesson = await models.getModel('lesson').findOne(lessonId);

    return res.status(HttpStatus.OK).send({
      course,
      lesson
    });
  })
);

router.post(
  '/:courseId/lessons/:lessonId/edit',
  asyncMiddleware(async (req, res) => {
    const { lessonId } = req.params;
    const { markdown } = req.body;

    const models = await initModels();

    await updateLessonMarkdown({ lessonId, markdown, userId: req.user.id });

    await models
      .getModel('lesson')
      .update({
        id: lessonId
      })
      .set({
        markdown
      });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/lessonId/:lessonId/duration',
  asyncMiddleware(async (req, res) => {
    const { lessonId } = req.params;

    const models = await initModels();
    const Lesson = models.getModel('lesson');

    await Lesson.update({
      id: lessonId
    }).set({
      durationInSeconds: req.body.lessonDuration
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/:courseId/lessons/:lessonId/upload/:fileExtension',
  asyncMiddleware(async (req, res, next) => {
    const { courseId, lessonId, fileExtension } = req.params;
    const pathToDestinationFolder = path.join(__dirname, '/../public/uploads');

    const diskStorage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, pathToDestinationFolder);
      },
      filename: (_req, _file, cb) => {
        cb(null, `${courseId}-${lessonId}.${fileExtension}`);
      }
    });

    const uploadMulter = multer({ storage: diskStorage });

    uploadMulter.single('lessonToBeUploaded')(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      await updateLessonUrl(lessonId, `${pathToDestinationFolder}`);
      return res.status(HttpStatus.OK).send({ success: true });
    });
  })
);

router.delete(
  '/:courseId/lessons/:lessonId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const TrueOrFalseQuestion = await models.getModel('trueorfalsequestion').destroy({ lessonId: req.params.lessonId });
    const MultipleChoiceQuestion = await models
      .getModel('multiplechoicequestion')
      .destroy({ lessonId: req.params.lessonId });
    await deleteLesson(req.params.lessonId);

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);
router.post(
  '/:courseId/lessons/:lessonId/move/:direction',
  asyncMiddleware(async (req, res) => {
    const { courseId, lessonId, direction } = req.params;

    await moveLesson({ courseId, lessonId, direction });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const lesson = models.getModel('lesson');
    const presentation = models.getModel('presentation');

    const { title, type, duration } = req.body;

    const { courseId, user } = req.params;

    if (type === 'PRESENTATION')
      return (createdPresentation = await presentation
        .create({
          title: titleCasing(title),
          slides: '',
          author: req.user.name,
          createdBy: 'admin',
          transitionType: 'none'
        })
        .fetch());

    await lesson
      .create({
        title: titleCasing(title),
        type: type,
        markdown: '',
        durationInSeconds: duration,
        order: await getPreviousLessonOrderNumber(courseId),
        course: courseId,
        user: user
      })
      .fetch();

    await assignAuthorToCourse(courseId, req.user.id);

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/continueWhereILeftOff',
  asyncMiddleware(async (req, res) => {
    const getContinueWhereILeftOff = await continueWhereILeftOff(req.user);

    return res.status(HttpStatus.OK).send(getContinueWhereILeftOff);
  })
);

router.post(
  '/:courseId/lessons/:lessonId/record-progress',
  asyncMiddleware(async (req, res) => {
    const { lessonId, courseId } = req.params;
    const { progress } = req.body;
    const models = await initModels();
    const LessonProgress = models.getModel('lessonprogress');
    const User = models.getModel('user');
    var date = new Date();
    const userId = req.user.id;

    const completedLesson = await LessonProgress.find({ lessonId: lessonId, user: userId, progress: { '>=': 0.95 } });
    const lessonInProgress = await LessonProgress.find({ lessonId: lessonId, user: userId });

    if (lessonInProgress.length === 0 && completedLesson.length === 0) {
      await LessonProgress.create({
        lessonId: lessonId,
        courseId: courseId,
        user: userId,
        date: date.toDateString(),
        progress: 0
      });

      const lessonprogress = await LessonProgress.update(
        {
          user: userId,
          lessonId: lessonId,
          progress: { '<': progress }
        },
        {
          progress: progress,
          date: date.toDateString()
        }
      );
    } else if (lessonInProgress.length > 0 && completedLesson.length === 0) {
      const lessonprogress = await LessonProgress.update(
        {
          user: userId,
          lessonId: lessonId,
          progress: { '<': progress }
        },
        {
          progress: progress,
          date: date.toDateString()
        }
      );
    } else {
      return res.status(HttpStatus.OK).send({ success: true, lessonAlreadyCompleted: true });
    }

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.put(
  '/complete-lesson/:lessonId/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const LessonProgress = await models.getModel('lessonprogress');
    const lessonId = req.params.lessonId;
    const courseId = req.params.courseId;
    var date = new Date();
    findLessonProgress = await LessonProgress.find({
      user: req.user.id,
      lessonId: lessonId,
      courseId: courseId
    });
    if (!findLessonProgress[0]) {
      await LessonProgress.create({
        user: req.user.id,
        lessonId: lessonId,
        courseId: courseId,
        progress: 0,
        date: date.toDateString()
      });
    }
    completedLessonProgress = await LessonProgress.update({ user: req.user.id, lessonId: lessonId, courseId: courseId })
      .set({
        progress: 1,
        date: date.toDateString()
      })
      .fetch();
    await saveLatestCourseCompleted(req.user.name);
    return res.status(HttpStatus.OK).send(completedLessonProgress);
  })
);

router.post(
  '/completed-course/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const course = await models.getModel('course').findOne({ id: req.params.courseId });
    const courseId = req.params.courseId;
    const userId = req.user.id;
    var date = new Date();
    const LessonProgress = await models.getModel('lessonprogress');

    const completeLessonProgress = await LessonProgress.find({
      courseId: courseId,
      user: userId,
      progress: 1
    });

    const uniqCompleteLessonProgress = [];

    await completeLessonProgress.forEach((lesson) => {
      if (uniqCompleteLessonProgress.length === 0) {
        uniqCompleteLessonProgress.push(lesson);
      } else if (
        uniqCompleteLessonProgress.filter((resp) => resp.user === lesson.user && resp.lessonId === lesson.lessonId)
          .length > 0
      ) {
        //pass
      } else {
        uniqCompleteLessonProgress.push(lesson);
      }
    });

    const totalLessonOfCourse = await models.getModel('lesson').find({
      course: req.params.courseId
    });
    const Course = models.getModel('completedcourse');
    const coursesCompleted = await Course.find({ userId: userId, courseId: courseId });

    if (coursesCompleted.length === 0) {
      if (totalLessonOfCourse.length === uniqCompleteLessonProgress.length) {
        await addCompletedCourse({
          courseId: courseId,
          userId: userId,
          username: req.user.name,
          courseName: titleCasing(course.title),
          date: date.toDateString(),
          image: course.image
        });

        await LessonProgress.destroy({
          courseId: courseId,
          user: userId,
          progress: 1
        });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
      }
      return res.status(HttpStatus.OK).send({ success: true });
    }
    return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
  })
);

router.post(
  '/:courseId/lessons/:lessonId/edit',
  asyncMiddleware(async (req, res) => {
    const { lessonId } = req.params;
    const { markdown } = req.body;
    const models = await initModels();

    await updateLessonMarkdown({
      lessonId,
      markdown,
      userId: req.user.id
    });

    await models.getModel('lesson').update({ id: lessonId }).set({ markdown });

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.get(
  '/:courseId/lessons/:lessonId/edit',
  asyncMiddleware(async (req, res) => {
    const { courseId, lessonId } = req.params;
    const models = await initModels();
    const course = await findOneCourse(courseId);
    const lesson = await models.getModel('lesson').findOne(lessonId);

    res.status(HttpStatus.OK).send({
      course,
      lesson,
      heading: `Editing markdown for: ${lesson.title}`,
      role: req.role
    });
  })
);

router.get(
  '/:courseId/lessons/:lessonId/contributions',
  asyncMiddleware(async (req, res) => {
    const { lessonId, courseId } = req.params;

    const { lesson, snapshots } = await getContributions(lessonId);

    res.status(HttpStatus.OK).send({
      lesson,
      snapshots,
      course,
      role: req.role
    });
  })
);

router.post(
  '/:courseId/addLesson',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const lesson = models.getModel('lesson');

    await lesson
      .create({
        title: titleCasing(req.body.title),
        type: req.body.type,
        markdown: req.body.markdown,
        durationInSeconds: req.body.duration,
        order: 800,
        course: req.params.courseId,
        user: req.params.user
      })
      .fetch();
    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.post(
  '/:courseId/lessons',
  asyncMiddleware(async (req, res) => {
    const lesson = await addLesson({
      lesson: Object.assign(req.body, { course: req.params.courseId }),
      author: req.user
    });
    return res.status(HttpStatus.OK).send(lesson);
  })
);

router.post(
  '/:courseId/lessons/:lessonId/move/:direction',
  asyncMiddleware(async (req, res) => {
    const { courseId, lessonId, direction } = req.params;
    await moveLesson({ courseId, lessonId, direction });
    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.get(
  '/:courseId/:lessonId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const lesson = models.getModel('lesson');

    await lesson.destroy({ id: req.params.lessonId });

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.delete(
  '/:courseId/lessons/:lessonId',
  asyncMiddleware(async (req, res) => {
    await deleteLesson(req.params.lessonId);
    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.get(
  '/:courseId/lessons/:lessonId',
  asyncMiddleware(async (req, res) => {
    const { courseId, lessonId } = req.params;
    const { user } = req;
    const courseWithProgress = await findOneCourse(courseId, user);
    const lesson = await getLessonWithContributors({
      lessonId,
      courseWithProgress,
      role: req.role
    });

    const models = await initModels();
    const TrueOrFalseQuestion = await models.getModel('trueorfalsequestion');
    const trueOrFalseQuestion = await TrueOrFalseQuestion.find({
      courseId: req.params.courseId,
      lessonId: req.params.lessonId
    }).limit(1);

    const MultipleChoiceQuestion = models.getModel('multiplechoicequestion');
    const multipleChoiceQuestion = await MultipleChoiceQuestion.find({
      courseId: req.params.courseId,
      lessonId: req.params.lessonId
    }).limit(1);

    res.status(HttpStatus.OK).send({
      multipleChoiceQuestion,
      trueOrFalseQuestion,
      course: courseWithProgress,
      lesson,
      heading: lesson.title,
      role: req.role
    });
  })
);

module.exports = router;
