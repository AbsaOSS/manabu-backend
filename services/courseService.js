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
const getDurationFromSeconds = require('../lib/getDurationFromSeconds');
const _ = require('lodash');
const initModels = require('../models');
const showdown = require('showdown');
const markdownConverter = new showdown.Converter();
const HttpStatus = require('http-status-codes');
const sendmail = require('sendmail')();

async function getCoursesWithLessons() {
  const models = await initModels();
  const allCourses = await models.getModel('course').find().populate('tags').populate('authors').populate('lessons');

  const filteredCourses = allCourses.filter(
    (course) => course.lessons.length > 0 && course.isDeleted === 0 && course.isPublished === 1
  );

  return filteredCourses;
}

async function getCourses() {
  const models = await initModels();
  const allCourses = await models
    .getModel('course')
    .find({ sort: 'createdAt DESC' })
    .populate('authors', { select: ['name', 'surname', 'image'] })
    .populate('reviews', { select: ['date'] });

  const filteredCourses = allCourses.filter((course) => course.isDeleted === 0 && course.isPublished === 1);

  return filteredCourses;
}

async function getCourseStats(userId) {
  const coursesAuthoredByUser = await getCoursesToBeAnalysed(userId);
  const coursesWithQuizzes = await getCourseQuizCount(coursesAuthoredByUser);
  const coursesWithLessonTypeCounts = await getCourseLessonTypes(coursesWithQuizzes);
  const courses = basicStatsOfUsersWatchingCoursesByAuthor(coursesWithLessonTypeCounts);

  return courses;
}

async function renderCourse(req, res, isEditMode) {
  const models = await initModels();
  const { courseId } = req.params;

  const course = await findOneCourse(courseId, req.user);

  const MultipleChoiceQuestion = models.getModel('multiplechoicequestion');

  const getMultipleChoiceQuestion = await MultipleChoiceQuestion.find({ courseId: courseId });

  const TrueOrFalseQuestion = models.getModel('trueorfalsequestion');

  const trueOrFalseQuestion = await TrueOrFalseQuestion.find({ courseId: courseId });

  const readyForBindingCourse = Object.assign({}, course, {
    descriptionMarkdown: markdownConverter.makeHtml(course.description)
  });

  return res.status(HttpStatus.OK).send({
    course: readyForBindingCourse,
    isEditMode,
    numberOfLessonsToAdd: course.numberOfLessonsToAdd,
    role: req.role,
    multipleChoiceQuestions: getMultipleChoiceQuestion,
    trueOrFalseQuestion
  });
}

async function assignAuthorToCourse(courseId, userId) {
  const models = await initModels();
  const course_authors__user_courses = await models.getModel('course_authors__user_courses').create({
    course_authors: courseId,
    user_courses: userId
  });
  return course_authors__user_courses;
}

async function getCourseTitlesAuthoredByUser(userId) {
  const models = await initModels();
  const course_authors__user_courses = await models
    .getModel('course_authors__user_courses')
    .find({ user_courses: userId });
  const courses = await models.getModel('course').find();

  const courseAuthorId = course_authors__user_courses.map((course) => course.course_authors);

  const coursesByAuthor = courses.filter((course) => courseAuthorId.includes(course.id));

  const titles = coursesByAuthor.map((course) => course.title);

  return _.uniq(titles);
}

async function getCoursesAuthoredByUser(userId) {
  const models = await initModels();
  const course_authors__user_courses = await models
    .getModel('course_authors__user_courses')
    .find({ user_courses: userId });

  const Courses = await models
    .getModel('course')
    .find({})
    .populate('authors')
    .populate('tags')
    .populate('lessons', { sort: 'order ASC' });

  const authorIds = [];
  course_authors__user_courses.forEach((author) => authorIds.push(author.course_authors));

  const listOfCoursesAuthoredByUser = [];

  Courses.filter((course) => authorIds.includes(course.id)).forEach((course) => {
    const courseWithTagsAndLessons = Object.assign({}, course, {
      lessonTypeCounts: _.countBy(course.lessons, 'type'),
      tagCounts: course.tags.length,
      authorCounts: course.authors.length
    });
    listOfCoursesAuthoredByUser.push(courseWithTagsAndLessons);
  });

  return listOfCoursesAuthoredByUser;
}

async function getAnalysingCoursesByUser(userId) {
  const models = await initModels();
  const course_authors__user_courses = await models
    .getModel('course_authors__user_courses')
    .find({ user_courses: userId });
  const listOfCoursesAuthoredByUser = [];
  for (let i = 0; i < course_authors__user_courses.length; i += 1) {
    const course = await models
      .getModel('course')
      .find({ id: course_authors__user_courses[i].course_authors })
      .populate('lessons');
    if (course[0]) {
      const courseWithTagsAndLessons = Object.assign({}, course[0], {
        lessonTypeCounts: _.countBy(course[0].lessons, 'type')
      });
      listOfCoursesAuthoredByUser.push(courseWithTagsAndLessons);
    }
  }
  return listOfCoursesAuthoredByUser;
}

async function getSidePanelCoursesAuthoredByUser(userId) {
  const models = await initModels();
  const courses = await models.getModel('course').find({}).populate('lessons');
  const courseAndUserIdLink = await models.getModel('course_authors__user_courses').find({ user_courses: userId });

  const courseIdsOfCoursesAuthoredByUser = courseAndUserIdLink.map((link) => link.course_authors);
  const listOfCoursesAuthoredByUser = courses.filter((course) => courseIdsOfCoursesAuthoredByUser.includes(course.id));

  return listOfCoursesAuthoredByUser;
}

async function getActiveCoursesAuthoredByUser(userId) {
  const allCoursesByAuthor = await getCoursesAuthoredByUser(userId);

  const activeCourses = allCoursesByAuthor.filter((course) => course.isDeleted === 0);

  const activeCoursesWithQuizzes = await getCourseQuizCount(activeCourses);

  const activeCoursesWithLessonTypeCounts = await getCourseLessonTypes(activeCoursesWithQuizzes);

  const courses = createAdminCourseStructure(activeCoursesWithLessonTypeCounts);

  return courses;
}

async function getCoursesToBeAnalysed(userId) {
  const allCoursesByAuthor = await getAnalysingCoursesByUser(userId);

  const activeCourses = allCoursesByAuthor.filter((course) => course.isDeleted === 0);

  return activeCourses;
}

async function getSidePanelActiveCoursesAuthoredByUser(userId) {
  const allCoursesByAuthor = await getSidePanelCoursesAuthoredByUser(userId);

  const activeCourses = allCoursesByAuthor.filter((course) => course.isDeleted === 0);

  return activeCourses;
}

async function getArchivedCoursesByUser(userId) {
  const allCoursesByAuthor = await getCoursesAuthoredByUser(userId);

  const archivedCourses = allCoursesByAuthor.filter((course) => course.isDeleted === 1);

  const archivedCoursesWithQuizzes = await getCourseQuizCount(archivedCourses);

  const archivedCoursesWithLessonTypeCounts = await getCourseLessonTypes(archivedCoursesWithQuizzes);

  const courses = createAdminCourseStructure(archivedCoursesWithLessonTypeCounts);

  return courses;
}

async function getCourseQuizCount(courses) {
  const quizes = await numberOfQuizzesForCourse();
  const trueOrFalseQuestions = quizes[0];
  const multipleChoiceQuestions = quizes[1];

  courses.forEach((course) => {
    let courseTrueOrFalseQuestionsLength =
      trueOrFalseQuestions.length > 0 ? trueOrFalseQuestions.filter((quiz) => quiz.courseId === course.id).length : 0;

    let courseMultipleChoiceQuestionsLength =
      multipleChoiceQuestions.length > 0
        ? multipleChoiceQuestions.filter((quiz) => quiz.courseId === course.id).length
        : 0;

    quizzes = parseInt(courseTrueOrFalseQuestionsLength + courseMultipleChoiceQuestionsLength);

    course.numberOfQuizzes = quizzes;
  });

  return courses;
}

async function getCourseLessonTypes(courses) {
  courses.forEach((course) => {
    if (!course.lessonTypeCounts.hasOwnProperty('TEXT')) {
      course.lessonTypeCounts.TEXT = 0;
    }
    if (!course.lessonTypeCounts.hasOwnProperty('VIDEO')) {
      course.lessonTypeCounts.VIDEO = 0;
    }
  });

  return courses;
}

async function createAdminCourseStructure(courses) {
  const structuredCourses = [];

  courses.forEach((course) => {
    modifiedCourse = {
      id: course.id,
      title: course.title,
      description: course.description,
      image: course.image,
      lessonTypeCounts: course.lessonTypeCounts,
      tagCounts: course.tagCounts,
      authorCounts: course.authorCounts,
      numberOfQuizzes: course.numberOfQuizzes,
      isPublished: course.isPublished,
      rating: course.rating,
      courseLevel: course.courseLevel
    };
    structuredCourses.push(modifiedCourse);
  });

  return structuredCourses;
}

