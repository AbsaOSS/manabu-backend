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
    isDeleted: { type: 'number', defaultsTo: 0 },
    isPublished: { type: 'number', defaultsTo: 0 },
    numberOfLessonsToAdd: { type: 'number', defaultsTo: 1 },
    rating: { type: 'number', defaultsTo: 0 },
    title: { type: 'string', required: true },
    description: { type: 'string', required: false },
    image: { type: 'string', required: false },
    coursePreRequisites: { type: 'string', required: false },
    courseAudience: { type: 'string', required: false },
    courseLevel: { type: 'string', required: false },
    authors: {
      collection: 'user',
      via: 'courses'
    },
    tags: {
      collection: 'tag',
      via: 'courses'
    },
    lessons: {
      collection: 'lesson',
      via: 'course'
    },
    reviews: {
      collection: 'rating',
      via: 'courseId'
    }
  }
};
