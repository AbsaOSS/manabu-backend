const Waterline = require('waterline');
const MongoAdapter = require('sails-mongo');
const debug = require('debug')('manabu:models');
require('dotenv').config();

// models
const Course = require('./Course');
const Tag = require('./Tag');
const User = require('./User');
const Lesson = require('./Lesson');
const LessonMarkdownSnapshot = require('./LessonMarkdownSnapshot');
const LessonProgress = require('./LessonProgress');
const Migration = require('./Migration');
const Presentation = require('./Presentation');
const CompletedCourse = require('./CompletedCourse');
const WebhookEmail = require('./WebhookEmail');
const TrueOrFalseQuestion = require('./TrueOrFalseQuestion');
const MultipleChoiceQuestion = require('./MultipleChoiceQuestion');
const Bookmark = require('./Bookmark');
const Favourite = require('./Favourite');
const ImageForCourse = require('./ImageForCourse');
const Rating = require('./Rating');
const AdminRequest = require('./adminRequest');
const AcceptedContributionRequest = require('./acceptedContributionRequests');
const ContributionRequestTracking = require('./contributionRequestTracking');
const ContributorRequest = require('./contributorRequests')

let mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL;

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  const mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase();
  const mongoHost = process.env[`${mongoServiceName}_SERVICE_HOST`];
  const mongoPort = process.env[`${mongoServiceName}_SERVICE_PORT`];
  const mongoDatabase = process.env[`${mongoServiceName}_DATABASE`];
  const mongoPassword = process.env[`${mongoServiceName}_PASSWORD`];
  const mongoUser = process.env[`${mongoServiceName}_USER`];

  if (mongoHost && mongoPort && mongoDatabase) {
    // eslint-disable-next-line no-multi-assign
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      // eslint-disable-next-line prefer-template
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    // eslint-disable-next-line prefer-template
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    // eslint-disable-next-line prefer-template
    mongoURL += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
  }
}

// eslint-disable-next-line no-console
console.log('going to connect to mongo at ', mongoURL);

let models;

module.exports = function initModels() {
  return new Promise((resolve, reject) => {
    if (models) {
      return resolve(models);
    }

    return Waterline.start(
      {
        adapters: {
          'sails-mongo': MongoAdapter
        },
        datastores: {
          default: {
            adapter: 'sails-mongo',
            url: mongoURL
          }
        },
        models: {
          user: User,
          tag: Tag,
          course: Course,
          lesson: Lesson,
          lessonmarkdownsnapshot: LessonMarkdownSnapshot,
          lessonprogress: LessonProgress,
          migration: Migration,
          presentation: Presentation,
          completedcourse: CompletedCourse,
          webhookemail: WebhookEmail,
          trueorfalsequestion: TrueOrFalseQuestion,
          multiplechoicequestion: MultipleChoiceQuestion,
          bookmark: Bookmark,
          favourite: Favourite,
          imageForCourse: ImageForCourse,
          rating: Rating,
          adminrequest: AdminRequest,
          acceptedcontributionrequest:AcceptedContributionRequest,
          contributionrequesttracking:ContributionRequestTracking,
          contributorrequest:ContributorRequest
        },
        defaultModelSettings: {
          datastore: 'default',
          primaryKey: 'id',
          attributes: {
            createdAt: { type: 'number', autoCreatedAt: true },
            updatedAt: { type: 'number', autoUpdatedAt: true }
          }
        }
      },
      (err, orm) => {
        if (err) {
          debug('Could not start up the ORM:\n', err);
          return reject(err);
        }

        // todo: figure out log levels
        debug('Started up the ORM');

        models = {
          getModel: (model) => Waterline.getModel(model, orm),
          orm
        };

        return resolve(models);
      }
    );
  });
};