async function createAdminCourseStatsStructure(courses) {
  const structuredCourse = [];
  courses.forEach((course) => {
    modifiedCourse = {
      id: course.id,
      title: course.title,
      image: course.image,
      updatedAt: course.updatedAt,
      watching: course.watching,
      watched: course.watched,
      notStarted: course.notStarted,
      numberOfQuizzes: course.numberOfQuizzes,
      lessonTypeCounts: course.lessonTypeCounts
    };
    structuredCourse.push(modifiedCourse);
  });

  return structuredCourse;
}

function createAdminSidepanelCourseStatsStructure(courses) {
  const structuredCourse = [];
  courses.forEach((course) => {
    modifiedCourse = {
      title: course.title,
      watching: course.watching,
      watched: course.watched
    };
    structuredCourse.push(modifiedCourse);
  });

  return structuredCourse;
}

function createAdminSidePanelCourseStructure(courses) {
  const structuredCourse = [];
  courses.forEach((course) => {
    modifiedCourse = {
      id: course.id,
      title: course.title,
      image: course.image,
      updatedAt: course.updatedAt
    };
    structuredCourse.push(modifiedCourse);
  });

  return structuredCourse;
}

async function addTagToCourse(label, courseId) {
  const models = await initModels();
  const Tag = models.getModel('tag');
  const Course = models.getModel('course');

  const course = await Course.find({ id: courseId }).populate('tags');

  const tagLabelsOfCourse = course[0].tags.map((tag) => tag.label);

  if (tagLabelsOfCourse.includes(label)) {
    return;
  }

  const newTag = await Tag.create({ label: label }).fetch();

  await Course.addToCollection(courseId, 'tags', newTag.id);
}

async function addAuthorToCourse(authorId, courseId, lessonId) {
  const models = await initModels();
  const CourseAndAuthor = models.getModel('course_authors__user_courses');
  const LessonAndAuthor = models.getModel('lesson_authors__user_lessons');

  let courseAndAuthor = await CourseAndAuthor.findOne({
    user_courses: authorId,
    course_authors: courseId
  });

  if (courseAndAuthor.length === 0) {
    courseAndAuthor = await CourseAndAuthor.create({
      user_courses: authorId,
      course_authors: courseId
    }).fetch();
  }

  let lessonAndAuthor = await LessonAndAuthor.findOne({
    user_lessons: authorId,
    lesson_authors: lessonId
  });

  if (lessonAndAuthor.length === 0) {
    lessonAndAuthor = await LessonAndAuthor.create({
      user_lessons: authorId,
      lesson_authors: lessonId
    }).fetch();
  }

  return [courseAndAuthor, lessonAndAuthor];
}

function prepCourse(course, lessonProgressPerCourse) {
  const lessonProgress =
    lessonProgressPerCourse && lessonProgressPerCourse[course.id]
      ? lessonProgressPerCourse[course.id]
      : {
          lessons: {},
          completedCount: 0,
          started: false
        };

  return Object.assign({}, course, {
    duration: getDurationFromSeconds(_.sumBy(course.lessons, 'durationInSeconds'), true),
    counts: _.countBy(course.lessons, 'type'),
    lessonProgress
  });
}

async function getUserLessonProgressPerCourse(user) {
  const models = await initModels();
  const lessonProgress = await models.getModel('lessonprogress').find({ courseId: user });
  const lessonProgressPerCourse = _.reduce(
    lessonProgress,
    (sum, currentProgress) => {
      const lessonProgressForCourse = sum[currentProgress.user] || {
        lessons: {},
        completedCount: 0
      };
      const translatedProgress = currentProgress.progress > 0.95 ? 1 : currentProgress.progress;
      return Object.assign({}, sum, {
        [currentProgress.user]: Object.assign({}, lessonProgressForCourse, {
          lessons: Object.assign({}, lessonProgressForCourse.lessons, {
            [currentProgress.lessonId]: translatedProgress
          }),
          completedCount: translatedProgress,
          started: true
        })
      });
    },
    {}
  );

  return lessonProgressPerCourse;
}

async function getNumberOfUserCompletedLessonsForThisCourse(userId, courseId) {
  const lessonProgressPerCourse = await getUserLessonProgressPerCourse(courseId);

  return lessonProgressPerCourse[userId].completedCount;
}

async function getLessonProgressPerCourse(user) {
  const models = await initModels();
  const lessonProgress = await models.getModel('lessonprogress').find({ user: user.id });

  const lessonProgressPerCourse = _.reduce(
    lessonProgress,
    (sum, currentProgress) => {
      const lessonProgressForCourse = sum[currentProgress.courseId] || {
        lessons: {},
        completedCount: 0
      };
      const translatedProgress = currentProgress.progress > 0.95 ? 1 : currentProgress.progress;
      const lessonWeight = translatedProgress === 1 ? 1 : 0;

      return Object.assign({}, sum, {
        [currentProgress.courseId]: Object.assign({}, lessonProgressForCourse, {
          lessons: Object.assign({}, lessonProgressForCourse.lessons, {
            [currentProgress.lessonId]: translatedProgress
          }),
          completedCount: Object.keys(lessonProgressForCourse.lessons)
            .map((key) => [key, lessonProgressForCourse.lessons[key]])
            .filter((lesson) => lesson[1] === 1)
            .map((lesson) => lesson[1]).length,
          started: true
        })
      });
    },
    {}
  );

  return lessonProgressPerCourse;
}

async function getNumberOfCompletedLessonsForThisCourse(userId, courseId) {
  const lessonProgressPerCourse = await getLessonProgressPerCourse(userId);

  return lessonProgressPerCourse[courseId].completedCount;
}

async function findAllCourses(user) {
  const courses = await getCoursesWithLessons();
  const lessonProgressPerCourse = await getLessonProgressPerCourse(user);

  return courses.map((course) => prepCourse(course, lessonProgressPerCourse));
}

async function findCourses(user) {
  const courses = await getCourses();

  return courses;
}

async function findCourseWithTittle(user, title) {
  const models = await initModels();
  const courses = await models
    .getModel('course')
    .find({ title: title })
    .populate('authors')
    .populate('tags')
    .populate('lessons');

  const lessonProgressPerCourse = await getLessonProgressPerCourse(user);

  return course.map((course) => prepCourse(course, lessonProgressPerCourse));
}

async function findOneCourse(id, user) {
  const models = await initModels();
  const course = await models.getModel('course').findOne(id).populate('authors').populate('tags').populate('lessons');

  if (!course || course.length === 0 || course === undefined) {
    return [];
  }

  const lessons = (
    await Promise.all(course.lessons.map((lesson) => models.getModel('lesson').findOne(lesson.id).populate('authors')))
  )
    .map((lesson) =>
      Object.assign({}, lesson, {
        duration: getDurationFromSeconds(lesson.durationInSeconds)
      })
    )
    .sort((l1, l2) => l1.order - l2.order);

  let lessonProgressPerCourse;

  if (user) lessonProgressPerCourse = await getLessonProgressPerCourse(user);

  return prepCourse(Object.assign({}, course, { lessons }), lessonProgressPerCourse);
}

async function findCourse(id, user) {
  const models = await initModels();
  const course = await models
    .getModel('course')
    .findOne({ where: { id: id } })
    .populate('lessons');

  if (!course || course.length === 0 || course === undefined) {
    return [];
  }

  const lessons = (
    await Promise.all(
      course.lessons.map((lesson) =>
        models
          .getModel('lesson')
          .findOne(lesson.id)
          .populate('authors', { select: ['image'] })
      )
    )
  )
    .map((lesson) =>
      Object.assign({}, lesson, {
        duration: getDurationFromSeconds(lesson.durationInSeconds)
      })
    )
    .sort((l1, l2) => l1.order - l2.order);

  let lessonProgressPerCourse;

  if (user) lessonProgressPerCourse = await getLessonProgressPerCourse(user);
  const courseDetails = prepCourse(Object.assign({}, course, { lessons }), lessonProgressPerCourse);

  return courseDetails;
}

async function findInitialisingCourse(id, user) {
  const models = await initModels();
  const Lesson = await models.getModel('lesson');
  const course = await models
    .getModel('course')
    .findOne({ where: { id: id } })
    .populate('lessons', { select: ['title', 'durationInSeconds', 'course', 'type', 'order'], sort: 'order ASC' })
    .populate('authors', { select: ['name', 'email', 'surname', 'aboutAuthor', 'profileUrlLink', 'image'] });

  if (!course || course.length === 0 || course === undefined) {
    return [];
  }
  let courseLessons = await Lesson.find({ where: { course: id }, select: ['title'] });

  courseLessons
    .map((lesson) =>
      Object.assign({}, lesson, {
        duration: getDurationFromSeconds(lesson.durationInSeconds)
      })
    )
    .sort((l1, l2) => l1.order - l2.order);

  let lessonProgressPerCourse;

  if (user) lessonProgressPerCourse = await getLessonProgressPerCourse(user);

  const courseDetails = prepCourse(Object.assign({}, course, { courseLessons }), lessonProgressPerCourse);

  return courseDetails;
}

async function findCourseByTitle(title) {
  const models = await initModels();
  const courses = await models.getModel('course');
  const course = courses.findOne({ title: title });
  return course;
}

