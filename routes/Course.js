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
const initModels = require('../models/');
const router = express.Router();
const _ = require('lodash');
const HttpStatus = require('http-status-codes');
const {
  getArchivedCoursesByUser,
  getCourseStats,
  findCourseByTitle,
  renderCourse,
  renderCourse_,
  findOneCourse,
  findInitialisingCourse,
  findAllCourses,
  sendEmailWhenCourseIsCompleted,
  findUserAndCompletedCoursesFromDb,
  findCoursesWithUserProgress,
  getFavouriteCourses,
  getUsersAssociatedWithThisCourse,
  findCourseByAuthor,
  findCoursesbySubstring,
  getTagsOfOneCourse,
  deactivateAuthorsCourses,
  activateAuthorsCourses,
  findCourses,
  titleCasing,
  getReviews,
  getUsersEmails,
  getActiveCoursesAuthoredByUser
} = require('../services/courseService');
const { getLatestCourse, getLessonWithContributors, markdDownWordCount } = require('../services/lessonService');
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

router.get(
  '/getCoursesBySearch/:searchString',
  asyncMiddleware(async (req, res) => {
    courses = await findCoursesbySubstring(req.params.searchString);
    const matchingCourses = courses.filter((x) => x.isDeleted === 0);
    return res.status(HttpStatus.OK).send(matchingCourses);
  })
);

router.post(
  '/addCourse/',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = await models.getModel('course');
    const courses = await Course.find({});

    const coursesMatched = courses.filter((course) => course.title === req.body.title);

    const { title, image, description, isPublished, coursePreRequisites, courseAudience, courseLevel } = req.body;

    if (coursesMatched.length === 0) {
      const createdCourse = await Course.create({
        title: titleCasing(title),
        image: image,
        description: description,
        isPublished: isPublished,
        coursePreRequisites: coursePreRequisites,
        courseAudience: courseAudience,
        courseLevel: courseLevel
      }).fetch();
      await Course.addToCollection(createdCourse.id, 'authors', req.user.id);
      return res.status(HttpStatus.OK).send({ success: true, course: createdCourse });
    }

    return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
  })
);

router.post(
  '/index',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');
    var imageName = req.body.imageName;

    const courses = await findCourseByTitle(req.body.title);

    switch (courses.length) {
      case 0:
        if (req.file) {
          IMAGE = req.file.originalname;
        }
        if (!req.file) {
          IMAGE = process.env.DEFAULTIMAGEURL;
        }
        if (imageName != '') {
          IMAGE = req.body.imageName;
        }
        const createdCourse = await Course.create({
          title: titleCasing(req.body.title),
          image: IMAGE,
          description: req.body.description
        }).fetch();

        await Course.addToCollection(createdCourse.id, 'authors', req.user.id);

        return res.status(HttpStatus.OK).send({
          courseTitleExists: false,
          course: createdCourse
        });

      default:
        return res.status(HttpStatus.OK).send({
          courseTitleExists: true,
          course: courses
        });
    }
  })
);

router.post(
  '/index/update',
  upload.single('courseimage'),
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const { title, description, courseId } = req.body;

    if (req.file) return (IMAGE = req.file.originalname);

    IMAGE = process.env.DEFAULTIMAGEURL;

    const Editedcourse = await Course.update({
      id: courseId
    })
      .set({
        title: titleCasing(title),
        image: IMAGE,
        description: description
      })
      .fetch();

    return res.status(HttpStatus.OK).send(Editedcourse);
  })
);

router.put(
  '/updateCourseTitle',
  upload.single('courseimage'),
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const { courseId, title, image, description, courseLevel } = req.body;

    const Editedcourse = await Course.updateOne({
      id: courseId
    })
      .set({
        title: titleCasing(title),
        image: image,
        description: description,
        courseLevel: courseLevel
      })
      .fetch();

    return res.status(HttpStatus.OK).send(Editedcourse);
  })
);

router.put(
  '/updateCourseIcon',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const { courseId, image } = req.body;

    const Editedcourse = await Course.update({ id: courseId })
      .set({
        image: image
      })
      .fetch();

    return res.status(HttpStatus.OK).send(Editedcourse);
  })
);

router.put(
  '/deleteCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    await Course.update({
      id: req.params.courseId
    }).set({
      isDeleted: 1
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/delete/courses/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const courseDeleted = await Course.update({
      id: req.params.courseId
    }).set({
      isDeleted: 1
    });

    if (!courseDeleted) return res.status(400).send('`The id provided does not exist.');

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/:courseId/editCourse',
  upload.single('courseimage'),
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    if (!req.file) return (IMAGE = req.file);
    IMAGE = req.file.originalname;

    const { titleEdit, descriptionEdit } = req.body;

    await Course.update({ id: req.params.courseId }).set({
      title: titleCasing(titleEdit),
      image: IMAGE,
      description: descriptionEdit
    });

    await renderCourse(req, res, false);
  })
);

