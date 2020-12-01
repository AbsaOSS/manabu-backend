const express = require('express');
const initModels = require('../models');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');

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

router.post(
  '/courses/:courseId/lessons/:lessonId/createTrueOrFalseQuestion',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const TrueOrFalseQuestion = models.getModel('trueorfalsequestion');
    const Lesson = models.getModel('lesson');

    const courseId = await req.params.courseId;

    const lessonId = await req.params.lessonId;

    const newTrueOrFalseQuestion = await TrueOrFalseQuestion.create({
      question: req.body.question,
      answer: req.body.answer,
      courseId: courseId,
      lessonId: lessonId,
      questionType: 'TrueOrFalse'
    }).fetch();

    await Lesson.addToCollection(lessonId, 'trueOrFalseQuestions', newTrueOrFalseQuestion.id);

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.put(
  '/courses/:courseId/lessons/:lessonId/editTrueOrFalseQuestion',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const TrueOrFalseQuestion = models.getModel('trueorfalsequestion');

    const courseId = await req.params.courseId;

    const lessonId = await req.params.lessonId;

    await TrueOrFalseQuestion.update({
      courseId: courseId,
      lessonId: lessonId
    })
      .set({
        question: req.body.question,
        answer: req.body.answer
      })
      .fetch();

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/:courseId/lessons/:lessonId/createMultipleChoiceQuestion',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const MultipleChoiceQuestion = models.getModel('multiplechoicequestion');
    const Lesson = models.getModel('lesson');

    const courseId = await req.params.courseId;

    const lessonId = await req.params.lessonId;

    const newMultipleChoiceQuestion = await MultipleChoiceQuestion.create({
      question: req.body.question,
      option1: req.body.option1,
      option2: req.body.option2,
      option3: req.body.option3,
      option4: req.body.option4,
      answer: req.body.answer,
      courseId: courseId,
      lessonId: lessonId,
      questionType: 'MultipleChoice'
    }).fetch();

    await Lesson.addToCollection(lessonId, 'multipleChoiceQuestions', newMultipleChoiceQuestion.id);

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/:courseId/lessons/:lessonId/answerTrueOrFalseQuestion',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const TrueOrFalseQuestion = await models.getModel('trueorfalsequestion');

    const trueOrFalseQuestion = await TrueOrFalseQuestion.find({
      courseId: req.params.courseId,
      lessonId: req.params.lessonId
    }).limit(1);

    await res.status(HttpStatus.OK).send({
      question: trueOrFalseQuestion[0].question,
      answer: trueOrFalseQuestion[0].answer
    });
  })
);

router.get(
  '/courses/:courseId/lessons/:lessonId/answerMultipleChoiceQuestion',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const MultipleChoiceQuestion = await models.getModel('multiplechoicequestion');

    const multipleChoiceQuestion = await MultipleChoiceQuestion.find({
      courseId: req.params.courseId,
      lessonId: req.params.lessonId
    }).limit(1);

    await res.status(HttpStatus.OK).send({
      question: multipleChoiceQuestion[0].question,
      option1: multipleChoiceQuestion[0].option1,
      option2: multipleChoiceQuestion[0].option2,
      option3: multipleChoiceQuestion[0].option3,
      option4: multipleChoiceQuestion[0].option4,
      answer: multipleChoiceQuestion[0].answer
    });
  })
);

module.exports = router;