async function findCoursesbySubstring(text) {
  const models = await initModels();
  const Courses = await models.getModel('course').find({}).populate('tags');

  const matchingTagIds = [];

  const matchingTitleOrDescription = Courses.filter(
    (course) =>
      course.title.toLowerCase().search(text.toLowerCase()) >= 0 === true ||
      course.description.toLowerCase().search(text.toLowerCase()) >= 0 === true
  ).map((course) => course.id);

  const matchingTags = Courses.forEach((course) => {
    if (course.tags.length > 0) {
      if (course.tags.filter((tag) => tag.label.toLowerCase().search(text.toLowerCase()) >= 0 === true).length > 0) {
        matchingTagIds.push(course.id);
      }
    }
  });

  const idsOfMatchingCourses = new Set([...matchingTagIds, ...matchingTitleOrDescription]);
  const matchingCoursesIds = [...idsOfMatchingCourses];

  const matchingCourses = Courses.filter((course) => matchingCoursesIds.includes(course.id));

  return matchingCourses;
}

async function findCourseByAuthor(user, userId) {
  const models = await initModels();
  const course_authors__user_courses = await models
    .getModel('course_authors__user_courses')
    .find({ user_courses: userId });

  const courses = [];

  for (let i = 0; i < course_authors__user_courses.length; i += 1) {
    const temp = await models
      .getModel('course')
      .find({ id: course_authors__user_courses[i].course_authors })
      .populate('authors')
      .populate('tags')
      .populate('lessons');
    courses.push(temp[0]);
  }

  const lessonProgressPerCourse = await getLessonProgressPerCourse(user);

  return courses.map((course) => prepCourse(course, lessonProgressPerCourse));
}

async function findCoursesByTag(user, tag_id) {
  const models = await initModels();
  const course_tags__tag_courses = await models.getModel('course_tags__tag_courses').findOne({ tag_courses: tag_id });

  const courses = [];

  for (let i = 0; i < course_tags__tag_courses.length; i += 1) {
    const temp = await models
      .getModel('course')
      .find({ id: course_tags__tag_courses[i].course_tags })
      .populate('authors')
      .populate('tags')
      .populate('lessons');
    courses.push(temp[0]);
  }

  const lessonProgressPerCourse = await getLessonProgressPerCourse(user);

  return courses.map((course) => prepCourse(course, lessonProgressPerCourse));
}

async function getTitlesOfCourses() {
  const courses = await getCoursesWithLessons();

  const titles = courses.map((course) => course.title);

  return titles;
}

async function getTagsOfCourses() {
  const models = await initModels();
  const tagObjects = await models.getModel('course').find().populate('tags');

  const tags = tagObjects.map((course) => course.tags);

  let labels = [];

  for (let i = 0; i < tags.length; i++) {
    for (let j = 0; j < tags[i].length; j++) {
      labels.push(tags[i][j].label);
    }
  }

  return _.uniq(labels);
}

async function getTagsOfOneCourse(courseId) {
  const models = await initModels();
  const tagObjects = await models.getModel('course').find({ id: courseId }).populate('tags');

  const tags = tagObjects.map((course) => course.tags);

  let labels = [];

  for (let i = 0; i < tags.length; i++) {
    for (let j = 0; j < tags[i].length; j++) {
      labels.push(tags[i][j].label);
    }
  }

  return _.uniq(labels);
}

async function isTagOfCourse(tagLabel, courseTitle) {
  let courseHasTag = false;

  const models = await initModels();
  const courses = await models.getModel('course').find({ title: courseTitle }).populate('tags');

  const tags = courses.map((course) => course.tags);

  const isTag = tags[0].filter((course) => course.label.toLowerCase() === tagLabel.toLowerCase());

  if (isTag.length > 0) courseHasTag = true;

  return courseHasTag;
}

async function getAuthorsOfCourses() {
  const models = await initModels();
  const allCourses = await models.getModel('course').find().populate('authors');

  const authorsOfAllCourses = allCourses
    .map((author) => author.authors)
    .map((author) => `${author[0].name} ${author[0].surname}`);

  const authorsOfWatchedAndWatchingCoursesWithEmail = _.uniq(authorsOfAllCourses);

  return authorsOfWatchedAndWatchingCoursesWithEmail;
}

async function isAuthorOfCourse(authorName, courseTitle) {
  let courseHasAuthor = false;

  const models = await initModels();
  const course = await models.getModel('course').find({ title: courseTitle }).populate('authors');

  const author = course.map((course) => course.authors);

  const name = author[0].map((course) => `${course.name.toLowerCase()} ${course.surname.toLowerCase()}`);

  const names = name.filter((name) => name === authorName.toLowerCase());

  if (names.length > 0) courseHasAuthor = true;

  return courseHasAuthor;
}

async function getTitlesTagsAndAuthorsOfCourses() {
  const titles = await getTitlesOfCourses();

  const tags = await getTagsOfCourses();

  const authors = await getAuthorsOfCourses();

  const titlesTagsAndAuthors = await _.concat(titles, tags, authors);

  return titlesTagsAndAuthors;
}

async function findAllUsersFromLessonProgress(lessonProgressToFindUsers) {
  const usersToBeFiltered = [];

  lessonProgressToFindUsers.forEach((lessonProgressToFindUser) => {
    usersToBeFiltered.push(lessonProgressToFindUser.user);
  });

  return usersToBeFiltered;
}

async function filterRepeatingValues(array) {
  const values = [];

  array.sort().filter((value, pos, ary) => {
    if (!pos || value != ary[pos - 1]) {
      if (!value == '' || !value == null) {
        values.push(value);
      }
    }
  });

  return values;
}

async function searchLessonProgress(courseId, user, progress) {
  const models = await initModels();
  const lessonProgress = await models.getModel('lessonprogress').find({ user: user });

  const lesson = lessonProgress.filter((lesson) => lesson.courseId === courseId && lesson.progress === progress);

  return lesson;
}

async function searchLessonByCourseId(courseId) {
  const models = await initModels();
  const lesson = await models.getModel('lesson').find({ course: courseId });

  return lesson;
}

async function getdatesForCompletedCourseLessons(lessonProgressForCompletedCourses) {
  const dates = [];

  lessonProgressForCompletedCourses.forEach((lesson) => {
    dates.push(new Date(lesson.date));
  });

  return dates;
}

async function getCourseIdsForLessonsWithUserProgress(userId) {
  const models = await initModels();
  const lessonProgress = await models.getModel('lessonprogress').find({ user: userId });

  const courseIdsForLessonsWithUserProgress = lessonProgress.map((lesson) => lesson.courseId);

  return courseIdsForLessonsWithUserProgress;
}

async function getCourseIdsOfUserCompletedCourses(userId) {
  const models = await initModels();
  const completedCourse = await models.getModel('completedcourse').find({ userId: userId });

  const courseIdsOfUserCompletedCourses = completedCourse.map((course) => course.courseId);

  return courseIdsOfUserCompletedCourses;
}

async function findUsersAndTheirCompletedCourses() {
  const models = await initModels();
  const CourseCompleted = models.getModel('completedcourse');

  const usersAndTheirCompletedCourses = await CourseCompleted.find({});

  return usersAndTheirCompletedCourses;
}

async function findUserAndCompletedCourses(user) {
  const userAndCompletedCourses = [];

  const models = await initModels();
  const Courses = models.getModel('course');

  const courses = await Courses.find({});

  for (let i = 0; i < courses.length; i += 1) {
    const lessonProgressForCompletedCourses = await searchLessonProgress(courses[i].id, user, 1);

    const lessonsForCompletedCourses = await searchLessonByCourseId(courses[i].id);

    const datesForCompletedCourseLessons = await getdatesForCompletedCourseLessons(lessonProgressForCompletedCourses);

    if (lessonsForCompletedCourses[0]) {
      if (lessonsForCompletedCourses.length === lessonProgressForCompletedCourses.length) {
        const dateWhenCourseCompleted = datesForCompletedCourseLessons.sort((first, second) => {
          return second - first;
        });
        const completedCourse = Courses.find({ id: lessonProgressForCompletedCourses[0].courseId });
        const completedCourseInfo = {
          courseId: completedCourse[0].id,
          username: lessonProgressForCompletedCourses[0].user,
          courseName: completedCourse[0].title,
          date: dateWhenCourseCompleted[0].toLocaleDateString()
        };
        userAndCompletedCourses.push(completedCourseInfo);
      } else {
        console.log('course: ' + courses[i].title + ' not finished');
      }
    }
  }

  return userAndCompletedCourses;
}

async function saveCompletedCourse(newCompletedCourse) {
  const models = await initModels();
  const CourseCompleted = models.getModel('completedcourse');

  await CourseCompleted.create(newCompletedCourse).fetch();
}

async function findUserAndCompletedCoursesFromDb(userId) {
  const usersAndTheirCompletedCourses = await findUsersAndTheirCompletedCourses();

  const filteredByUser = usersAndTheirCompletedCourses.filter((course) => course.userId === userId);

  return filteredByUser;
}

async function userCompletedThisCourse(userId, courseId) {
  let courseIsCompleted = false;

  const userCompletedCourses = await findUserAndCompletedCoursesFromDb(userId);

  const courseComplete = userCompletedCourses.filter((course) => course.courseId === courseId);

  if (courseComplete.length > 0) courseIsCompleted = true;

  return courseIsCompleted;
}