router.get(
  '/decrease/numberOfLessonsToAdd/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const { courseId } = req.params;

    const course = await findOneCourse(courseId, req.user);

    await Course.update({
      id: courseId
    }).set({
      numberOfLessonsToAdd: course.numberOfLessonsToAdd - 1
    });

    await renderCourse(req, res, false);
  })
);

router.get(
  '/add/numberOfLessonsToAdd/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const course = await findOneCourse(req.params.courseId, req.user);

    await Course.update({ id: req.params.courseId }).set({
      numberOfLessonsToAdd: course.numberOfLessonsToAdd + 1
    });

    await renderCourse(req, res, false);
  })
);

router.put(
  '/undoDeleteCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    await Course.update({
      id: req.params.courseId
    }).set({
      isDeleted: 0
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/:courseId/upload',
  asyncMiddleware(async (req, res, next) => {
    const { courseId } = req.params;

    const pathToDestinationFolder = path.join(__dirname, '/../public/course_categories');

    const diskStorage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, pathToDestinationFolder);
      },
      filename: (_req, _file, cb) => {
        cb(null, `${courseId}`);
      }
    });

    const uploadMulter = multer({ storage: diskStorage });

    uploadMulter.single('image-clip')(req, res, async (err) => {
      if (err) {
        return next(err);
      }
      await updateImageUrl(courseId, pathToDestinationFolder);
      return res.status(HttpStatus.OK).send({ success: true });
    });
  })
);

router.get(
  '/coursesByTitle/:title',
  asyncMiddleware(async (req, res) => {
    courses = await findCourseByTitle(req.params.title);

    if (courses.length === 0) return res.status(HttpStatus.OK).send({ success: false });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/courseIcons',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const ImageForCourse = models.getModel('imageforcourse');

    const courseIconsBasedOnChosenCategories = await ImageForCourse.find({});

    return res.status(HttpStatus.OK).send(courseIconsBasedOnChosenCategories);
  })
);

router.get(
  '/index',
  asyncMiddleware(async (req, res) => {
    const courses = await findAllCourses(req.user);

    return res.status(HttpStatus.OK).send({
      courses,
      role: req.role
    });
  })
);

router.get(
  '/getFavouriteCourses',
  asyncMiddleware(async (req, res) => {
    const favouriteCourses = await getFavouriteCourses(req.user.id);

    return res.status(HttpStatus.OK).send(favouriteCourses);
  })
);

router.get(
  '/getLatestCourse',
  asyncMiddleware(async (req, res) => {
    const foundLatestCourse = await getLatestCourse();

    return res.status(HttpStatus.OK).send(foundLatestCourse);
  })
);

