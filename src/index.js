'use strict';

var through = require('through2');
var mysql = require('mysql');
var async = require('async');

const PLUGIN_NAME = 'gulp-mysql-command-file-processor';

/**
 *
 * @param {string} _user - Database username
 * @param {string} _passw - database user password
 * @param {string} _host - The database host server (defaults to localhost)
 * @param {string} _port - The port the host server is listening on (defaults to 3306)
 * @param {string} _database - The database on the host server
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
 * @param {string} _fileName - Name of the file being streamed
 * @param {array} _commandBuffer - Array of the processed commands
 * @param {nm$_mysql.dbConnect.client|dbConnect.client} _dbConnection - A live connection to the database
 * @param {integer} _verbosity - The log level required -- 0(NONE) - 3(Full)
 * @param {bool} _force - Boolean indicating if the execution must be continued on query error (defaults to TRUE)
 * @param {bool} _serial - Boolean indicating if the sql commands should be run serially or in parallel (defaults to parallel)
 */
function processCommands(_fileName, _commandBuffer, _dbConnection, _verbosity, _force, _serial, cb) {
    var commandsDone = false;
    var commandCount = 0;
    var processNextCommand = true;
    var runCmds = [];
    var msg = '';

    _commandBuffer.map(function (cmd) {
        runCmds.push(function(done) {
            if (_verbosity > 1) {
                msg = 'Executing \'' + _fileName + '\' query #' + (commandCount + 1) + ' ........ ';
            }

            if (_verbosity === 3) {
                msg += cmd;
            }

            if (msg) {
                console.log(msg);
            }

            _dbConnection.query({sql: cmd, timeout: 60000}, function(err) {
                if (err) {
                    console.log('Command#' + (commandCount + 1) + ' in file \'' + _fileName + '\' failed :: ' + err);
                    if (!_force) {
                        process.exit(-1);
                    }
                } else {
                    if (_verbosity > 1) {
                        console.log('Successfully executed query #' + (commandCount + 1));
                    }

                    commandCount++;
                }

                done();
            });
        });
    });

    if (_serial) {
        async.series(runCmds, cb);    
    } else {
        async.parallel(runCmds, cb);    
    }
}

/**
 *
 * @param {string} _username - Database username
 * @param {string} _password - database user password
 * @param {string} _host - The database host server (defaults to localhost)
 * @param {string} _port - The port the host server is listening on (defaults to 3306)
 * @param {string} _verbosity - Log level DEFAULT Low -- 'NONE' - no logging; 'MED'|'M' - Medium logging; 'FULL@|'F' - Full logging
 * @param {string} _database - The database on the host server
 * @param {bool} _force - Boolean indicating if the execution must be continued on query error (defaults to TRUE)
 * @param {bool} _serial - Boolean indicating if the sql commands should be run serially or in parallel (defaults to parallel)
 * @return {*|{hello}|{first, second}}
 */
function processCommandFile(_username, _password, _host, _port, _verbosity, _database, _force, _serial) {
    var buffer;
    var host = _host ? _host : 'localhost';
    var port = _port ? _port : 3306;
    var verbosity = _verbosity === 'FULL' || _verbosity === 'F' ? 3 : _verbosity === 'MED' || _verbosity === 'M' ? 2 : _verbosity === 'NONE' ? 0 : 1;
    var force = _force !== false;
    var serial = _serial === true;

    if (!(_username && _password)) {
        throw new PluginError(PLUGIN_NAME, 'Both database and username and password must be defined');
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

        var dataOffset = -1;
        var char;
        var commandBuffer = [];
        var command = '';
        var inString = false;
        var isEscaped = false;
        var isCommentBlock = 0; // 0 = false, 1 = begin, 2 = in block, 3 = end
        var delimiter = ';';
        var data = buffer.toString('utf8', 0, buffer.length);

        while (dataOffset < buffer.length) {
            char = data.charAt(dataOffset++);

            if (char === delimiter && !inString && !isEscaped && !isCommentBlock) {
                commandBuffer.push(command);
                command = '';
            } else {
                if (char === '\\') {
                    isEscaped = true;
                } else if (data.substr(dataOffset, 2) === '/*' && !inString && !isEscaped) {
                    isCommentBlock++;
                } else if (data.substr(dataOffset, 2) === '*/' && !inString && !isEscaped) {
                    isCommentBlock--;
                } else if (data.substr(dataOffset, 9).toLowerCase() === 'delimiter' && !inString && !isEscaped && !isCommentBlock) {
                    var nl = data.substr(dataOffset + 10).match('\r|\n').index;
                    delimiter = data.substr(dataOffset + 10, nl);
                    dataOffset += 10 + nl;
                } else if (!inString && !isEscaped && !isCommentBlock && (data.substr(dataOffset, 2) === '# ' || data.substr(dataOffset, 3) === '-- ')) {
                    var nl = data.substr(dataOffset).match('\r|\n').index;
                    dataOffset += nl; // skipping to the end of the line
                } else if (char === '\'' && !isEscaped) {
                    inString = !inString;
                }

                command += char;
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
        processCommands(name, commandBuffer, dbConnection, verbosity, force, serial, function(){
            dbConnection.end(function() {
                console.log('Executed ' + commandBuffer.length + ' commands from file \'' + name + '\'');
                cb(null, file);
            }); 
        });
    });
}

module.exports = processCommandFile;
