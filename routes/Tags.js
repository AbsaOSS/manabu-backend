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
const initModels = require('../models');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');

const { addTagToCourse, findCoursesByTag } = require('../services/courseService');

router.delete(
  '/deleteTag/:tagId/:courseId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const course_tags__tag_courses = await models.getModel('course_tags__tag_courses');

    const { tagId, courseId } = req.params;

    const tag = await course_tags__tag_courses.destroy({
      course_tags: courseId,
      tag_courses: tagId
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/addTagToCourse/:courseId',
  asyncMiddleware(async (req, res) => {
    const tags = req.body.tag;
    const tagList = tags.split(',');
    if (tagList.length > 1) {
      for (let i = 0; i < tagList.length; i++) {
        await addTagToCourse(tagList[i], req.params.courseId);
      }
    } else {
      await addTagToCourse(tags, req.params.courseId);
    }
    return res.status(HttpStatus.OK).send({
      message: `Tag with label ${req.body.label} added successfully.`
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
router.get(
  '/tag/:tag_id/:tagFilter',
  asyncMiddleware(async (req, res) => {
    const courses = await findCoursesByTag(req.user, req.params.tag_id);
    res.status(HttpStatus.OK).send({
      courses,
      heading: 'Filter Courses By Tag: ' + req.params.tagFilter,
      role: req.role
    });
  })
);

module.exports = router;
