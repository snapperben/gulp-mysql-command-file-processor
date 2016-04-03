'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var mysql = require('mysql');

const PLUGIN_NAME = 'gulp-mysql-command-file-processor';

/**
 *
 * @param _user
 * @param _passw
 * @param _host
 * @param _port
 * @param _database
 * @returns {nm$_mysql.dbConnect.client|dbConnect.client}
 */
function dbConnect(_user, _passw, _host, _port, _database) {
    var client = mysql.createConnection({
        host: _host,
        user: _user,
        password: _passw,
        port: _port,
        database: _database
    });
    client.connect();
    return client;
}

/**
 *
 * @param _fileName - Name of the file being streamed
 * @param _commandBuffer - Array of the processed commands
 * @param _dbConnection - A live connection to the database
 * @param _verbosity - The log level required -- 0(NONE) - 3(Full)
 */
function processCommands(_fileName, _commandBuffer, _dbConnection, _verbosity) {
    var commandsDone = false;
    var commandCount = 0;
    var processNextCommand = true;
    var runCmd = function() {
        var msg = '';
        if (!commandsDone) {
            if (processNextCommand) {
                if (_verbosity > 1) {
                    msg = 'Executing \'' + _fileName + '\' query #' + (commandCount + 1) + ' ........ ';
                }

                if (_verbosity === 3) {
                    msg += _commandBuffer[commandCount];
                }

                if (msg) {
                    console.log(msg);
                }

                processNextCommand = false;
                _dbConnection.query(_commandBuffer[commandCount] + ';', function(err, res) {
                    if (err) {
                        console.log('Command#' + (commandCount + 1) + ' in file \'' + _fileName + '\' failed :: ' + err);
                        process.exit(-1);
                    } else {
                        if (_verbosity > 1) {
                            console.log('Successfully executed query #' + (commandCount + 1));
                        }

                        commandCount++;
                        if (commandCount === _commandBuffer.length) {
                            commandsDone = true;
                            _dbConnection.end(function(err) {});
                            if (_verbosity > 0) {
                                console.log('Executed ' + commandCount + ' commands from file \'' + _fileName + '\'');
                            }
                        } else {
                            processNextCommand = true;
                        }
                    }
                });
            }

            setTimeout(runCmd, 40);
        }
    };

    if (_commandBuffer.length > 0) {
        runCmd();
    }
}

/**
 *
 * @param _username - Database username
 * @param _password - database user password
 * @param _host - The database host server (defaults to localhost)
 * @param _port - The port the host server is listening on (defaults to 3306)
 * @param _verbosity - Log level DEFAULT Low -- 'NONE' - no logging; 'MED'|'M' - Medium logging; 'FULL@|'F' - Full logging
 * @param _database - The database on the host server
 * @return {*|{hello}|{first, second}}
 */
function processCommandFile(_username, _password, _host, _port, _verbosity, _database) {
    var buffer;
    var host = _host ? _host : 'localhost';
    var port = _port ? _port : 3306;
    var verbosity = _verbosity === 'FULL' || _verbosity === 'F' ? 3 : _verbosity === 'MED' || _verbosity === 'M' ? 2 : _verbosity === 'NONE' ? 0 : 1;
    if (!(_username && _password)) {
        throw new gutil.PluginError(PLUGIN_NAME, 'Both database and username and password must be defined');
    }

    return through.obj(function(file, enc, cb) {
        if (file.isBuffer()) {
            buffer = file.contents;
        } else if (file.isStream()) {
            buffer = file.contents;
        } else {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Buffers not supported!'));
            return cb();
        }

        var dataOffset = 0;
        var char;
        var commandBuffer = [];
        var command = '';
        var inString = false;
        var isEscaped = false;
        var isCommentBlock = 0; // 0 = false, 1 = begin, 2 = in block, 3 = end
        var data = buffer.toString('utf8', 0, buffer.length);

        while (dataOffset < buffer.length) {
            char = data.charAt(dataOffset++);
            command += char;
            if (char === ';' && !(inString || isEscaped || isCommentBlock)) {
                commandBuffer.push(command);
                command = '';
            } else {
                if (char === '\\') {
                    isEscaped = true;
                } else if (char === '/' && !inString) {
                    if (isCommentBlock === 3) {
                        isCommentBlock = 0;
                    } else {
                        isCommentBlock = 1;
                    }
                } else if (char === '*' && !inString) {
                    if (isCommentBlock === 1) {
                        isCommentBlock = 2;
                    } else {
                        isCommentBlock = 3;
                    }
                } else {
                    if (isCommentBlock === 1 || isCommentBlock === 3) {
                        isCommentBlock = 0;
                    }

                    if (char === '\'' && !isEscaped) {
                        inString = !inString;
                    }
                }
            }

            if (isEscaped) {
                isEscaped = false;
            }
        }

        // ignoring new line at end of the buffer, but sending the last request even if it is not closed with `;`
        if (command.trim().length) {
            commandBuffer.push(command);
        }

        var dbConnection = dbConnect(_username, _password, host, port, _database);
        var name = file.path;
        if (verbosity > 0) {
            console.log('Starting to process \'' + name + '\'');
        }
        processCommands(name, commandBuffer, dbConnection, verbosity);
        cb(null, file);
    });
}

module.exports = processCommandFile;
