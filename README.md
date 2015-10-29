# gulp-mysql-command-file-processor
This a gulp npm module that allows SQL Data Definition Language (DDL) files to be run into a MySql server as part of a controlled release process.
## Prerequisites
This expects you to have a mysql database and to use multiple script files containing standard mysql syntax SQL and DDL which create and populates your database schema.

In any non-trivial web development project using a MySql database you will have a different database configuration for development, production and possibly test as well. This will almost certainly require that the databases for each environment will need to be tailored to to that specific environment. Which means each environment will have
- A common set of schema creation DDL files that are used by all environments
- A specific set of database population sql files for that environment

Therefore a repeatable, definable and reliable procedure is needed to make sure that each release to an environment behaves as required.

## Usage of gulp-mysql-command-file-processor
GMCFP takes the following arguments...
- username - Database username
- password - database user password
- host - The database host server (defaults to localhost)
- port - The port the host server is listening on (defaults to 3306)
- log level - DEFAULT Low. Can be:: 'NONE' - no logging; 'MED'|'M' - Medium logging (no command echo); 'FULL'|'F' - Full logging (commands echoed)

```js
var gulp = require('gulp');
var gmcfp = require('gulp-mysql-command-file-processor');

gulp.task('schema',function(cb){
	gulp.src('schema.sql')
		.pipe(gmcfp(<user, <paswd>,<host>,<port>,<log level>))
		.pipe(gulp.dest('dist/db'));
	cb()
});
gulp.task('common_sql',function(cb) {
	gulp.src(['common1.sql', 'common2.sql'])
		.pipe(gmcfp(<user, <paswd>,<host>,<port>,<log level>))
		.pipe(gulp.dest('dist/db'));
	cb()
});
gulp.task('dev_sql', ['common_sql'], function(cb) {
	gulp.src(['dev1.sql', 'dev2.sql'])
		.pipe(gmcfp(<user, <paswd>,<host>,<port>,<log level>))
		.pipe(gulp.dest('dist/db'));
	cb()
});

```

## Example sql files
Below are examples of the sql files that I have used in my project. They are all completely legal MySql script files where each distinct command is terminated with a ';'.
### Schema creation DDL
This file creates the database schema. This file was created by forward engineering a database model in MySql Workbench (free from Oracle) into a script file.
```sql
DROP SCHEMA IF EXISTS `DB_NAME` ;
CREATE SCHEMA IF NOT EXISTS `DB_NAME` DEFAULT CHARACTER SET latin1 ;
USE `DB_NAME` ;
DROP TABLE IF EXISTS `DB_NAME`.`user` ;
CREATE TABLE IF NOT EXISTS `DB_NAME`.`user` (......
```

### Data population SQL
These are standard SQL scripts that populate a database schema with data. It is these sort of files that will have to be modified to the environment they are used on (e.g. domain names and or port numbers)
```sql
USE `DB_NAME`;
TRUNCATE `table1`;
INSERT INTO `table1` (`id`, `name`, `desc`) VALUES
(1, 'Stripe', 'Stripe payment gateway');
```