router.post(
  '/editCourse',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    await Course.update({ title: req.body.title }).set({
      title: titleCasing(req.body.titleUpdate),
      image: '149373.svg',
      description: req.body.descriptionUpdate
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/reviews/:courseId',
  asyncMiddleware(async (req, res) => {
    const userReviews = await getReviews(req.params.courseId);
    return res.status(HttpStatus.OK).send({
      getAllReviewsAssociatedWithCourse: userReviews
    });
  })
);

router.post(
  '/rateCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Rating = models.getModel('rating');

    var date = new Date();
    const courseId = await req.params.courseId;

    const userId = await req.user.id;
    const userName = await req.user.name;
    const image = await req.user.image;
    const userSurname = await req.user.surname;

    const userRatingForCourse = await Rating.findOne({
      courseId: courseId,
      userId: userId
    });
    if (!userRatingForCourse || userRatingForCourse === undefined) {
      await Rating.create({
        courseId: courseId,
        courseTitle: titleCasing(req.body.courseTitle),
        userId: userId,
        userName: userName,
        userSurname: userSurname,
        userImage: image,
        userRating: req.body.userRating,
        userComment: req.body.userComment,
        date: date.toDateString()
      }).fetch();
    } else {
      await Rating.update({
        courseId: courseId,
        userId: userId
      })
        .set({
          courseTitle: titleCasing(req.body.courseTitle),
          userName: userName,
          userSurname: userSurname,
          userRating: req.body.userRating,
          userComment: req.body.userComment,
          date: date.toDateString()
        })

        .fetch();
    }

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.put(
  '/averageCourseRating/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Rating = models.getModel('rating');
    const Course = models.getModel('course');

    const courseId = await req.params.courseId;

    const ratingsForCourse = await Rating.find({ courseId: courseId });

    let totalRatings = 0;

    let averageRating = 0;

    const numberOfRatings = ratingsForCourse.length;

    ratingsForCourse.forEach((rating) => {
      totalRatings += rating.userRating;
    });

    if (numberOfRatings > 0) {
      averageRating = totalRatings / numberOfRatings;

      await Course.update({
        id: courseId
      })
        .set({
          rating: averageRating
        })
        .fetch();
    }

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/userDetailsForCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const courseId = await req.params.courseId;
    const usersAssociatedWithCourse = await getUsersAssociatedWithThisCourse(courseId);

    return res.status(HttpStatus.OK).send(usersAssociatedWithCourse);
  })
);

router.get(
  '/getAllCourses',
  asyncMiddleware(async (req, res) => {
    const courses = await findCourses(req.user);
    return res.status(HttpStatus.OK).send({
      items: courses
    });
  })
);

router.get(
  '/getCoursesbyAuthor',
  asyncMiddleware(async (req, res) => {
    const coursesAuthoredByUser = await getActiveCoursesAuthoredByUser(req.user.id);

    return res.status(HttpStatus.OK).send({
      items: coursesAuthoredByUser
    });
  })
);

router.get(
  '/getCourseStats',
  asyncMiddleware(async (req, res) => {
    const coursesAuthoredByUser = await getCourseStats(req.user.id);

    return res.status(HttpStatus.OK).send({
      items: coursesAuthoredByUser
    });
  })
);

router.get(
  '/getArchivedCoursesbyAuthor',
  asyncMiddleware(async (req, res) => {
    const archivedCourses = await getArchivedCoursesByUser(req.user.id);
    return res.status(HttpStatus.OK).send({
      items: archivedCourses
    });
  })
);

router.post(
  '/editCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Course = models.getModel('course');

    const { title, image, description, coursePreRequisites, courseAudience, courseLevel } = req.body;

    await Course.updateOne({ id: req.params.courseId }).set({
      title: titleCasing(title),
      image: image,
      description: description,
      coursePreRequisites: coursePreRequisites,
      courseAudience: courseAudience,
      courseLevel: courseLevel
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/getCourse/:courseId/',
  asyncMiddleware(async (req, res) => {
    const courseId = req.params.courseId;
    const courseDetails = await findInitialisingCourse(courseId, req.user);

    const models = await initModels();
    const Lesson = models.getModel('lesson');
    const bookMarks = models.getModel('bookmark');
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

    if (lessonProgress.length > 0 && lessonsUserHasCompleted.length <= courseDetails.lessons.length) {
      let latestLessonId = null;
      let lessonStartTime = 0;
      let lessonIds = courseDetails.lessons.map((lesson) => lesson.id);
      let completedLessonIds = lessonProgress.filter((lesson) => lesson.progress === 1).map((lesson) => lesson.id);

      lessonProgress.forEach((lesson) => {
        if (lesson.progress > 0 && lesson.progress < 1) {
          latestLessonId = lesson.id;
          lessonStartTime = lesson.progress;
        }
      });

      if (latestLessonId === null) {
        latestLessonId = lessonIds.filter((lesson) => completedLessonIds.includes(lesson) === false);
        lessonStartTime = 0;

        if (latestLessonId.length > 0) {
          var currentLesson = await Lesson.findOne({
            where: { id: latestLessonId[0] },
            select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
          })
            .populate('trueOrFalseQuestions')
            .populate('multipleChoiceQuestions')
            .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

          if (currentLesson.type === 'VIDEO') {
            let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
            currentLesson.videoStartTime = 0;
            currentLesson.bookMarks = lessonBookMarks;
          }
        } else {
          var currentLesson = await Lesson.findOne({
            where: { id: lessonIds[0] },
            select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
          })
            .populate('trueOrFalseQuestions')
            .populate('multipleChoiceQuestions')
            .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

          if (currentLesson.type === 'VIDEO') {
            let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
            currentLesson.videoStartTime = 0;
            currentLesson.bookMarks = lessonBookMarks;
          }
        }
      } else {
        var currentLesson = await Lesson.findOne({
          where: { id: latestLessonId },
          select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
        })
          .populate('trueOrFalseQuestions')
          .populate('multipleChoiceQuestions')
          .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

        let videoStartTime = lessonStartTime * currentLesson.durationInSeconds;

        if (currentLesson.type === 'VIDEO') {
          let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
          currentLesson.videoStartTime = videoStartTime;
          currentLesson.bookMarks = lessonBookMarks;
        }
      }

      lessonIds = [];
      courseDetails.lessons.forEach((lesson) => lessonIds.push(lesson.id));

      var indexOfCurentLesson = lessonIds.indexOf(currentLesson.id);

      if (indexOfCurentLesson + 1 === courseDetails.lessons.length) {
        isLastLesson = true;
      }
    } else {
      var currentLesson = await Lesson.findOne({
        where: { id: courseDetails.lessons[0].id },
        select: ['title', 'course', 'source', 'type', 'durationInSeconds', 'markdown']
      })
        .populate('trueOrFalseQuestions')
        .populate('multipleChoiceQuestions')
        .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

      let videoStartTime = 0;

      if (currentLesson.type === 'VIDEO') {
        let lessonBookMarks = await bookMarks.find({ lessonId: currentLesson.id });
        currentLesson.videoStartTime = videoStartTime;
        currentLesson.bookMarks = lessonBookMarks;
      }

      lessonIds = [];
      courseDetails.lessons.forEach((lesson) => lessonIds.push(lesson.id));

      let indexOfCurentLesson = lessonIds.indexOf(currentLesson.id);

      if (indexOfCurentLesson + 1 === courseDetails.lessons.length) {
        isLastLesson = true;
      }
    }

    const tagsOfCourse = await getTagsOfOneCourse(courseId);
    const tags = tagsOfCourse.map((tag) => {
      return { label: tag };
    });

    const currentLessonNumber = indexOfCurentLesson + 1;
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
  '/:courseId/edit',
  asyncMiddleware(async (req, res) => {
    await renderCourse_(req, res, true);
  })
);

router.get(
  '/:courseId/edit',
  asyncMiddleware(async (req, res) => {
    await renderCourse_(req, res, false);
  })
);

router.post(
  '/favourite',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Favourite = models.getModel('favourite');
    const favourite = await Favourite.findOrCreate(
      {
        courseId: req.body.courseId,
        userId: req.user.id
      },
      {
        courseId: req.body.courseId,
        userId: req.user.id,
        status: 0
      }
    );
    let updatedFavourite = [];
    switch (favourite.status) {
      case 0:
        updatedFavourite.push(
          await Favourite.update({
            courseId: req.body.courseId,
            userId: req.user.id
          })
            .set({
              courseId: req.body.courseId,
              userId: req.user.id,
              status: 1
            })
            .fetch()
        );
        break;
      case 1:
        updatedFavourite.push(
          await Favourite.update({
            courseId: req.body.courseId,
            userId: req.user.id
          })
            .set({
              courseId: req.body.courseId,
              userId: req.user.id,
              status: 0
            })
            .fetch()
        );
        break;
    }

    return res.status(HttpStatus.OK).send(updatedFavourite[0][0]);
  })
);

router.get(
  '/user/:userId/:authorFilter',
  asyncMiddleware(async (req, res) => {
    const courses = await findCourseByAuthor(req.user, req.params.userId);
    res.send('courses/list', {
      courses,
      heading: 'Filter Courses By Author: ' + req.params.authorFilter,
      role: req.role
    });
  })
);

router.get(
  '/watching/:courseId/:lessonId',
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

    res.send('watching', {
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
  '/completedCourses',
  asyncMiddleware(async (req, res) => {
    const courses = await findAllCourses(req.user);
    await sendEmailWhenCourseIsCompleted(courses, req.user);
    return res.status(HttpStatus.OK).send(courses);
  })
);

router.put(
  '/deactivateCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const deactivatedCourse = await models
      .getModel('course')
      .update({ id: req.params.courseId })
      .set({ isPublished: 0 });

    res.status(HttpStatus.OK).send({ success: true });
  })
);

router.put(
  '/activateCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const activatedCourse = await models.getModel('course').update({ id: req.params.courseId }).set({ isPublished: 1 });

    res.status(HttpStatus.OK).send({ success: true });
  })
);

router.put(
  '/activateCourseReview/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const activatedCourse = await models.getModel('rating').update({ id: req.params.courseId }).set({ isPublished: 1 });

    res.status(HttpStatus.OK).send({ success: true });
  })
);

router.put(
  '/deactivateCourseReview/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const deactivatedCourse = await models
      .getModel('rating')
      .update({ id: req.params.courseId })
      .set({ isPublished: 0 });

    res.status(HttpStatus.OK).send({ success: true });
  })
);

router.put(
  '/deactivateCoursesByAuthor/:authorId',
  asyncMiddleware(async (req, res) => {
    const deactivatedCourses = await deactivateAuthorsCourses(req.params.authorId);

    res.status(HttpStatus.OK).send(deactivatedCourses);
  })
);

router.put(
  '/activateCoursesByAuthor/:authorId',
  asyncMiddleware(async (req, res) => {
    const activatedCourses = await activateAuthorsCourses(req.params.authorId);

    res.status(HttpStatus.OK).send(activatedCourses);
  })
);

router.post(
  '/removeCourseFromWatched/',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const removedCourse = await models
      .getModel('completedcourse')
      .update({ id: req.body.courseId })
      .set({ watched: 0 });

    res.status(HttpStatus.OK).send({ success: true });
  })
);

module.exports = router;
