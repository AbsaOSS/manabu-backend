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

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const lessMiddleware = require('less-middleware');
const syncLocalUser = require('./middleware/syncLocalUser');
const Keycloak = require('keycloak-connect');
const compression = require('compression');
const bodyParser = require('body-parser');

require('./models');

const courseRoute = require('./routes/Course');
const quizAndTestRoute = require('./routes/Quiz&Test');
const presentationRoute = require('./routes/Presentations');
const tagRoute = require('./routes/Tags');
const authorRoute = require('./routes/Authors');
const lessonRoute = require('./routes/Lessons');
const adminLessonRoute = require('./routes/AdminLessons');
const statsRoute = require('./routes/Statistics');
const webHooksRoute = require('./routes/Webhooks');
const userRoute = require('./routes/Users');
const bookmarkRoute = require('./routes/Bookmark');
const adminRouter = require('./routes/admin');
const indexRouter = require('./routes/index');
const superAdminRouter = require('./routes/superAdmin');
const courseContributionRequestsRoute = require('./routes/contributionRequests');
const notificationRoute = require('./routes/notifications');
const kcConfig = {
  realm: 'Manabu',
  'bearer-only': true,
  'auth-server-url': process.env.AUTH_SERVER_URL,
  'ssl-required': 'external',
  resource: 'test-backend',
  'confidential-port': 0
};

const cors = require('cors');

const app = express();

app.use(cors());
app.options('*', cors());

app.keycloak = new Keycloak({}, kcConfig);

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
app.use(app.keycloak.middleware());
app.use(app.keycloak.middleware({ logout: '/' }));
app.use(syncLocalUser);
app.use(compression());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/course_categories', express.static('public/course_categories'));
app.use('/api/uploads', express.static('public/uploads'));
app.use('/scripts', express.static(__dirname + '/node_modules'));
app.use(express.static(path.join(__dirname, 'node_modules')));

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.use('/api/courses', courseRoute);
app.use('/api/quizes', quizAndTestRoute);
app.use('/api/presentations', presentationRoute);
app.use('/api/tags', tagRoute);
app.use('/api/authors', authorRoute);
app.use('/api/lessons', lessonRoute);
app.use('/api/adminLessons', adminLessonRoute);
app.use('/api/stats', statsRoute);
app.use('/api/webHooks', webHooksRoute);
app.use('/api/users', userRoute);
app.use('/api/bookmarks', bookmarkRoute);
app.use('/api/admin', adminRouter);
app.use('/api/index', indexRouter);
app.use('/api/superAdmin', superAdminRouter);
app.use('/api/courseContributionRequest', courseContributionRequestsRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/course_categories', express.static('public/course_categories'));

app.use((err, req, res) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
