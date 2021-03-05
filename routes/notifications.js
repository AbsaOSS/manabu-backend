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
const express = require('express');
const asyncMiddleware = require('../middleware/asyncMiddleware');
const initModels = require('../models');
const router = express.Router();
const HttpStatus = require('http-status-codes');
const RequestStatus = require('../models/courseRequestStatus');

router.get(
  '/contributionRequestStatus',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributionRequestTracking = models.getModel('contributionrequesttracking');

    const activeRequests = await contributionRequestTracking.find({ adminRequestor: req.user.id });

    return res.status(HttpStatus.OK).send({ activeRequests });
  })
);

router.put(
  '/markContributionRequestsAsRead',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributorRequest = models.getModel('contributorrequest');
    const contributionRequestTracking = models.getModel('contributionrequesttracking');

    await contributorRequest.update({ userId: req.user.id }).set({ requestSeen: true });
    await contributionRequestTracking.update({ adminRequestor: req.user.id }).set({ requestSeen: true });

    return res.status(HttpStatus.OK).send({ success: true });
  })
);

router.get(
  '/contributionRequests',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributorRequest = models.getModel('contributorrequest');

    const requests = await contributorRequest.find({ userId: req.user.id });

    return res.status(HttpStatus.OK).send({ requests });
  })
);

router.get(
  '/notificationCount',
  asyncMiddleware(async (req, res) => {
    const models = await initModels();
    const contributorRequest = models.getModel('contributorrequest');
    const contributionRequestTracking = models.getModel('contributionrequesttracking');

    const requests = await contributorRequest.find({ userId: req.user.id });
    const requestStatus = await contributionRequestTracking.find({ adminRequestor: req.user.id });

    const totalRequestsNotifications = requests.filter((request) => request.requestSeen === false).length;
    const totaleRequestStatusNotifications = requestStatus.filter(
      (request) =>
        request.requestSeen === false &&
        (request.status === RequestStatus.REJECTED || request.status === RequestStatus.ACCEPTED)
    ).length;

    const totalUnseenNotifications = parseInt(totalRequestsNotifications + totaleRequestStatusNotifications);

    return res.status(HttpStatus.OK).send({ notifications: totalUnseenNotifications });
  })
);

module.exports = router;
