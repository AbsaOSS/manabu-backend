const express = require('express');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const initModels = require('../models');
const jwt = require('jsonwebtoken');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const contributionRequestStatus = require('../models/courseRequestStatus');

router.post(
  '/addContributor',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributorRequest = models.getModel('contributorrequest');
    const contributionRequestTracking = models.getModel('contributionrequesttracking');

    let { contributors, contributorsMetaData } = req.body;

    contributors.forEach((contributor) => {
      contributor.adminRequestorId = req.user.id;
      contributor.adminRequestorName = req.user.name;
    });

    let createdContributionRequests = await contributorRequest.createEach(contributors).fetch();
    let contributionRequestsToBeTracked = [];

    createdContributionRequests.forEach((contributionRequest) => {
      contributor = contributorsMetaData.filter((contributor) => contributor.id === contributionRequest.userId)[0];
      requestBeingTracked = {
        contributionRequestId: contributionRequest.id,
        adminRequestor: contributionRequest.adminRequestorId,
        courseTitle: contributionRequest.courseTitle,
        courseId: contributionRequest.courseId,
        userId: contributor.id,
        userName: contributor.name,
        userSurname: contributor.surname
      };

      contributionRequestsToBeTracked.push(requestBeingTracked);
    });

    await contributionRequestTracking.createEach(contributionRequestsToBeTracked);

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.post(
  '/acceptContributionRequest/:contributionRequestId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributorRequest = models.getModel('contributorrequest');
    const acceptedContributionRequest = models.getModel('acceptedcontributionrequest');
    const contributionRequestTracking = models.getModel('contributionrequesttracking');
    let token;

    const contributionRequestId = req.params.contributionRequestId;

    if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }

      const decoded = jwt.decode(token);

      const contributionRequest = await contributorRequest.findOne({ id: contributionRequestId, userId: req.user.id });

      await contributionRequestTracking
        .updateOne({ contributionRequestId: contributionRequestId })
        .set({ status: contributionRequestStatus.ACCEPTED, requestSeen: false });

      await acceptedContributionRequest.create({
        courseId: contributionRequest.courseId,
        userId: contributionRequest.userId,
        abNumber: decoded.preferred_username,
        userName: decoded.given_name,
        userSurname: decoded.family_name
      });

      await contributorRequest.destroy({ id: contributionRequestId });
    }

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.post(
  '/rejectContributionRequest/:contributorRequestId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributorRequest = models.getModel('contributorrequest');
    const contributionRequestTracking = models.getModel('contributionrequesttracking');

    const contributionRequestId = req.params.contributorRequestId;

    await contributionRequestTracking
      .updateOne({ contributionRequestId: contributionRequestId })
      .set({ status: contributionRequestStatus.REJECTED, requestSeen: false });

    await contributorRequest.destroy({ id: contributionRequestId });

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.delete(
  '/deleteContributionRequestStatus/:contributionRequestId',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributionRequestTracking = models.getModel('contributionrequesttracking');

    await contributionRequestTracking.destroy({ contributionRequestId: req.params.contributionRequestId });

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

module.exports = router;
