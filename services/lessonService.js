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

const diff = require('diff');
const showdown = require('showdown');
const _ = require('lodash');

const initModels = require('../models');
const getDurationFromSeconds = require('../lib/getDurationFromSeconds');
const formatDateTime = require('../lib/formatDateTime');

const { getCoursesWithLessons } = require('./courseService');

const markdownConverter = new showdown.Converter();

async function getPreviousLessonOrderNumber(courseId) {
  const models = await initModels();

  const lesson = models.getModel('lesson');

  const lessons = await lesson.find({ course: courseId });

  const previousLesson = lessons[lessons.length - 1];
  let orderNumber;
  if (!previousLesson) {
    orderNumber = 100;
  } else {
    orderNumber = previousLesson.order + 100;
  }
  return orderNumber;
}

async function addLessonWithOnlyAuthor(lesson, author) {
  const models = await initModels();
  const Lesson = models.getModel('lesson');
  let newLessonOrder = 100;

  const allLessonsForCourse = await Lesson.find({ course: lesson.course });
  if (allLessonsForCourse.length === 0) {
    newLessonOrder = 100;
  } else {
    newLessonOrder = _.maxBy(allLessonsForCourse, (o) => o.order).order + 100;
  }
  const lessonRecord = await Lesson.create(Object.assign(lesson, { order: newLessonOrder })).fetch();

  await Lesson.addToCollection(lessonRecord.id, 'authors', [author.id]);

  return lessonRecord;
}

async function updateLessonUrl(lessonId, source) {
  const models = await initModels();
  const Lesson = models.getModel('lesson');

  await Lesson.update({ id: lessonId }).set({
    source: source,
    type: 'VIDEO'
  });
}

async function updateImageUrl(courseId, imageUrl) {
  const models = await initModels();
  const Course = models.getModel('course');

  await Course.update({ id: courseId }).set({ image: imageUrl });
}

async function addLesson(lesson, authors, tags) {
  const models = await initModels();
  const Lesson = models.getModel('lesson');

  const lessonRecord = await Lesson.create(lesson).fetch();

  let associationPromises = authors.map(async (author) =>
    Lesson.addToCollection(lessonRecord.id, 'authors', [author.id])
  );

  associationPromises = associationPromises.concat(
    tags.map(async (tag) => Lesson.addToCollection(lessonRecord.id, 'tags', [tag.id]))
  );

  await Promise.all(associationPromises);
}

async function deleteLesson(lessonId) {
  const models = await initModels();
  const Lesson = models.getModel('lesson');

  await Lesson.destroy({ id: lessonId });
}

async function addLessonProgress(lessonProgress) {
  const models = await initModels();
  const LessonProgress = models.getModel('lessonprogress');
  await LessonProgress.create(lessonProgress).fetch();
}

function getDeltas({ oldMarkdown, newMarkdown }) {
  const deltas = diff.diffLines(oldMarkdown, newMarkdown);
  return deltas;
}

async function moveLesson({ courseId, lessonId, direction }) {
  const models = await initModels();

  const Lesson = models.getModel('lesson');
  const allLessonsForCourse = await Lesson.find({ course: courseId });

  const sortedLessons = allLessonsForCourse.sort((l1, l2) => l1.order - l2.order);

  const movedLesson = _.find(sortedLessons, { id: lessonId });
  const indexOfLesson = _.indexOf(sortedLessons, movedLesson);

  if (indexOfLesson < 0) {
    return;
  }

  const targetIndex = indexOfLesson + parseInt(direction, 10);

  const elementAtTarget = sortedLessons[targetIndex];
  if (!elementAtTarget) {
    return;
  }

  const movedOrder = movedLesson.order;
  const targetOrder = elementAtTarget.order;

  await Lesson.update({ id: movedLesson.id }).set({ order: targetOrder });
  await Lesson.update({ id: elementAtTarget.id }).set({ order: movedOrder });
}

async function updateLessonMarkdown({ lessonId, markdown, userId }) {
  const models = await initModels();

  const { markdown: oldMarkdown } = await models.getModel('lesson').findOne(lessonId);

  const deltas = getDeltas({ oldMarkdown, newMarkdown: markdown });

  const summedChanges = deltas.reduce(
    (aggregate, delta) => {
      const newAggregate = aggregate;
      if (delta.added) {
        newAggregate.added += delta.count;
      }

      if (delta.removed) {
        newAggregate.removed += delta.count;
      }

      return newAggregate;
    },
    { removed: 0, added: 0 }
  );

  await models.getModel('lessonmarkdownsnapshot').create({
    lessonId,
    markdown,
    author: userId,
    oldMarkdown,
    added: summedChanges.added,
    removed: summedChanges.removed
  });

  await models.getModel('lesson').update({ id: lessonId }).set({ markdown });
}

