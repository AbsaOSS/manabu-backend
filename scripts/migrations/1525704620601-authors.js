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