async function courseIsCompletedByUser(userId, courseTitle) {
  let courseIsCompleted = false;

  const userCompletedCourses = await findUserAndCompletedCoursesFromDb(userId);

  const courseCompleted = userCompletedCourses.filter((course) => course.courseName === courseTitle);

  if (courseCompleted.length > 0) courseIsCompleted = true;

  return courseIsCompleted;
}

async function findCoursesWithUserProgress(user) {
  const allCourses = await getCoursesWithLessons();

  const courseIdsOfCoursesInProgress = await getCourseIdsForLessonsWithUserProgress(user);

  const courseIdsOfUserCompletedCourses = await getCourseIdsOfUserCompletedCourses(user);

  const courseIdsOfIncompleteCoursesBeingWatched = courseIdsOfCoursesInProgress.filter(
    (id) => !courseIdsOfUserCompletedCourses.includes(id)
  );

  const coursesThatUserIsWatching = allCourses
    .filter((course) => courseIdsOfIncompleteCoursesBeingWatched.includes(course.id))
    .map((course) => course.title);

  return coursesThatUserIsWatching;
}

async function findUsersWithProgress() {
  const models = await initModels();
  const lessonProgressToFindUsers = await models.getModel('lessonprogress').find({});

  const allUsersFromLessonProgress = await findAllUsersFromLessonProgress(lessonProgressToFindUsers);

  const filteredValues = await filterRepeatingValues(allUsersFromLessonProgress);

  return filteredValues;
}

async function getIdsOfUsersWatchingThisCourse(courseId) {
  const models = await initModels();
  const LessonProgress = models.getModel('lessonprogress');

  const lessonProgress = await LessonProgress.find({ courseId: courseId });

  const idsOfUsersWatchingCourse = _.uniq(lessonProgress.map((courseBeingWatched) => courseBeingWatched.user));

  return idsOfUsersWatchingCourse;
}

async function getAllUsersWatchingThisCourse(courseId) {
  const idsOfUsersWatchingCourse = await getIdsOfUsersWatchingThisCourse(courseId);

  const models = await initModels();
  const User = models.getModel('user');

  const usersWatchingThisCourse = [];

  for (let i = 0; i < idsOfUsersWatchingCourse.length; i += 1) {
    const userWatchingThisCourse = await User.findOne({ id: idsOfUsersWatchingCourse[i] });
    usersWatchingThisCourse.push(userWatchingThisCourse);
  }

  return usersWatchingThisCourse;
}

async function getIdsOfUsersWhoCompletedThisCourse(courseId) {
  const models = await initModels();
  const CompletedCourse = models.getModel('completedcourse');

  const completedCourse = await CompletedCourse.find({ courseId: courseId });

  const idsOfUsersWhoCompletedThisCourse = _.uniq(completedCourse.map((courseCompleted) => courseCompleted.userId));

  return idsOfUsersWhoCompletedThisCourse;
}

async function getAllUsersWhoCompletedThisCourse(courseId) {
  const idsOfUsersWhoCompletedThisCourse = await getIdsOfUsersWhoCompletedThisCourse(courseId);

  const models = await initModels();
  const User = models.getModel('user');

  const usersWhoCompletedThisCourse = [];

  for (let i = 0; i < idsOfUsersWhoCompletedThisCourse.length; i += 1) {
    const userWhoCompletedThisCourse = await User.findOne({ id: idsOfUsersWhoCompletedThisCourse[i] });
    usersWhoCompletedThisCourse.push(userWhoCompletedThisCourse);
  }

  return usersWhoCompletedThisCourse;
}

async function getTitlesOfAllCoursesBeingWatched() {
  const allUsersCurrentlyWatchingACourse = await findUsersWithProgress();

  const titlesOfAllCoursesBeingWatched = [];

  for (let i = 0; i < allUsersCurrentlyWatchingACourse.length; i += 1) {
    const titlesOfCoursesBeingWatchedByThisUser = await findCoursesWithUserProgress(
      allUsersCurrentlyWatchingACourse[i]
    );
    titlesOfAllCoursesBeingWatched.push(titlesOfCoursesBeingWatchedByThisUser);
  }

  return _.uniq(_.flatten(titlesOfAllCoursesBeingWatched));
}

async function mapOfNumberOfPeopleWatchingACourse() {
  const models = await initModels();
  const Course = models.getModel('course');

  const allCourses = await Course.find({});

  const mapOfCourseTitleAndNumberOfWatchers = new Map();

  const titlesOfAllCoursesBeingWatched = await getTitlesOfAllCoursesBeingWatched();

  allCourses.forEach((course) => {
    mapOfCourseTitleAndNumberOfWatchers[course.title] = 0;
  });

  titlesOfAllCoursesBeingWatched.forEach((title) => {
    mapOfCourseTitleAndNumberOfWatchers[title] += 1;
  });

  return mapOfCourseTitleAndNumberOfWatchers;
}

async function mapOfNumberOfPeopleWatchingCoursesByAuthor(authorId) {
  const courseTitlesByAuthor = await getCourseTitlesAuthoredByUser(authorId);

  const mapOfCourseTitleAndNumberOfWatchers = await mapOfNumberOfPeopleWatchingACourse();

  const mapOfCourseTitleByAuthorAndNumberOfWatchers = Object.keys(mapOfCourseTitleAndNumberOfWatchers)
    .filter((courseTitle) => courseTitlesByAuthor.includes(courseTitle))
    .reduce((filteredMap, courseTitle) => {
      const newFilteredMap = filteredMap;
      newFilteredMap[courseTitle] = mapOfCourseTitleAndNumberOfWatchers[courseTitle];
      return newFilteredMap;
    }, {});

  return mapOfCourseTitleByAuthorAndNumberOfWatchers;
}

async function getNumberOfPeopleWatchingThisCourse(courseTitle) {
  const mapOfCourseTitleAndNumberOfWatchers = await mapOfNumberOfPeopleWatchingACourse();

  if (
    mapOfCourseTitleAndNumberOfWatchers[courseTitle] < 1 ||
    mapOfCourseTitleAndNumberOfWatchers[courseTitle] == undefined
  )
    return `0`;

  return `${mapOfCourseTitleAndNumberOfWatchers[courseTitle]}`;
}

async function sendEmail(newCompletedCourse) {
  const completedCourse = newCompletedCourse.courseName;

  const models = await initModels();

  const WebhookEmail = models.getModel('webhookemail');

  const listOfWebhookEmails = await WebhookEmail.find({ course: completedCourse });

  const listOfPeopleToBeEmailed = [];

  if (listOfWebhookEmails.length !== 0) {
    listOfWebhookEmails.forEach((webhookEmail) => {
      if (webhookEmail.course === completedCourse) {
        listOfPeopleToBeEmailed.push(webhookEmail.email);
      }
    });
  }
  listOfPeopleToBeEmailed.forEach((personToBeEmailed) => {
    sendmail(
      {
        from: 'Manabu@manabu.co.za',
        to: personToBeEmailed,
        subject: `${newCompletedCourse.username} has completed a course.`,
        html: `Great news!!! ${newCompletedCourse.username} has finally completed the course: ${completedCourse}`
      },
      (err, reply) => {
        console.log(err && err.stack);
        console.dir(reply);
      }
    );
    console.log('send mail method called');
  });
}

async function saveLatestCourseCompleted(username) {
  console.log('Checking if there is a new course completed...');

  const userAndCompletedCourses = await findUserAndCompletedCourses(username);

  const userAndCompletedCoursesFromDb = await findUserAndCompletedCoursesFromDb(username);

  if (userAndCompletedCourses.length === parseInt(userAndCompletedCoursesFromDb.length, 10) + 1) {
    const newCompletedCourse = userAndCompletedCourses[parseInt(userAndCompletedCourses.length, 10) - 1];

    await sendEmail(newCompletedCourse);

    await saveCompletedCourse(newCompletedCourse);
  } else {
    console.log('No new course completed by ' + username);
  }
}

async function sendEmailWhenCourseIsCompleted(courses, user) {
  const models = await initModels();

  const Completedcourse = models.getModel('completedcourse');

  const date = new Date();

  courses.forEach(async (course) => {
    if (course.lessons.length === course.lessonProgress.completedCount) {
      const completedCourse = await Completedcourse.find({
        courseId: course.id,
        userId: user.id,
        username: user.name,
        courseName: course.title,
        image: course.image
      });

      if (!completedCourse[0]) {
        const newCompletedCourse = await Completedcourse.create({
          courseId: course.id,
          userId: user.id,
          username: user.name,
          courseName: course.title,
          date: date.toDateString(),
          image: course.image
        }).fetch();

        await sendEmail(newCompletedCourse);
      }
    }
  });
}

async function randomiseCourses() {
  const courses = await getCoursesWithLessons();

  const randomCourses = _.sampleSize(courses, courses.length);

  return randomCourses;
}

async function selectOneRandomCourse() {
  const randomCourses = await randomiseCourses();

  return randomCourses[0];
}

