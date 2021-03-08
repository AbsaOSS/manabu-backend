/*
 * Copyright 2020 ABSA Group Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const initModels = require('../models');
const showdown = require('showdown');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const path = require('path');
const multer = require('multer');
const sendmail = require('sendmail')();
const aws = require('aws-sdk');
const https = require('https');
const cors = require('cors');
const multerS3 = require('multer-s3');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });
const {
  findAllCourses,
  findOneCourse,
  findCourseByAuthor,
  findCoursesByTag,
  findUsersAndTheirCompletedCourses,
  findUsersWithProgress,
  findCourseByTitle,
  addTagToCourse,
  assignAuthorToCourse,
  findCourseWithTittle,
  getNumberOfFavouriteCourses,
  getNumberOfPeopleWhoCompletedCoursesForEveryCourse,
  mapOfNumberOfPeopleWatchingACourse,
  getYValuesForQuickStatsGraph,
  getActiveCoursesAuthoredByUser,
  getArchivedCoursesByUser,
  findUsersThatCompletedAuthoredCourses,
  courseStatisticsForAuthor,
  updateCourseWhenLessonIsEdited,
  getMostRecentCoursesByAuthor,
  getUsersAssociatedWithThisCourse,
  getSidePanelActiveCoursesAuthoredByUser,
  renderCourse,
  titleCasing,
  basicStatsOfUsersWatchingCoursesByAuthor,
  createAdminSidepanelCourseStatsStructure,
  createAdminSidePanelCourseStructure
} = require('../services/courseService');
const {
  updateLessonMarkdown,
  deleteLesson,
  moveLesson,
  updateLessonUrl,
  updateImageUrl,
  getPreviousLessonOrderNumber,
  addLessonWithOnlyAuthor,
  getPresentationAuthoredByUser
} = require('../services/lessonService');

const { updateUserImage } = require('../services/userService');
const markdownConverter = new showdown.Converter();

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
  '/adminPersonalInformation',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const favourite = models.getModel('favourite');
    const completedCourses = models.getModel('completedcourse');
    const lessonProgress = models.getModel('lessonprogress');
    const course = models.getModel('course');

    const courses = await course.find({ where: { and: [{ isDeleted: 0, isPublished: 1 }] } });
    const favouriteCourses = await favourite.find({ userId: req.user.id });
    const usersCompletedCourses = await completedCourses.find({ userId: req.user.id });
    const lessonsUserIsWatching = await lessonProgress.find({ where: { user: req.user.id }, select: ['courseId'] });

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

    return res.status(HttpStatus.OK).send({
      user,
      numberOfUsersFavouriteCourses,
      numberOfCompletedCoursesByUser,
      numberOfCoursesUserIsWatching
    });
  })
);

router.get(
  '/allUsers/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const user = models.getModel('user');
    const contributionRequestTracking = models.getModel('contributionrequesttracking');
    const authorsLinkedToCourses = models.getModel('course_authors__user_courses');

    const courseId = req.params.courseId;

    const contributionRequestsLinkedToCourseId = await contributionRequestTracking.find({ courseId: courseId });
    const authorsLinkedToCourseId = await authorsLinkedToCourses.find({ course_authors: courseId });

    const contributionRequestsUserIds = contributionRequestsLinkedToCourseId.map((course) => course.userId);
    const authorsCourseUserIds = authorsLinkedToCourseId.map((course) => course.user_courses);

    const combinedUserIds = [...new Set([...authorsCourseUserIds, ...contributionRequestsUserIds])];

    const users = await user.find({ select: ['id', 'name', 'surname', 'image'] });

    const usersNotLinkedToCourse = users.filter((user) => !combinedUserIds.includes(user.id));

    return res.status(HttpStatus.OK).send({ usersNotLinkedToCourse });
  })
);

router.get(
  '/sidePanelContent/',
  asyncMiddleware(async (req, res) => {
    const user = req.user;
    const coursesByAuthor = await getSidePanelActiveCoursesAuthoredByUser(req.user.id);
    const numberOfFavouriteCoursesForAuthor = await getNumberOfFavouriteCourses(req.user.id);
    const coursesWithBasicStats = await basicStatsOfUsersWatchingCoursesByAuthor(coursesByAuthor);
    const courseTitlesWithstats = createAdminSidepanelCourseStatsStructure(coursesWithBasicStats);
    const coursesAuthoredByUser = createAdminSidePanelCourseStructure(coursesByAuthor);

    const numberOfPeopleWhoAreWatchingCoursesByThisAuthor = coursesWithBasicStats.reduce(
      (accumulator, currentValue) => accumulator + currentValue.watching,
      0
    );
    const numberOfPeopleWhoCompletedCoursesByThisAuthor = coursesWithBasicStats.reduce(
      (accumulator, currentValue) => accumulator + currentValue.watched,
      0
    );

    return res.status(HttpStatus.OK).send({
      quickStats: {
        courseTitlesWithstats
      },
      adminProfile: {
        user,
        numberOfPeopleWhoAreWatchingCoursesByThisAuthor,
        numberOfPeopleWhoCompletedCoursesByThisAuthor,
        numberOfFavouriteCoursesForAuthor
      },
      coursesByAuthor: coursesAuthoredByUser
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
  '/quickStats',
  asyncMiddleware(async (req, res) => {
    const numberOfPeopleWhoCompletedCoursesForEveryCourse = await getNumberOfPeopleWhoCompletedCoursesForEveryCourse();

    const mapOfAmountOfPeopleWatchingACourse = await mapOfNumberOfPeopleWatchingACourse();

    const listOfYValues = await getYValuesForQuickStatsGraph();

    const maximumYValue = listOfYValues[listOfYValues.length - 1];

    const mostRecentCoursesOfAuthor = await getMostRecentCoursesByAuthor(req.user.id, 5);

    return res.status(HttpStatus.OK).send({
      mapOfAmountOfPeopleWatchingACourse,
      numberOfPeopleWhoCompletedCoursesForEveryCourse,
      mostRecentCoursesOfAuthor,
      listOfYValues,
      maximumYValue
    });
  })
);

router.post(
  '/presentation',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const foundPresentation = await Presentation.find({ title: req.body.title });

    if (foundPresentation.length === 1) return res.status(HttpStatus.OK).send({ presentationTitleExists: true });

    const createdPresentation = await Presentation.create({
      title: titleCasing(req.body.title),
      transitionType: req.body.transitionType,
      theme: req.body.theme,
      userId: req.user.id
    }).fetch();

    const lesson = {
      title: titleCasing(req.body.title),
      type: 'PRESENTATION',
      source: '/reveal/' + createdPresentation.id,
      course: req.body.courseId,
      durationInSeconds: '0',
      markdown: '',
      category: ''
    };

    const createdLesson = await addLessonWithOnlyAuthor(lesson, req.user);

    return res.status(HttpStatus.OK).send({
      lesson: createdLesson,
      presentation: createdPresentation,
      presentationTitleExists: false
    });
  })
);

router.get(
  '/presentations',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const foundPresentations = await Presentation.find({ userId: req.user.id });

    return res.status(HttpStatus.OK).send({
      presentations: foundPresentations
    });
  })
);

router.put(
  '/editPresentation',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const { presentationId, title, theme, transition, slides } = req.body;

    const Editedcourse = await Presentation.update({
      id: presentationId
    })
      .set({
        title: titleCasing(title),
        theme: theme,
        transitionType: transition,
        slides: slides
      })
      .fetch();

    return res.status(HttpStatus.OK).send(Editedcourse);
  })
);

router.get(
  '/presentation/:presentationId',
  asyncMiddleware(async (req, res) => {
    const foundPresentations = await getPresentationAuthoredByUser(req.params.presentationId);

    return res.status(HttpStatus.OK).send(foundPresentations);
  })
);

router.get(
  '/courseIconsBasedOnChosenCategories/:category',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const ImageForCourse = models.getModel('imageforcourse');

    const courseIconsBasedOnChosenCategories = await ImageForCourse.find({ category: req.params.category });

    return res.status(HttpStatus.OK).send(courseIconsBasedOnChosenCategories);
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

router.get(
  '/usersThatCompletedAuthoredCourses',
  asyncMiddleware(async (req, res) => {
    const usersThatCompletedAuthoredCourses = await findUsersThatCompletedAuthoredCourses(req.user.id);

    return res.status(HttpStatus.OK).send(usersThatCompletedAuthoredCourses);
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

router.get(
  '/userDetailsForCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const usersAssociatedWithCourse = await getUsersAssociatedWithThisCourse(req.params.courseId);
    return res.status(HttpStatus.OK).send(usersAssociatedWithCourse);
  })
);

router.delete(
  '/deleteTag/:tagId/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const course_tags__tag_courses = await models.getModel('course_tags__tag_courses');

    const { courseId, tagId } = req.params;

    const tag = await course_tags__tag_courses.findOne({
      course_tags: courseId,
      tag_courses: tagId
    });

    await models.getModel('tag').destroy({
      id: tag.tag_courses
    });

    return res.status(HttpStatus.OK).send({
      message: `Tag with label ${req.body.label} deleted successfully.`
    });
  })
);

router.post(
  '/addTagToCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    await addTagToCourse(req.body.tag, req.params.courseId);

    return res.status(HttpStatus.OK).send({
      message: `Tag with label ${req.body.tag} added successfully.`
    });
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
  '/user/:userId/:authorFilter',
  asyncMiddleware(async (req, res) => {
    const courses = await findCourseByAuthor(req.user, req.params.userId);

    return res.status(HttpStatus.OK).send({
      courses,
      role: req.role
    });
  })
);

router.get(
  '/tag/:tag_id/:tagFilter',
  asyncMiddleware(async (req, res) => {
    const courses = await findCoursesByTag(req.user, req.params.tag_id);

    return res.status(HttpStatus.OK).send({
      courses,
      role: req.role
    });
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

    const { courseId, title, image, description } = req.body;

    const Editedcourse = await Course.update({
      id: courseId
    })
      .set({
        title: titleCasing(title),
        image: image,
        description: description
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

router.get(
  '/:courseId',
  asyncMiddleware(async (req, res) => {
    await renderCourse(req, res, false);
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

router.get(
  '/uploadPresentation/:lesson/:slide/:courseid',
  asyncMiddleware(async (req, res) => {
    const { lesson, slide, courseid } = req.params;

    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const presentation = await Presentation.find({ title: lesson });

    slides = presentation[0].slides;

    return res.status(HttpStatus.OK).send({
      role: req.role,
      lesson,
      slidedata: slides,
      slide,
      courseId: courseid
    });
  })
);

router.post(
  '/uploadPresentation/:lesson/:slide',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const updatedPresentation = await Presentation.update({ title: req.params.lesson }).set({
      slides: req.body.testmarkdown
    });

    if (!updatedPresentation) return res.status(400).send(`The presentation id presented does not exist.`);

    return res.status(HttpStatus.OK).send(updatedPresentation);
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

router.put(
  '/:courseId/lessons/:lessonId/updateMultipleChoiceQuestion',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const MultipleChoiceQuestion = models.getModel('multiplechoicequestion');

    const { courseId, lessonId } = req.params;

    const { question, option1, option2, option3, option4, answer } = req.body;

    await MultipleChoiceQuestion.update({
      courseId: courseId,
      lessonId: lessonId
    }).set({
      question: question,
      option1: option1,
      option2: option2,
      option3: option3,
      option4: option4,
      answer: answer
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

router.delete(
  '/:courseId/lessons/:lessonId',
  asyncMiddleware(async (req, res) => {
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
  '/:courseId/lessons/:lessonId/upload/:fileExtension',
  asyncMiddleware(async (req, res, next) => {
    const { courseId, lessonId, fileExtension } = req.params;
    const pathToDestinationFolder = path.join(__dirname, '/../public/api/uploads');

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
  '/search/:search',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Tag = models.getModel('tag');
    const Author = models.getModel('user');

    const { search } = req.params;

    const tag = await Tag.findOne({ label: search });

    const author = await Author.findOne({ name: search });

    if (tag.length > 0) {
      const searchedByTag = await findCoursesByTag(req.user, tag.id);

      return res.status(HttpStatus.OK).send({ courses: searchedByTag, role: req.role });
    } else if (author.length > 0) {
      const searchByAuthor = await findCourseByAuthor(req.user, author.id);

      return res.status(HttpStatus.OK).send({ courses: searchByAuthor, role: req.role });
    }

    const searchByTitle = await findCourseWithTittle(req.user, search);

    if (searchByTitle) {
      return res.status(HttpStatus.OK).send({ courses: searchByTitle, role: req.role });
    } else {
      return res.status({ role: req.role });
    }
  })
);
module.exports = router;
