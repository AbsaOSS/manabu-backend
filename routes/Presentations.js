const express = require('express');
const initModels = require('../models');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const fs = require('fs');
const showdown = require('showdown');
const markdownConverter = new showdown.Converter();
const { getPresentationAuthoredByUser } = require('../services/lessonService');

router.post(
  '/presentation',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const foundPresentation = await Presentation.find({ title: req.body.title });

    if (foundPresentation.length === 1) return res.status(HttpStatus.OK).send({ presentationTitleExists: true });

    const createdPresentation = await Presentation.create({
      title: req.body.title,
      transitionType: req.body.transitionType,
      theme: req.body.theme,
      userId: req.user.id
    }).fetch();

    const lesson = {
      title: req.body.title,
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
        title: title,
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

router.post(
  '/editPresentation/:title',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    await Presentation.update({
      title: req.params.title
    }).set({
      title: req.body.title,
      transitionType: req.body.transitionType,
      theme: req.body.theme
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.delete(
  '/presentations/delete/:title',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    await Presentation.destroy({
      title: req.params.title
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/uploadPresentation/:lesson/:theme/:transition',
  asyncMiddleware(async (req, res) => {
    const lessonTitle = req.params.lesson;

    const slide = req.params.slide;

    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const presentation = await Presentation.find({
      title: req.params.lesson,
      createdBy: 'user'
    });

    slides = presentation[0].slides;

    res.status(HttpStatus.OK).send({
      lessonTitle,
      slidedata: slides,
      slide,
      presentationTheme: req.params.theme,
      presentationTransition: req.params.transition,
      role: req.role,
      role: req.role
    });
  })
);

router.get(
  '/presentations',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const presentation = models.getModel('presentation');

    presentations = await presentation.find({
      author: req.user.name,
      createdBy: 'user'
    });

    res.status(HttpStatus.OK).send({
      author: req.user.name,
      presentations,
      role: req.role
    });
  })
);

router.post(
  '/presentations',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const presentation = models.getModel('presentation');

    let fileContent = fs.readFileSync('./public/files/defaultMarkdown.txt', 'utf8');

    await presentation
      .create({
        title: req.body.title,
        slides: fileContent,
        author: req.user.name,
        createdBy: 'user',
        transitionType: req.body.transitionType,
        theme: req.body.theme
      })
      .fetch();

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/reveal/:id',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const presentation = await Presentation.find({
      id: req.params.id
    }).limit(1);

    res.status(HttpStatus.OK).send({
      slides: presentation[0].slides,
      transitionType: presentation[0].transitionType,
      theme: presentation[0].theme
    });
  })
);

router.get(
  '/reveal/:title/preview',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const presentation = await Presentation.find({
      title: req.params.title,
      createdBy: 'preview'
    }).limit(1);

    slides = presentation[0].slides;

    res.status(HttpStatus.OK).send({
      slides,
      transitionType: presentation[0].transitionType,
      theme: presentation[0].theme
    });
  })
);

router.post(
  '/uploadPresentation/:title',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    await Presentation.update({
      title: req.params.title
    }).set({
      slides: req.body.markdown
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.post(
  '/uploadTempPresentation/:title',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const Presentation = models.getModel('presentation');

    const presentations = await Presentation.find({
      title: req.params.title,
      createdBy: 'preview'
    });

    if (!presentations[0]) {
      await Presentation.create({
        title: req.params.title,
        createdBy: 'preview',
        theme: req.body.presentationTheme,
        transitionType: req.body.presentationTransition,
        author: req.user.name
      });
    }

    await Presentation.update({
      title: req.params.lesson,
      createdBy: 'preview'
    }).set({
      slides: req.body.markdown
    });

    return res.status(HttpStatus.OK).send({
      success: true
    });
  })
);

router.get(
  '/revealHelpGuide',
  asyncMiddleware(async (req, res) => {
    var contents = fs.readFileSync('public/markdown/RevealHelpGuide.md', 'utf8');
    const markdown = markdownConverter.makeHtml(contents);

    res.status(HttpStatus.OK).send({
      revealHelpGuide: markdown,
      role: req.role
    });
  })
);

module.exports = router;