async function getTitlesOfWatchedAndWatchingCourses(userId) {
  const watchedCourses = await findUserAndCompletedCoursesFromDb(userId);

  const watchingCourses = await findCoursesWithUserProgress(userId);

  const allTitles = [];

  const titlesOfWatchedCourses = watchedCourses.map((course) => allTitles.push(course.courseName));

  const titlesOfWatchingCourses = watchingCourses.map((course) => allTitles.push(course));

  return _.uniq(allTitles);
}

async function getWatchedOrWatchingCourses(userId) {
  const titlesOfWatchedAndWatchingCourses = await getTitlesOfWatchedAndWatchingCourses(userId);

  const models = await initModels();
  const Course = await models.getModel('course');

  const watchedOrWatchingCourses = [];

  if (titlesOfWatchedAndWatchingCourses.length > 0) {
    for (const title of titlesOfWatchedAndWatchingCourses) {
      const watchedOrWatchingCourse = await Course.findOne({ title: title })
        .populate('tags')
        .populate('authors')
        .populate('lessons');

      watchedOrWatchingCourses.push(watchedOrWatchingCourse);
    }
  }

  return watchedOrWatchingCourses;
}

async function isWatchedOrWatchingCourse(userId, courseTitle) {
  let courseIsWatchedOrWatching = false;

  const titlesOfWatchedAndWatchingCourses = await getTitlesOfWatchedAndWatchingCourses(userId);

  const titleCheck = titlesOfWatchedAndWatchingCourses.filter((course) =>
    course.toLowerCase().includes(courseTitle.toLowerCase())
  );

  if (titleCheck.length > 0) courseIsWatchedOrWatching = true;

  return courseIsWatchedOrWatching;
}

async function getTitlesOfUnwatchedCourses(userId) {
  const titlesOfAllCourses = await getTitlesOfCourses();

  const titlesOfWatchedAndWatchingCourses = await getTitlesOfWatchedAndWatchingCourses(userId);

  const titlesOfUnwatchedCourses = titlesOfAllCourses.filter(
    (title) => !titlesOfWatchedAndWatchingCourses.includes(title)
  );

  return titlesOfUnwatchedCourses;
}

async function getUnwatchedCourses(userId) {
  const models = await initModels();
  const Course = models.getModel('course');

  const titlesOfUnwatchedCourses = await getTitlesOfUnwatchedCourses(userId);

  const unwatchedCourses = [];

  for (const title of titlesOfUnwatchedCourses) {
    const unwatchedCourse = await Course.findOne({ title: title })
      .populate('tags')
      .populate('authors')
      .populate('lessons');

    unwatchedCourses.push(unwatchedCourse);
  }

  return unwatchedCourses;
}

async function getTagsOfWatchedAndWatchingCourses(userId) {
  const tagsOfWatchedAndWatchingCourses = [];

  const watchedOrWatchingCourses = await getWatchedOrWatchingCourses(userId);

  const tags = watchedOrWatchingCourses.map((course) => course.tags.map((course) => course.label));

  let labels = [];

  for (let i = 0; i < tags.length; i++) {
    for (let j = 0; j < tags[i].length; j++) {
      labels.push(tags[i][j]);
    }
  }

  return _.uniq(labels);
}

async function getAuthorsOfWatchedAndWatchingCourses(userId) {
  const watchedOrWatchingCourses = await getWatchedOrWatchingCourses(userId);

  const authorsOfWatchedAndWatchingCourses = watchedOrWatchingCourses
    .map((author) => author.authors)
    .map((author) => `${author[0].name} ${author[0].surname}`);

  const authorsOfWatchedAndWatchingCoursesWithOutEmail = _.uniq(authorsOfWatchedAndWatchingCourses);

  return authorsOfWatchedAndWatchingCoursesWithOutEmail;
}

async function getTagsOfUnwatchedCourses(userId) {
  const unwatchedCourses = await getUnwatchedCourses(userId);

  const tagObjectsOfUnwatchedCourses = [];

  const unwatchedCoursesWithTags = new Map();

  unwatchedCourses.forEach((unwatchedCourse) => {
    tagObjectsOfUnwatchedCourses.push(unwatchedCourse.tags);
  });

  for (let i = 0; i < tagObjectsOfUnwatchedCourses.length; i += 1) {
    const listOfTagsForCourse = [];

    const numberOfTagsForCourse = tagObjectsOfUnwatchedCourses[i].length;

    for (let j = 0; j < numberOfTagsForCourse; j += 1) {
      listOfTagsForCourse.push(tagObjectsOfUnwatchedCourses[i][j].label);
    }

    unwatchedCoursesWithTags[unwatchedCourses[i].title] = listOfTagsForCourse;
  }

  return unwatchedCoursesWithTags;
}

async function getRecommendedCourses(userId) {
  const tagsOfWatchedAndWatchingCourses = await getTagsOfWatchedAndWatchingCourses(userId);

  const unwatchedCourses = await getUnwatchedCourses(userId);

  const tagsOfUnwatchedCourses = await getTagsOfUnwatchedCourses(userId);

  const recommendedCourses = [];

  if (tagsOfWatchedAndWatchingCourses.length === 0) {
    return unwatchedCourses;
  }

  unwatchedCourses.forEach((unwatchedCourse) => {
    for (let i = 0; i < tagsOfWatchedAndWatchingCourses.length; i += 1) {
      if (tagsOfUnwatchedCourses[unwatchedCourse.title].includes(tagsOfWatchedAndWatchingCourses[i])) {
        recommendedCourses.push(unwatchedCourse);
      }
    }
  });

  return _.uniq(recommendedCourses);
}

async function createMapOfCourseIdAndTitle() {
  const courses = await getCoursesWithLessons();

  const mapOfIdAndTitle = {};

  if (courses.length === 0) throw new Error('There are no courses available.');

  courses.map((course) => {
    mapOfIdAndTitle[course.title] = course.id;
  });

  return mapOfIdAndTitle;
}

async function createMapOfFirstLessonIdAndCourseTitle() {
  const courses = await getCoursesWithLessons();

  const mapOfFirstLessonIdAndCourseTitle = {};

  if (courses.length === 0) throw new Error('There are no courses available.');

  courses.forEach((course) => {
    mapOfFirstLessonIdAndCourseTitle[course.title] = course.lessons[0].id;
  });

  return mapOfFirstLessonIdAndCourseTitle;
}

async function getNumberOfPeopleWhoCompletedThisCourse(courseId) {
  const models = await initModels();
  const CompletedCourse = await models.getModel('completedcourse');

  const numberOfPeopleWhoCompletedThisCourse = await CompletedCourse.find({ courseId: courseId });

  if (numberOfPeopleWhoCompletedThisCourse.length === 0) return 0;

  return numberOfPeopleWhoCompletedThisCourse.length;
}

async function getNumberOfPeopleWhoCompletedCoursesByThisAuthor(authorId) {
  const courseTitlesByAuthor = await getCourseTitlesAuthoredByUser(authorId);

  const models = await initModels();
  const CompletedCourse = await models.getModel('completedcourse');

  const completedCourses = await CompletedCourse.find({});

  const listOfCompletedCoursesCreatedByAuthor = completedCourses.filter((completedCourse) =>
    courseTitlesByAuthor.includes(completedCourse.courseName)
  );

  return listOfCompletedCoursesCreatedByAuthor.length;
}

async function getNumberOfPeopleWhoAreWatchingCoursesByThisAuthor(authorId) {
  const mapOfNumberOfPeopleWatchingCoursesByThisAuthor = await mapOfNumberOfPeopleWatchingCoursesByAuthor(authorId);

  const value = Object.keys(mapOfNumberOfPeopleWatchingCoursesByThisAuthor).reduce(
    (sum, title) => sum + mapOfNumberOfPeopleWatchingCoursesByThisAuthor[title],
    0
  );

  return value;
}

async function courseStatisticsForAuthor(authorId) {
  const courseStats = new Map();

  const numberOfPeopleWhoAreWatchingCoursesByThisAuthor = await getNumberOfPeopleWhoAreWatchingCoursesByThisAuthor(
    authorId
  );

  const numberOfPeopleWhoCompletedCoursesByThisAuthor = await getNumberOfPeopleWhoCompletedCoursesByThisAuthor(
    authorId
  );

  courseStats.inProgress = numberOfPeopleWhoAreWatchingCoursesByThisAuthor;

  courseStats.completed = numberOfPeopleWhoCompletedCoursesByThisAuthor;

  return courseStats;
}

async function getNumberOfPeopleWhoCompletedCoursesForEveryCourse() {
  const models = await initModels();
  const Course = await models.getModel('course');

  const courses = await Course.find({});

  const mapOfCourseIdAndNumberOfPeopleWhoCompletedTheCourse = {};

  for (const course of courses) {
    mapOfCourseIdAndNumberOfPeopleWhoCompletedTheCourse[course.title] = await getNumberOfPeopleWhoCompletedThisCourse(
      course.id
    );
  }

  return mapOfCourseIdAndNumberOfPeopleWhoCompletedTheCourse;
}