async function getLessonWithContributors({ lessonId, courseWithProgress }) {
  const models = await initModels();
  const lesson = await models
    .getModel('lesson')
    .findOne(lessonId)
    .populate('authors')
    .populate('multipleChoiceQuestions')
    .populate('trueOrFalseQuestions');

  lesson.duration = getDurationFromSeconds(lesson.durationInSeconds);

  const lessonProgress = courseWithProgress.lessonProgress
    ? courseWithProgress.lessonProgress.lessons[lessonId] || 0
    : 0;
  lesson.progress = lessonProgress;

  if (lesson.markdown) {
    const snapshots = await models.getModel('lessonmarkdownsnapshot').find({ lessonId }).populate('author');

    lesson.convertedMarkdown = markdownConverter.makeHtml(lesson.markdown);
    lesson.contributors = _(snapshots)
      .map((s) => s.author)
      .uniqBy('id')
      .value();

    lesson.contributors = snapshots.reduce((aggregate, { author, removed, added }) => {
      const { id: authorId } = author;
      const newAggregate = aggregate;
      newAggregate[authorId] = aggregate[authorId] || { removed: 0, added: 0, author };
      newAggregate[authorId].removed += removed || 0;
      newAggregate[authorId].added += added || 0;

      return newAggregate;
    }, {});
  }

  return lesson;
}

async function getContributions(lessonId) {
  const models = await initModels();
  const lesson = await models.getModel('lesson').findOne(lessonId);
  const snapshots = await models.getModel('lessonmarkdownsnapshot').find({ lessonId }).populate('author');

  const withDiffs = snapshots.map((snapshot) => {
    const diffs = _(diff.diffLines(snapshot.oldMarkdown, snapshot.markdown))
      .flatMap((lineDiff) => {
        const splitValue = lineDiff.value.split('\n');
        return splitValue.map((splitLineValue) => Object.assign({}, lineDiff, { value: splitLineValue }));
      })
      .value();
    return Object.assign({}, snapshot, {
      diffs,
      timestamp: formatDateTime(snapshot.createdAt)
    });
  });

  return {
    lesson,
    snapshots: _.reverse(withDiffs)
  };
}

async function continueWhereILeftOff(user) {
  const models = await initModels();
  const LessonProgress = models.getModel('lessonprogress');
  const foundLessonProgresses = await LessonProgress.find({
    user: user.id
  });
  const sortedArray = foundLessonProgresses.sort((a, b) => {
    const dateA = new Date(a.updatedAt);
    const dateB = new Date(b.updatedAt);
    return dateB - dateA;
  });
  return sortedArray[0];
}

async function getLatestCourse() {
  const foundCourse = await getCoursesWithLessons();

  const sortedArray = foundCourse.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateB - dateA;
  });
  return sortedArray[0];
}

async function convertBookmarkedTimeToSeconds(bookmarkedTime) {
  const bookmarkedTimeSplit = bookmarkedTime.split(':');
  const bookmarkedTimeInSeconds = bookmarkedTimeSplit[0] * 60 + +bookmarkedTimeSplit[1];
  return bookmarkedTimeInSeconds;
}

async function getPresentationAuthoredByUser(presentationId) {
  const models = await initModels();
  const Presentation = models.getModel('presentation');
  const foundPresentation = await Presentation.find({ id: presentationId });
  return foundPresentation;
}

async function getPresentation(presentationId) {
  const models = await initModels();
  const Presentation = models.getModel('presentation');
  const presentation = await Presentation.find({ id: presentationId }).limit(1);
  return presentation;
}

async function createLesson(title, course, type, markdown, duration, user) {
  let canCreateLesson = false;
  const models = await initModels();
  const Lesson = models.getModel('lesson');
  const lessonError = undefined;
  const lessons = await Lesson.find({ course: course });

  const searchedLesson = lessons.filter((lesson) => lesson.title.toLowerCase() === title.toLowerCase());

  if (!searchedLesson[0]) {
    const lesson = {
      title: title,
      type: type,
      source: '',
      course: course,
      durationInSeconds: duration,
      order: 0,
      markdown: markdown,
      category: ''
    };
    const newLesson = await addLessonWithOnlyAuthor(lesson, user);
    canCreateLesson = true;
    return [canCreateLesson, newLesson];
  }

  return [canCreateLesson, lessonError];
}

function markdDownWordCount(markdown) {
  const initialStringSplit = markdown.split('><');

  const requiredStrings = [];

  initialStringSplit.forEach((string) => {
    if (string.startsWith('figure>') || string.startsWith('oembed>') || string.startsWith('img>')) {
      //pass
    } else {
      requiredStrings.push(string);
    }
  });

  const semiCleanJoinedString = requiredStrings.join(' ');

  const stringWithoutHtmlElements = semiCleanJoinedString.replace(/(<([^>]+)>)/gi, '');
  const completelyCleanedString = stringWithoutHtmlElements.split(/[\s.&;,?%0-9]/).filter((word) => word !== '');

  return completelyCleanedString.length;
}

module.exports = {
  markdDownWordCount,
  createLesson,
  addLesson,
  addLessonProgress,
  updateLessonMarkdown,
  getLessonWithContributors,
  getContributions,
  deleteLesson,
  moveLesson,
  addLessonWithOnlyAuthor,
  updateLessonUrl,
  updateImageUrl,
  getPreviousLessonOrderNumber,
  continueWhereILeftOff,
  getLatestCourse,
  convertBookmarkedTimeToSeconds,
  getPresentationAuthoredByUser,
  getPresentation
};
