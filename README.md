# gulp-mysql-command-file-processor
This a gulp npm module that allows DDL sql files to be run into a MySql server as part of a controlled release process.
## Prerequisites
This expects you to have a mysql database and multiple files containing SQL Data Definition Language (DDL) which creates your schema and populates it with data.
## Aims
In any non-trivial web development project using a MySql database you will have a different database configuration for development, production and possibly test as well. This will almost certainly require that the databases for each environment will need to be tailored to it.
This means that a specific set of database setup DDL files will have to have been created to make the dev env work and more crucially the production env.
Therefore a repeatable and
