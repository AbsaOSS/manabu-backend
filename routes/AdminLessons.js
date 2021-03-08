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
const router = express.Router();
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const https = require('https');
const cors = require('cors');
const initModels = require('../models/');

const { updateLessonUrl, createLesson } = require('../services/lessonService');
const {
    titleCasing
} = require('../services/courseService')

router.post(
    '/lesson',
    asyncMiddleware(async(req, res) => {

        const [canAddLesson, lesson] = await createLesson(
            titleCasing(req.body.title),
            req.body.course,
            req.body.type,
            req.body.markdown,
            req.body.duration,
            req.user
        );
        if (canAddLesson) {
            return res.status(HttpStatus.OK).send({ success: true });
        }
        return res.status(HttpStatus.OK).send({ success: false });
    })
);

router.post(
    '/courseUploadVideo',
    cors(),
    asyncMiddleware(async(req, res) => {
        let createdCourse = {};

        let fileName;
        const s3 = new aws.S3({
            s3BucketEndpoint: true,
            endpoint: process.env.AWS_S3_ENDPOINT,
            accessKeyId:process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            region: 'symphony'
        });

        aws.config.update({
            httpOptions: {
                agent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        });

        const storage = multerS3({
            s3,
            bucket: 'manabu',
            acl: 'public-read',
            key: async(multerReq, file, cb) => {
                const models = await initModels();
                const Course = await models.getModel('course');
                const courses = await Course.find({});

                const coursesMatched = courses.filter(
                    (course) => course.title === req.body.courseTitle
                );

                if (coursesMatched.length === 0) {
                    createdCourse = await Course.create({
                        title: titleCasing(req.body.courseTitle),
                        image: req.body.image,
                        description: req.body.courseDescription,
                        isPublished: req.body.isPublished
                    }).fetch();
                    await Course.addToCollection(createdCourse.id, 'authors', req.user.id);
                } else {
                    return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
                }

                fileName = createdCourse.id + '-' + Date.now() + '.' + req.body.fileExtension;
                cb(null, fileName);
            }
        });

        let upload = multer({ storage: storage});

        upload.single('file')(req, res, async(err) => {
            let lessonId;
            if (err) {
                console.log('Error while uploading file ', err);
                return next(err);
            }
            if (req.body.lessonId !== null && req.body.lessonId !== undefined) {
                lessonId = req.body.lessonId;
            } else {
                const lesson = await createLesson(
                    titleCasing(req.body.title),
                    createdCourse.id,
                    req.body.type,
                    '',
                    req.body.duration,
                    req.user
                );
                lessonId = lesson.id;
            }
            await updateLessonUrl(lessonId, s3.endpoint.href + req.file.key);
            return res.status(HttpStatus.OK).send({ success: true });
        });
    }));

router.post(
    '/uploadVideo',
    cors(),
    asyncMiddleware(async(req, res) => {
        let fileName;
        const s3 = new aws.S3({
            s3BucketEndpoint: true,
            endpoint: process.env.AWS_S3_ENDPOINT,
            accessKeyId:process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            region: 'symphony'
        });

        aws.config.update({
            httpOptions: {
                agent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        });

        const storage = multerS3({
            s3,
            bucket: 'manabu',
            acl: 'public-read',
            key: (multerReq, file, cb) => {
                fileName = req.body.courseId + '-' + Date.now() + '.' + req.body.fileExtension;
                cb(null, fileName);
            }
        });

        let upload = multer({ storage: storage});

        upload.single('file')(req, res, async(err) => {
            let lessonId;
            let canCreateLesson;
            let lesson;
            if (err) {
                console.log('Error while uploading file ', err);
                return next(err);
            }
            if (req.body.lessonId !== null && req.body.lessonId !== undefined) {
                lessonId = req.body.lessonId;
            } else {
                [canCreateLesson, lesson] = await createLesson(
                    titleCasing(req.body.title),
                    req.body.courseId,
                    req.body.type,
                    '',
                    req.body.duration,
                    req.user
                );
            }
            if (canCreateLesson) {
                lessonId = lesson.id;
                await updateLessonUrl(lessonId, s3.endpoint.href + req.file.key);
                return res.status(HttpStatus.OK).send({ success: true });
            } else {
                return res.status(HttpStatus.BAD_REQUEST).send({ success: false });
            }
        });
    }));

module.exports = router;