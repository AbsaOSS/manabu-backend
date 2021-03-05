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
        title: 'Learning Important Algorithms',
        image: '/api/uploads/Manabu_Algorithm_round_icon.png',
        rating: 4.4,
        description: 'We will have a look at some of the most common, and important, algorithms. For programming purposes, we will use Python.',
    }).fetch();

    const severus = await User.findOne({ name: 'Severus' });
    const allAuthors = [severus];

    const python = await Tag.findOne({ label: 'Python' });
    const programming = await Tag.findOne({ label: 'Programming' });
    const sorting = await Tag.findOne({ label: 'Sorting' });
    const algorithms = await Tag.findOne({ label: 'Algorithms' });
    const allTags = [python, programming, sorting, algorithms];

    await Course.addToCollection(course.id, 'authors', allAuthors.map(a => a.id));
    await Course.addToCollection(course.id, 'tags', allTags.map(t => t.id));

    await addLesson({
        title: 'What is an algorithm?',
        type: LessonTypes.VIDEO,
        source: '/api/uploads/5dea3c1cfa6ae0c4cf9495c4-5df0fef11e52e654614163fc.mp4',
        course: course.id,
        durationInSeconds: 42,
        order: 100,
        markdown: 'Let us look at a very simple example of an algorithm.',
    }, allAuthors, allTags);
};