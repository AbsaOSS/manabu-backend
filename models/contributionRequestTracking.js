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
const contributionRequestStatus = require('../models/courseRequestStatus');
module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    contributionRequestId: { type: 'string', required: true },
    adminRequestor: { type: 'string', required: true },
    courseTitle: { type: 'string', required: true },
    courseId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    userName: { type: 'string', required: true },
    userSurname: { type: 'string', required: true },
    status: { type: 'string', defaultsTo: contributionRequestStatus.PENDING },
    requestSeen: { type: 'boolean', defaultsTo: true }
  }
};
