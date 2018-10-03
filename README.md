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

```js
var gulp = require('gulp');
var gmcfp = require('gulp-mysql-command-file-processor');

gulp.task('schema',function(cb){
	gulp.src('schema.sql')
		.pipe(gmcfp(<user, <paswd>,<host>,<port>,<log level>,<database>))
		.pipe(gulp.dest('dist/db'));
	cb()
});
gulp.task('common_sql',function(cb) {
	gulp.src(['common1.sql', 'common2.sql'])
		.pipe(gmcfp(<user, <paswd>,<host>,<port>,<log level>,<database>, false, false, true))
		.pipe(gulp.dest('dist/db'));
	cb()
});
gulp.task('dev_sql', ['common_sql'], function(cb) {
	gulp.src(['dev1.sql', 'dev2.sql'])
		.pipe(gmcfp(<user, <paswd>,<host>,<port>,<log level>,<database>))
		.pipe(gulp.dest('dist/db'));
	cb()
});
```
- Please note that in the second example, if the database name is provided (the 6th argument),
it will be used to set the database on the connection before the sql file is processed

## Example sql files
Below are examples of the sql files that I have used in my project. They are all completely legal
 MySql script files where each distinct command is terminated with a ';' 
 (See the stored procedure section for a slight variation on delimiting commands)
### Schema creation DDL
This file creates the database schema. 
This file was created by forward engineering a database model in MySql Workbench (free from Oracle) into a script file.
<br><br>Please note that the "USE `DB_NAME`;" command in your SQL file avoids table names having to be prefixed by "db_name.". If you do not have explicit "USE DB_NAME;"
commands in your SQL files, a database name an d a flag indicating you want to use that database for SQL script files can be supplied. 
```sql
DROP SCHEMA IF EXISTS `DB_NAME` ;
CREATE SCHEMA IF NOT EXISTS `DB_NAME` DEFAULT CHARACTER SET latin1 ;
USE `DB_NAME` ;
DROP TABLE IF EXISTS `user` ;
CREATE TABLE IF NOT EXISTS `user` (......
```

### Data population SQL
These are standard SQL scripts that populate a database schema with data. It is these sort of files that will have to be modified to the environment they are used on (e.g. domain names and or port numbers)
```sql
USE `DB_NAME`;
TRUNCATE `table1`;
INSERT INTO `table1` (`id`, `name`, `desc`) VALUES
(1, 'Stripe', 'Stripe payment gateway');
```
### Stored Procedures
Stored procedures scripts can be used by this module reliably if the SQL file follows these simple conventions
 before and after the main body of the stored procedure as laid out below...
```sql
DROP PROCEDURE IF EXISTS `<PROC NAME>`;

DELIMITER <NEW DELIMITER>

CREATE PROCEDURE `<PROC NAME>`....

.......

END <NEW DELIMITER>
DELIMITER ;
```
- The new delimiter by convention is normally '//' but could be another textural phrase that
 cannot be used in the body of the procedure other than to execute a preceding statement.
- The delimiter statement must be terminated by a new line and will be executed as its own
 statement, ignoring anything else in the file since the last previous statement termination.
 - The DROP statement at the start is to allow repeated application of the procedure scripts without
causing error messages.
