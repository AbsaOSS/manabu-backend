const stdio = require('stdio');
const fs = require('fs');
const initModels = require('../models');
const _ = require('lodash');


const opts = stdio.getopt({
  name: { key: 'n', args: 1, description: 'The migration name' },
  // eslint-disable-next-line object-curly-newline
  cmd: { key: 'c', args: 1, description: 'The command name', mandatory: true },
});


function formatName(title, date) {
  return `${date.getTime()}-${title}`;
}

function create(name) {
  const template =
`
exports.func = async function migrate(models) {
  const User = models.getModel('user');
  const Cersei = await User.create({
    email: 'cersei@casterlyrock.com',
    name: 'Cersei',
    surname: 'Lannister',
    image: 'Cersei_hs_preview.jpeg',
  }).fetch();
};
`;

  const path = `./scripts/migrations/${name}.js`;
  fs.writeFileSync(path, template);
  // eslint-disable-next-line no-console
  console.log('created migration at ', path);
}

async function migrate() {
  const models = await initModels();
  const Migration = models.getModel('migration');

  const allMigrations = await Migration.find();
  const lastMigrationTimestamp = allMigrations.length
    ? parseInt(_.last(allMigrations).createdAt, 10)
    : 0;

  const rawMigrationPaths = fs.readdirSync('./scripts/migrations')
    .filter(file => file.match(/^\d+/));

  const fileMigrationsWithTimestamps = rawMigrationPaths.map((file) => { // eslint-disable-line
    return {
      timestamp: parseInt(file.match(/^(\d+)/)[1], 10),
      file,
    };
  });

  const migrationsToRun = fileMigrationsWithTimestamps
    .filter(fileMigration => fileMigration.timestamp > lastMigrationTimestamp);

  if (!migrationsToRun.length) {
    // eslint-disable-next-line no-console
    console.log('did not find any migrations to run');
    return;
  }


  for (let index = 0; index < migrationsToRun.length; index += 1) {
    const migration = migrationsToRun[index];
    const fullMigrationPath = `./migrations/${migration.file}`;
    // eslint-disable-next-line
    const importedMigration = require(fullMigrationPath);
    // eslint-disable-next-line no-console
    console.log('running migration: ', fullMigrationPath);

    // eslint-disable-next-line no-await-in-loop
    await importedMigration.func(models);

    // eslint-disable-next-line no-await-in-loop
    await Migration.create({
      path: migration.file,
    });
  }
}

if (['create', 'migrate'].indexOf(opts.cmd) === -1) {
  // eslint-disable-next-line no-console
  console.log('Unknown command: ', opts.cmd);
  process.exit(0);
}

if (opts.cmd === 'create') {
  const migrationName = formatName(opts.name, new Date());
  create(migrationName);
  process.exit(0);
}

if (opts.cmd === 'migrate') {
  migrate()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('finished with migration');
      process.exit(0);
    })
    // eslint-disable-next-line no-console
    .catch(err => console.log('error while migrating ', err));
}
