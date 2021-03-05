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
module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id' },
    courseId: { type: 'string', required: true },
    adminRequestorId: { type: 'string', required: true },
    adminRequestorName: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    courseTitle: { type: 'string', required: true },
    courseImage: { type: 'string', required: true },
    courseDescription: { type: 'string', required: true },
    requestSeen: { type: 'boolean', defaultsTo: false }
  }
};
