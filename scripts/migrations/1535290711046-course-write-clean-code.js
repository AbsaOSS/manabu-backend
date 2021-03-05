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
const { addLesson } = require('../../services/lessonService');
const LessonTypes = require('../../models/LessonTypes');

exports.func = async function migrate(models) {
    const Course = models.getModel('course');
    const Tag = models.getModel('tag');
    const User = models.getModel('user');

    const course = await Course.create({
        title: 'Write Clean Code',
        image: '/api/uploads/Manabu_round_icon_extra01.png',
        rating: 3,
        description: 'Learn the principles behind writing code that is easy to comprehend and maintain. This course will use Python as a programming language.',
    }).fetch();

    const severus = await User.findOne({ name: 'Severus' });
    const danaerys = await User.findOne({ name: 'Danaerys' });
    const allAuthors = [severus, danaerys];

    const programming = await Tag.findOne({ label: 'Programming' });
    const python = await Tag.findOne({ label: 'Python' });
    const comprehension = await Tag.findOne({ label: 'Comprehension' });
    const allTags = [programming, python, comprehension];

    await Course.addToCollection(course.id, 'authors', allAuthors.map(a => a.id));
    await Course.addToCollection(course.id, 'tags', allTags.map(t => t.id));

    await addLesson({
        title: 'Working in a Team',
        type: LessonTypes.VIDEO,
        source: '/api/uploads/5dea3c1cfa6ae0c4cf9495c4-5df106e276a23c582d0ecfc2.mp4',
        course: course.id,
        durationInSeconds: 72,
        order: 0,
        markdown: 'By working in a team of developers, it is imperative to write readable code.',
    }, allAuthors, allTags);
};