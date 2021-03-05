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

exports.func = async function migrate(models) {
  const User = models.getModel('user');

  // users/authors
  await User.create({
    email: 'cersei@casterlyrock.com',
    name: 'Cersei',
    surname: 'Lannister',
    image: ''
  });

  await User.create({
    email: 'jon@thewall.com',
    name: 'Jon',
    surname: 'Snow',
    image: ''
  });

  await User.create({
    email: 'dany@dragonstone.com',
    name: 'Danaerys',
    surname: 'Targaryen',
    image: ''
  });

  await User.create({
    email: 'albus@hogwarts.com',
    name: 'Albus',
    surname: 'Dumbledore',
    image: ''
  });

  await User.create({
    email: 'severus@hogwarts.com',
    name: 'Severus',
    surname: 'Snape',
    image: ''
  });
};