async function getNumberOfPeopleWhoCompletedAndAreWatchingCourses() {
  const numberOfPeopleWhoCompletedCoursesForEveryCourse = await getNumberOfPeopleWhoCompletedCoursesForEveryCourse();

  const numberOfPeopleWatchingACourse = await mapOfNumberOfPeopleWatchingACourse();

  const courses = await getCoursesWithLessons();

  const numberOfPeopleWhoCompletedAndAreWatchingCourses = {};

  const total = courses.map(
    (course) =>
      (numberOfPeopleWhoCompletedAndAreWatchingCourses[course.title] =
        numberOfPeopleWhoCompletedCoursesForEveryCourse[course.title] + numberOfPeopleWatchingACourse[course.title])
  );

  return numberOfPeopleWhoCompletedAndAreWatchingCourses;
}

async function getMostPopularCourses(numberOfCourses) {
  const models = await initModels();
  const Course = await models.getModel('course');

  const numberOfPeopleWhoCompletedAndAreWatchingCourses = await getNumberOfPeopleWhoCompletedAndAreWatchingCourses();

  const listOfTitlesOfPopularCourses = [];

  const popularCourses = [];
  const listOfMostPopularCourses = Object.entries(numberOfPeopleWhoCompletedAndAreWatchingCourses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, numberOfCourses);
  for (let i = 0; i < listOfMostPopularCourses.length; i += 1) {
    listOfTitlesOfPopularCourses.push(listOfMostPopularCourses[i][0]);
  }

  for (let i = 0; i < listOfTitlesOfPopularCourses.length; i += 1) {
    const popularCourse = await Course.findOne({ title: listOfTitlesOfPopularCourses[i] });
    popularCourses.push(popularCourse[0]);
  }

  return popularCourses;
}

async function getMostPopularCoursesOfAuthor(userId) {
  const coursesAuthoredByThisUser = await getCoursesAuthoredByUser(userId);

  const models = await initModels();
  const Course = await models.getModel('course');

  const numberOfPeopleWhoCompletedAndAreWatchingCoursesOfAuthor = new Map();

  const numberOfPeopleWhoCompletedAndAreWatchingCourses = await getNumberOfPeopleWhoCompletedAndAreWatchingCourses();

  for (const course of coursesAuthoredByThisUser) {
    if (numberOfPeopleWhoCompletedAndAreWatchingCourses.hasOwnProperty(course.title)) {
      numberOfPeopleWhoCompletedAndAreWatchingCoursesOfAuthor[course.title] =
        numberOfPeopleWhoCompletedAndAreWatchingCourses[course.title];
    }
  }

  const listOfTitlesOfPopularCoursesOfAuthor = [];

  const popularCoursesOfAuthor = [];

  let listOfMostPopularCoursesOfAuthor = [];
  listOfMostPopularCoursesOfAuthor = Object.entries(numberOfPeopleWhoCompletedAndAreWatchingCoursesOfAuthor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (let i = 0; i < listOfMostPopularCoursesOfAuthor.length; i += 1) {
    listOfTitlesOfPopularCoursesOfAuthor.push(listOfMostPopularCoursesOfAuthor[i][0]);
  }

  for (let i = 0; i < listOfTitlesOfPopularCoursesOfAuthor.length; i += 1) {
    const popularCourseOfAuthor = await Course.find({ title: listOfTitlesOfPopularCoursesOfAuthor[i] });
    popularCoursesOfAuthor.push(popularCourseOfAuthor[0]);
  }

  return popularCoursesOfAuthor;
}

async function getMostRecentCoursesByAuthor(authorId, numberOfCourses) {
  const activeCoursesByAuthor = await getActiveCoursesAuthoredByUser(authorId);

  if (!activeCoursesByAuthor || activeCoursesByAuthor.length === 0) {
    return [];
  }

  const mostRecentCourses = activeCoursesByAuthor.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, numberOfCourses);

  return mostRecentCourses;
}

async function getFavouriteCourseStatus(userId, courseId) {
  const models = await initModels();
  const Favourite = models.getModel('favourite');

  const favourite = await Favourite.findOrCreate(
    {
      courseId: courseId,
      userId: userId
    },
    {
      courseId: courseId,
      userId: userId,
      status: 0
    }
  );

  return favourite;
}

async function getFavouriteCourses(userId) {
  const models = await initModels();
  const Favourite = models.getModel('favourite');

  const favourites = await Favourite.find({
    userId: userId
  });

  return favourites;
}

async function getNumberOfFavouriteCourses(userId) {
  const coursesAuthoredByUser = await getCoursesAuthoredByUser(userId);

  const models = await initModels();
  const Favourite = models.getModel('favourite');

  const favourites = await Favourite.find({});

  let numberOfFavouriteCoursesForAuthor = 0;

  const coursesId = [];

  coursesAuthoredByUser.forEach((course) => {
    coursesId.push(course.id);
  });

  favourites.forEach((favourite) => {
    for (let counter = 0; counter < coursesId.length; counter += 1) {
      if (favourite.courseId === coursesId[counter] && favourite.status === 1) {
        numberOfFavouriteCoursesForAuthor += 1;
      }
    }
  });

  return numberOfFavouriteCoursesForAuthor;
}

async function addCompletedCourse(completedCourse) {
  const models = await initModels();
  const CompletedCourse = models.getModel('completedcourse');

  await CompletedCourse.create(completedCourse).fetch();
}

async function findUsersThatCompletedACourse() {
  const models = await initModels();
  const User = models.getModel('user');
  const CompletedCourse = models.getModel('completedcourse');

  const usersThatCompletedACourse = [];

  const completedCourses = await CompletedCourse.find();

  for (let counter = 0; counter < completedCourses.length; counter += 1) {
    const userThatCompletedACourse = await User.find({ id: completedCourses[counter].userId });

    usersThatCompletedACourse.push({
      userThatCompletedACourse: userThatCompletedACourse[0],
      courseId: completedCourses[counter].courseId
    });
  }

  return usersThatCompletedACourse;
}

async function findUsersThatCompletedAuthoredCourses(user) {
  const coursesAuthoredByUser = await getActiveCoursesAuthoredByUser(user.id);

  const usersThatCompletedACourse = await findUsersThatCompletedACourse();

  const usersThatCompletedAuthoredCourses = [];

  usersThatCompletedACourse.forEach((userThatCompletedACourse) => {
    for (let counter = 0; counter < coursesAuthoredByUser.length; counter += 1) {
      if (userThatCompletedACourse.courseId === coursesAuthoredByUser[counter].id) {
        const userThatCompletedAuthoredCourses = {
          user: userThatCompletedACourse.userThatCompletedACourse,
          course: coursesAuthoredByUser[counter]
        };

        usersThatCompletedAuthoredCourses.push(userThatCompletedAuthoredCourses);
      }
    }
  });

  return usersThatCompletedAuthoredCourses;
}

async function updateCourseWhenLessonIsEdited(lessonId, courseId) {
  const models = await initModels();
  const Course = models.getModel('course');
  const Lesson = models.getModel('lesson');

  const lesson = await Lesson.find({ id: lessonId });
  await Course.update({ id: courseId }).set({ updatedAt: lesson.updatedAt });
}

async function getDateOfFirstAccessForCourse(courseId, userId) {
  const models = await initModels();
  const LessonProgress = models.getModel('lessonprogress');
  const completedCourse = models.getModel('completedcourse');
  const usersCompleted = await completedCourse.find({
    where: {
      courseId: courseId,
      userId: userId
    },
    select: ['createdAt']
  });

  const lessonProgress = await LessonProgress.find({
    where: {
      courseId: courseId,
      user: userId
    },
    select: ['createdAt']
  });

  if (lessonProgress.length > 1) {
    const listOfAccessDates = lessonProgress.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });
    return new Date(listOfAccessDates[0].createdAt);
  } else if (usersCompleted.length > 0) {
    const listOfAccessDates = usersCompleted.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });

    return new Date(listOfAccessDates[0].createdAt);
  } else if (lessonProgress.length === 1) {
    return new Date(lessonProgress[0].createdAt);
  }
  return '';
}

async function getDateOfLastAccessForCourse(courseId, userId) {
  const models = await initModels();
  const LessonProgress = models.getModel('lessonprogress');
  const completedCourse = models.getModel('completedcourse');

  const usersCompleted = await completedCourse.find({
    where: {
      courseId: courseId,
      userId: userId
    },
    select: ['updatedAt']
  });

  const lessonProgress = await LessonProgress.find({
    where: {
      courseId: courseId,
      user: userId
    },
    select: ['updatedAt']
  });

  if (lessonProgress.length > 1) {
    const listOfAccessDates = lessonProgress.sort((a, b) => {
      const dateA = new Date(a.updatedAt);
      const dateB = new Date(b.updatedAt);
      return dateA - dateB;
    });
    return new Date(listOfAccessDates[listOfAccessDates.length - 1].updatedAt);
  } else if (usersCompleted.length > 0) {
    const listOfAccessDates = usersCompleted.sort((a, b) => {
      const dateA = new Date(a.updatedAt);
      const dateB = new Date(b.updatedAt);
      return dateA - dateB;
    });

    return new Date(listOfAccessDates[listOfAccessDates.length - 1].updatedAt);
  } else if (lessonProgress.length === 1) {
    return new Date(lessonProgress[0].updatedAt);
  }
  return '';
}

