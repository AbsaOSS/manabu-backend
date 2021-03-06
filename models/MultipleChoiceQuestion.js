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

module.exports = {
    attributes: {
        id: { type: 'string', columnName: '_id' },
        question: { type: 'string', required: true },
        option1: { type: 'string', required: true },
        option2: { type: 'string', required: true },
        option3: { type: 'string', required: false },
        option4: { type: 'string', required: false },
        answer: { type: 'string', required: true },
        courseId: { type: 'string', required: true },
        lessonId: { type: 'string', required: true },
        questionType: { type: 'string', required: true }
    }
};