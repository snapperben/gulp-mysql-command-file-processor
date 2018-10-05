# gulp-mysql-command-file-processor
This is a gulp npm module that allows SQL Data Definition Language (DDL) files to be run into a MySql server as part of a controlled release process.
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
- database - The database on the host server to use by default
- force - Boolean indicating if the execution must be continued on query error (defaults to TRUE)
- serial - Boolean indicating if the sql commands should be run serially or in parallel (defaults to FALSE (run in parallel))
- setDB - Boolean - If true, use the database argument to set the db to use before applying sql files 

## Example Gulp file using gulp-mysql-command-file-processor
```js
var gulp = require('gulp');
var gmcfp = require('gulp-mysql-command-file-processor');

gulp.task('schema',[], function(cb){
	gulp.src('schema.sql')
		.pipe(gmcfp(<user, <paswd>,undefined, undefined, 'F', undefined, false, true))
		.pipe(gulp.dest('dist/db'));
	cb()
});
gulp.task('tables',['schema'], function(cb) {
	gulp.src(['table1.sql', 'table2.sql'])
		.pipe(gmcfp(<user, <paswd>,undefined, undefined,'M','dbName', false, false, true))
		.pipe(gulp.dest('dist/db'));
	cb()
});
gulp.task('dev_sql', ['tables'], function(cb) {
	gulp.src(['common.sql', 'dev.sql'])
		.pipe(gmcfp(<user, <paswd>,undefined, undefined,'M','dbName', false, false, true))
		.pipe(gulp.dest('dist/db'));
	cb()
});
```
#### Comments on above example Gulp tasks
##### Task 1 - schema
This task is designed to run a sql script that is hard coded to create a named schema (thus
no database argument is given). It is suggested that, if different schemas are required (dev, test and prod),
then a task should be created for each of them.<br>
Please note that this task is run in series (arg 8 as true) so it will complete on its own before
 any dependent task runs.
##### Task 2 - tables
This task is designed to work on a previously created schema (in this case it depends on 
the schema task). In contrast to the schema task, tables provides a database name which
 will be used (due to the true 9th argument) to set the database on the connection before 
 the sql files in the task are run.<br>
 As a result the table sql files do not set a specific database and therefore can be run 
 against any schema.
##### Task 3 - dev_sql
 This task depends on tables (which itself depends on schema) so that all tables are rebuilt on 
 the schema each time it is run and, like in the tables task, uses the provided database name to 
 dictate which schema the sql is run against.<br>
 In a real scenario this task would be split into several tasks so common sql could be run against
  all schemas and then environment specific sql could be run as appropriate.
## Example sql files
Below are examples of the sql files that I have used in my project. They are all completely legal
 MySql script files where each distinct command is terminated with a ';' 
 (See the stored procedure section for a slight variation on delimiting commands)<br>
 In each case the files are designed to be idempotent (aka self-contained) so that they can
  be run again with no complications or side effects.
### Schema creation DDL
This file creates a specific database schema, dropping it if it exists so that it can be part 
of a repeatable flow.<br> 
```sql
DROP SCHEMA IF EXISTS `DB_NAME` ;
CREATE SCHEMA IF NOT EXISTS `DB_NAME` DEFAULT CHARACTER SET utf8 ;
```
### Table Creation DDL
This file is an example of database agnostic DDL (see example tasks 2 & 3 above) that can be run
against any schema.<br>
Please note that the use of the database name and setDB flag on the task that runs in these files
avoids table names having to be prefixed by "db_name."
```sql
DROP TABLE IF EXISTS `user` ;
CREATE TABLE IF NOT EXISTS `user` (......
```
### Data population SQL
These are standard SQL scripts that populate a database schema with data. It is these sort of files that will have to be modified to the environment they are used on (e.g. domain names and or port numbers)
```sql
TRUNCATE `table1`;
INSERT INTO `table1` (`id`, `name`, `desc`) VALUES
(1, 'Stripe', 'Stripe payment gateway');
TRUNCATE `table2`;
........
```
### Stored Procedures
Stored procedures scripts can be used by this module reliably if the SQL file follows these simple conventions
 before and after the main body of the stored procedure as laid out below.<br>
 Please note that this example assumes that the gulp task runs in each procedure in separate
 files with no database statement. These then need the database name and a true setDB (9th arg) to be
 passed to gulp-mysql-command-file-processor.
```sql
DROP PROCEDURE IF EXISTS `<PROC NAME>`;
DELIMITER <NEW DELIMITER>
CREATE PROCEDURE `<PROC NAME>`....
.......
END <NEW DELIMITER>
```
- The new delimiter by convention is normally '//' but could be another textural phrase that
 cannot be used in the body of the procedure other than to execute a preceding statement.
- The delimiter statement must be terminated by a new line and will be executed as its own
 statement, ignoring anything else in the file since the last previous statement termination.
 - The DROP statement at the start is to allow repeated application of the procedure scripts
  repeatedly without causing side effects.