async function getNumberOfQuizzesForThisCourse(courseId) {
  const models = await initModels();
  const TrueOrFalseQuestion = models.getModel('trueorfalsequestion');
  const MultipleChoiceQuestion = models.getModel('multiplechoicequestion');

  const trueOrFalseQuestions = await TrueOrFalseQuestion.find({ courseId: courseId });

  const multipleChoiceQuestions = await MultipleChoiceQuestion.find({ courseId: courseId });

  const numberOfTrueOrFalseQuestions = trueOrFalseQuestions.length;

  const numberOfMultipleChoiceQuestions = multipleChoiceQuestions.length;

  const totalNumberOfQuizzes = parseInt(numberOfTrueOrFalseQuestions + numberOfMultipleChoiceQuestions, 10);

  return `${totalNumberOfQuizzes}`;
}

async function numberOfQuizzesForCourse() {
  const models = await initModels();
  const TrueOrFalseQuestion = await models.getModel('trueorfalsequestion').find({});
  const MultipleChoiceQuestion = await models.getModel('multiplechoicequestion').find({});

  return [TrueOrFalseQuestion, MultipleChoiceQuestion];
}

async function getUsersAssociatedWithThisCourse(courseId) {
  const models = await initModels();
  const User = models.getModel('user');
  const course = await models.getModel('course').find({ id: courseId }).populate('lessons');
  const completedCourses = await models.getModel('completedcourse').find({ courseId: course[0].id });

  const lessonsInProgress = await models.getModel('lessonprogress').find({ courseId: course[0].id });

  const numberOfQuizzesForThisCourse = await getNumberOfQuizzesForThisCourse(course[0].id);

  const numberOfLessonsForThisCourse = course[0].lessons.length;

  const allUsers = await User.find({});

  const usersAssociatedWithThisCourse = [];
  usersNotassociatedWithCourse = [];

  for (let i = 0; i < allUsers.length; i++) {
    let userIsAssociatedWithThisCourse = lessonsInProgress.filter((lesson) => lesson.user === allUsers[i].id).length;

    let userAlreadyCompletedThisCourse = completedCourses.filter(
      (completedCourse) => completedCourse.userId === allUsers[i].id
    ).length;

    if (userIsAssociatedWithThisCourse > 0 || userAlreadyCompletedThisCourse > 0) {
      let dateOfFirstAccess = await getDateOfFirstAccessForCourse(course[0].id, allUsers[i].id);

      let dateOfLastAccess = await getDateOfLastAccessForCourse(course[0].id, allUsers[i].id);

      if (userAlreadyCompletedThisCourse > 0) {
        let userDetailsForCourse = Object.assign(
          {},
          { status: 'Complete' },
          { name: allUsers[i].name },
          { surname: allUsers[i].surname },
          { enrolled: dateOfFirstAccess },
          { lastAccess: dateOfLastAccess },
          { numberOfQuizzes: numberOfQuizzesForThisCourse },
          { completedLessons: numberOfLessonsForThisCourse },
          { completedLessonsPercentage: 100 },
          { incompleteLessons: 0 },
          { incompleteLessonsPercentage: 0 }
        );

        usersAssociatedWithThisCourse.push(userDetailsForCourse);
      } else {
        let numberOfLessonsCompletedForThisCourse = lessonsInProgress.filter(
          (lesson) => lesson.user === allUsers[i].id && lesson.courseId === course[0].id && lesson.progress === 1
        ).length;

        let numberOfIncompleteLessons = numberOfLessonsForThisCourse - numberOfLessonsCompletedForThisCourse;
        let percentageOfIncompleteLessons = (numberOfIncompleteLessons / numberOfLessonsForThisCourse) * 100;

        let percentageOfCompletedLessons = parseInt(100 - percentageOfIncompleteLessons);
        if (numberOfLessonsCompletedForThisCourse === 0 && percentageOfCompletedLessons === 0) {
          let userDetailsForCourse = Object.assign(
            {},
            { status: 'Not started' },
            { name: allUsers[i].name },
            { surname: allUsers[i].surname },
            { enrolled: dateOfFirstAccess },
            { lastAccess: dateOfLastAccess },
            { numberOfQuizzes: numberOfQuizzesForThisCourse },
            { completedLessons: Math.round(numberOfLessonsCompletedForThisCourse) },
            { completedLessonsPercentage: Math.round(percentageOfCompletedLessons) },
            { incompleteLessons: Math.round(numberOfIncompleteLessons) },
            { incompleteLessonsPercentage: Math.round(percentageOfIncompleteLessons) }
          );

          usersAssociatedWithThisCourse.push(userDetailsForCourse);
        } else {
          let userDetailsForCourse = Object.assign(
            {},
            { status: 'In progress' },
            { name: allUsers[i].name },
            { surname: allUsers[i].surname },
            { enrolled: dateOfFirstAccess },
            { lastAccess: dateOfLastAccess },
            { numberOfQuizzes: numberOfQuizzesForThisCourse },
            { completedLessons: Math.round(numberOfLessonsCompletedForThisCourse) },
            { completedLessonsPercentage: Math.round(percentageOfCompletedLessons) },
            { incompleteLessons: Math.round(numberOfIncompleteLessons) },
            { incompleteLessonsPercentage: Math.round(percentageOfIncompleteLessons) }
          );

          usersAssociatedWithThisCourse.push(userDetailsForCourse);
        }
      }
    } else {
      usersNotassociatedWithCourse.push(allUsers[i]);
    }
  }

  return usersAssociatedWithThisCourse;
}

async function basicStatsOfUsersWatchingCoursesByAuthor(courses) {
  const models = await initModels();
  const User = models.getModel('user');
  const completedCourses = await models.getModel('completedcourse').find({});
  const coursesInProgress = await models.getModel('lessonprogress').find({});
  const allUsers = await User.find({});

  courses.forEach((course) => {
    let numberOfLessonsForThisCourse = course.lessons.length;
    let usersAssociatedWithThisCourse = [];

    allUsers.forEach((user) => {
      let userIsAssociatedWithThisCourse = coursesInProgress.filter(
        (lesson) => lesson.user === user.id && lesson.courseId === course.id
      ).length;

      let userAlreadyCompletedThisCourse = completedCourses.filter(
        (completedCourse) => completedCourse.userId === user.id && completedCourse.courseId === course.id
      ).length;

      if (userIsAssociatedWithThisCourse > 0 || userAlreadyCompletedThisCourse > 0) {
        if (userAlreadyCompletedThisCourse > 0) {
          let userDetailsForCourse = Object.assign({}, { status: 'Complete' });
          usersAssociatedWithThisCourse.push(userDetailsForCourse);
        } else {
          let numberOfLessonsCompletedForThisCourse = coursesInProgress.filter(
            (lesson) => lesson.user === user.id && lesson.courseId === course.id && lesson.progress === 1
          ).length;
          let numberOfIncompleteLessons = numberOfLessonsForThisCourse - numberOfLessonsCompletedForThisCourse;

          let percentageOfIncompleteLessons = (numberOfIncompleteLessons / numberOfLessonsForThisCourse) * 100;

          let percentageOfCompletedLessons = parseInt(100 - percentageOfIncompleteLessons);

          if (numberOfLessonsCompletedForThisCourse === 0 && percentageOfCompletedLessons === 0) {
            let userDetailsForCourse = Object.assign({}, { status: 'Not started' });

            usersAssociatedWithThisCourse.push(userDetailsForCourse);
          } else {
            let userDetailsForCourse = Object.assign({}, { status: 'In progress' });

            usersAssociatedWithThisCourse.push(userDetailsForCourse);
          }
        }
      } else {
        //pass
      }
    });

    let watching = parseInt(usersAssociatedWithThisCourse.filter((user) => user.status === 'In progress').length);
    let watched = parseInt(usersAssociatedWithThisCourse.filter((user) => user.status === 'Complete').length);
    let notStarted = parseInt(usersAssociatedWithThisCourse.filter((user) => user.status === 'Not started').length);

    course.watching = watching;
    course.watched = watched;
    course.notStarted = notStarted;
  });

  courses = await createAdminCourseStatsStructure(courses);

  return courses;
}

async function renderCourse_(req, res, isEditMode) {
  const { courseId } = req.params;
  const course = await findOneCourse(courseId, req.user);

  const readyForBindingCourse = Object.assign({}, course, {
    descriptionMarkdown: markdownConverter.makeHtml(course.description)
  });
  res.send('courses/detail', {
    course: readyForBindingCourse,
    isEditMode,
    role: req.role
  });
}

async function activateAuthorsCourses(authorId) {
  const models = await initModels();
  const course_authors__user_courses = await models
    .getModel('course_authors__user_courses')
    .find({ user_courses: authorId });

  if (course_authors__user_courses.length > 0) {
    for (let i = 0; i < course_authors__user_courses.length; i++) {
      const course = await models
        .getModel('course')
        .update({ id: course_authors__user_courses[i].course_authors })
        .set({ isPublished: 1 });
    }
  } else {
    const course = await models
      .getModel('course')
      .update({ id: course_authors__user_courses.course_authors })
      .set({ isPublished: 1 });
  }

  return `Authors courses have been activated`;
}

