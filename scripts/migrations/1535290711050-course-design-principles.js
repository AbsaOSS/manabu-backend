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
        title: 'Principles Of Design',
        image: '/api/uploads/Manabu_round_icon_extra02.png',
        rating: 4.8,
        description: 'Learn some of the industry standards regarding good design.'
    }).fetch();

    const cersei = await User.findOne({ name: 'Cersei' });
    const albus = await User.findOne({ name: 'Albus' });
    const allAuthors = [cersei, albus];

    const ui = await Tag.findOne({ label: 'UI' });
    const colours = await Tag.findOne({ label: 'Colours' });
    const allTags = [ui, colours];

    await Course.addToCollection(
        course.id,
        'authors',
        allAuthors.map((a) => a.id)
    );
    await Course.addToCollection(
        course.id,
        'tags',
        allTags.map((t) => t.id)
    );

    await addLesson({
            title: 'Examples of Bad Use of Colour',
            type: LessonTypes.VIDEO,
            source: '/api/uploads/5dea3c1cfa6ae0c4cf9495c4-5df106e276a23c582d0ecfc2.mp4',
            course: course.id,
            durationInSeconds: 72,
            order: 100,
            markdown: 'We will look at how bad colour combinations may lead to ugly designs.'
        },
        allAuthors,
        allTags
    );
};