# gulp-mysql-command-file-processor
This a gulp npm module that allows SQL Data Definition Language (DDL) files to be run into a MySql server as part of a controlled release process.
## Prerequisites
This expects you to have a mysql database and use multiple script files containing SQL and DDL which creates and populates your database schema.
## Aims
In any non-trivial web development project using a MySql database you will have a different database configuration for development, production and possibly test as well.

This will almost certainly require that the databases for each environment will need to be tailored to to that specific environment. Which means each environment will have
- A shared set of schema creation DDL files that are common
- A specific set of database population files that are required for that environment

Therefore a repeatable, definable and reliable procedure is needed to make sure that each release to an environment behaves as required.
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
## Usage of gulp-mysql-command-file-processor
```js
var gulp = require('gulp');
var gmcfp = require('gulp-mysql-command-file-processor');

gulp.task('default', function(cb) {
	gulp.src('../db/populate_ecommerce.sql')
		.pipe(gmcfp(<username>, <passwd>, <host>,<port>))
		.pipe(gulp.dest('dist'));
	cb()
});

```