async function deactivateAuthorsCourses(authorId) {
  const models = await initModels();
  const course_authors__user_courses = await models
    .getModel('course_authors__user_courses')
    .find({ user_courses: authorId });

  console.log(course_authors__user_courses);

  if (course_authors__user_courses.length > 0) {
    for (let i = 0; i < course_authors__user_courses.length; i++) {
      const course = await models
        .getModel('course')
        .update({ id: course_authors__user_courses[i].course_authors })
        .set({ isPublished: 0 });
    }
  } else {
    const course = await models
      .getModel('course')
      .update({ id: course_authors__user_courses.course_authors })
      .set({ isPublished: 0 });
  }

  return `Authors courses have been deactivated`;
}

function titleCasing(title) {
  const splitSentence = title.split(' ');
  const unWantedWords = [
    'is',
    'was',
    'a',
    'are',
    'were',
    'an',
    'the',
    'and',
    'but',
    'that',
    'or',
    'too',
    'be',
    'by',
    'for',
    'nor',
    'as',
    'at',
    'by',
    'from',
    'in',
    'us',
    'into',
    'near',
    'like',
    'this',
    'you',
    'do',
    'of',
    'on',
    'onto',
    'to',
    'with',
    'did',
    'done'
  ];
  const cleanedSentence = [];

  splitSentence.forEach((word) => {
    const check = (x) => x === x.toUpperCase();
    if (unWantedWords.includes(word.toLowerCase())) {
      cleanedSentence.push(word.toLowerCase());
    } else if (check(word)) {
      cleanedSentence.push(word);
    } else {
      let wordSplit = word.split('');
      wordSplit[0] = wordSplit[0].toUpperCase();
      let cleanedWord = wordSplit.join('');
      cleanedSentence.push(cleanedWord);
    }
  });

  titleCasing = cleanedSentence.join(' ');
  return titleCasing.charAt(0).toUpperCase() + titleCasing.slice(1);
}

async function getUserCourseProgress(userId) {
  const models = await initModels();
  const lessonProgress = models.getModel('lessonprogress');
  const course = models.getModel('course');

  const courses = await course.find({ where: { and: [{ isDeleted: 0, isPublished: 1 }] } }).populate('lessons');
  const lessonsUserHasActive = await lessonProgress.find({ user: userId });
  const courseIdsOfLessonsUserHasActive = lessonsUserHasActive.map((lesson) => lesson.courseId);

  const coursesWithUserProgress = [];

  const courseProgressInformationGeneration = courses.forEach((course) => {
    if (courseIdsOfLessonsUserHasActive.includes(course.id)) {
      let totalLessonsUserHasCompleted = lessonsUserHasActive.filter(
        (lesson) => lesson.courseId === course.id && lesson.progress === 1
      ).length;
      let totalCourseLessons = course.lessons.length;
      let lastCourseAccessSorting = lessonsUserHasActive.sort((a, b) => b.updatedAt - a.updatedAt);
      let dateUserLastAccessedCourse = lastCourseAccessSorting[0].updatedAt;

      let activeCourse = {
        id: course.id,
        image: course.image,
        progress: totalLessonsUserHasCompleted,
        totalLessons: totalCourseLessons,
        lastUpdate: dateUserLastAccessedCourse,
        title: course.title
      };

      coursesWithUserProgress.push(activeCourse);
    }
  });

  return coursesWithUserProgress;
}

async function userActivityComparison(userId) {
  const models = await initModels();
  const completedCourses = models.getModel('completedcourse');
  const ratings = models.getModel('rating');

  const coursesCompleted = await completedCourses.find({});
  const userPreviews = await ratings.find({});

  const totalCompletedCourses = coursesCompleted.length;
  const totalUserReviews = userPreviews.filter((rating) => rating.userComment !== '').length;

  const usersCompletedCourses = coursesCompleted.filter((course) => course.userId === userId).length;
  const usersReviews = userPreviews.filter((rating) => rating.userComment !== '' && rating.userId === userId).length;

  const usersCompletedCoursesComparedToTotalCompletedCourses = parseInt(
    (usersCompletedCourses / totalCompletedCourses) * 100
  );
  const usersReviewsComparedToTotalReviews = parseInt((usersReviews / totalUserReviews) * 100);

  const totalReviewsConvertedToHundred = parseInt(100 - usersReviewsComparedToTotalReviews);
  const totalCompletedCoursesConvertedToHundred = parseInt(100 - usersCompletedCoursesComparedToTotalCompletedCourses);

  const reviewsStats = {
    heading: 'Contributions',
    communityContributions: totalReviewsConvertedToHundred,
    usersContributions: usersReviewsComparedToTotalReviews
  };
  const completedCoursesStats = {
    heading: 'Achievements',
    communityContributions: totalCompletedCoursesConvertedToHundred,
    usersContributions: usersCompletedCoursesComparedToTotalCompletedCourses
  };
  const quizzesStats = { heading: 'Quiz Scores', communityContributions: 100, usersContributions: 0 };

  const usersPerformanceComparison = [reviewsStats, completedCoursesStats, quizzesStats];

  return usersPerformanceComparison;
}

async function getReviews(courseId) {
  const models = await initModels();
  const getAllReviewsAssociatedWithCourse = await models.getModel('rating').find({
    where: { courseId: courseId },
    sort: 'date ASC'
  });

  return getAllReviewsAssociatedWithCourse;
}

function getTotalUsersWatchingCourse(lessonsInProgress) {
  let userIds = lessonsInProgress.map((lesson) => lesson.user);
  let uniqueUserIds = new Set(userIds);
  let totalUsersWatchingCourse = uniqueUserIds.size;
  return totalUsersWatchingCourse;
}

function getTotalUsersThatCompletedCourse(coursesWatched) {
  return coursesWatched.length;
}

module.exports = {
  userActivityComparison,
  getUserCourseProgress,
  deactivateAuthorsCourses,
  activateAuthorsCourses,
  renderCourse_,
  findCourseByTitle,
  findUsersThatCompletedAuthoredCourses,
  getCoursesWithLessons,
  findAllCourses,
  findOneCourse,
  findCourseByAuthor,
  findCoursesbySubstring,
  findCoursesByTag,
  findUsersAndTheirCompletedCourses,
  findUsersWithProgress,
  saveLatestCourseCompleted,
  findUserAndCompletedCoursesFromDb,
  findCoursesWithUserProgress,
  addTagToCourse,
  addAuthorToCourse,
  assignAuthorToCourse,
  findCourseWithTittle,
  sendEmailWhenCourseIsCompleted,
  getTitlesOfCourses,
  getTagsOfCourses,
  getAuthorsOfCourses,
  getTitlesTagsAndAuthorsOfCourses,
  getTitlesOfWatchedAndWatchingCourses,
  getAuthorsOfWatchedAndWatchingCourses,
  getTagsOfWatchedAndWatchingCourses,
  getRecommendedCourses,
  isTagOfCourse,
  findUsersThatCompletedACourse,
  isAuthorOfCourse,
  isWatchedOrWatchingCourse,
  getTagsOfOneCourse,
  selectOneRandomCourse,
  randomiseCourses,
  createMapOfCourseIdAndTitle,
  createMapOfFirstLessonIdAndCourseTitle,
  getCoursesAuthoredByUser,
  getNumberOfPeopleWhoCompletedThisCourse,
  getNumberOfPeopleWhoCompletedCoursesForEveryCourse,
  userCompletedThisCourse,
  getNumberOfPeopleWatchingThisCourse,
  mapOfNumberOfPeopleWatchingACourse,
  getFavouriteCourseStatus,
  getFavouriteCourses,
  getNumberOfPeopleWhoCompletedCoursesByThisAuthor,
  getNumberOfPeopleWhoAreWatchingCoursesByThisAuthor,
  getNumberOfPeopleWhoCompletedAndAreWatchingCourses,
  getNumberOfFavouriteCourses,
  getMostPopularCourses,
  getMostPopularCoursesOfAuthor,
  addCompletedCourse,
  getActiveCoursesAuthoredByUser,
  getArchivedCoursesByUser,
  courseStatisticsForAuthor,
  updateCourseWhenLessonIsEdited,
  getMostRecentCoursesByAuthor,
  getAllUsersWatchingThisCourse,
  getAllUsersWhoCompletedThisCourse,
  getUsersAssociatedWithThisCourse,
  getDateOfLastAccessForCourse,
  renderCourse,
  basicStatsOfUsersWatchingCoursesByAuthor,
  createAdminSidepanelCourseStatsStructure,
  getUnwatchedCourses,
  getSidePanelActiveCoursesAuthoredByUser,
  getCourseTitlesAuthoredByUser,
  getIdsOfUsersWatchingThisCourse,
  getIdsOfUsersWhoCompletedThisCourse,
  getTitlesOfAllCoursesBeingWatched,
  getWatchedOrWatchingCourses,
  mapOfNumberOfPeopleWatchingCoursesByAuthor,
  getNumberOfQuizzesForThisCourse,
  numberOfQuizzesForCourse,
  findCourses,
  findCourse,
  getCourseStats,
  findInitialisingCourse,
  titleCasing,
  getReviews,
  getTotalUsersThatCompletedCourse,
  getTotalUsersWatchingCourse,
  getActiveCoursesAuthoredByUser,
  createAdminSidePanelCourseStructure
};
