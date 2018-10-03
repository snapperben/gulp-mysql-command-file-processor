'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var mysql = require('mysql');
var async = require('async');

var PLUGIN_NAME = 'gulp-mysql-command-file-processor';

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
 * @param {string} _dbName - If set then use this namne to set the database on the connection before issuing any commands
 */
function processCommands(_fileName, _commandBuffer, _dbConnection, _verbosity, _force, _serial, _dbName, cb) {
    var commandsDone = false;
    var commandCount = 0;
    var processNextCommand = true;
    var runCmds = [];
    var msg = '';
	var setDB = _dbName !== undefined && _dbName !== '';

	if (setDB){
		if (_verbosity > 1) {
			console.log('Setting database to `'+_dbName+'`......');
		}
		_dbConnection.query({sql: 'USE `'+_dbName+'`;', timeout: 60000}, function(err) {
			if (err) {
				console.log('USE DB Command failed :: ' + err);
				if (!_force) {
					process.exit(-1);
				}
			} else {
				if (_verbosity > 1) {
					console.log('Done');
				}
			}
		});
	}
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

function CharParser(){

	this.skipDelimiter = function(_offset){
		return _offset - this.delimLen;
	}
	this.testDelimiter = function(_buffer, _offset){
		return _buffer.substr(_offset, this.delimLen) === this.delimStr;
	}
	this.setDelimiter = function(_newDelimStr){
		if (typeof _newDelimStr === 'string'){
			this.delimStr = _newDelimStr;
			this.delimLen = this.delimStr.length;
			this.defDelimiter = false;
		} else {
			this.delimStr = ';';
			this.delimLen = 1;
			this.defDelimiter = true;
		}
	}

	this.processCharacters = function(_data) {
		var char, inString = false, isEscaped = false, nextCharEscaped = false,
			isCommentBlock = 0, // 0 = false, 1 = begin, 2 = in block, 3 = end
			commandBuffer = [], command = '', dataOffset = -1, isDelim = false;

		while (dataOffset < _data.length) {
			dataOffset++;
			isDelim = this.testDelimiter(_data, dataOffset);
			if (isDelim && !inString && !isEscaped && !isCommentBlock) {
				if (!this.defDelimiter){
					dataOffset+=(this.delimLen-1)
				}
				command += ';';
				commandBuffer.push(command);
				command = '';
			} else if (_data.substr(dataOffset, 9).toLowerCase() === 'delimiter' &&
					   !inString && !isEscaped && !isCommentBlock) {
				var nl = 1, delimStr = _data.substr(dataOffset + 10);
				if (delimStr.length > 0){
					if (_data.substr(dataOffset + 10).match('\r|\n')) {
						nl = _data.substr(dataOffset + 10).match('\r|\n').index
					}
				}
				var delimiter = _data.substr(dataOffset + 10, nl);
				dataOffset += 10 + nl;
				this.setDelimiter(delimiter.trim());
			} else {
				char = _data.charAt(dataOffset);

				if (!isEscaped) {
					if (char === '\\' && !isCommentBlock && !isCommentBlock) {
						nextCharEscaped = true
					} else if (_data.substr(dataOffset, 2) === '/*' && !inString) {
						isCommentBlock++;
					} else if (_data.substr(dataOffset, 2) === '*/' && !inString) {
						isCommentBlock--;
					} else if (!inString && !isEscaped && !isCommentBlock &&
						(_data.substr(dataOffset, 2) === '# ' ||
						_data.substr(dataOffset, 3) === '-- ')) {
						var nl = _data.substr(dataOffset).match('\r|\n').index;
						char = '';//_data.substr(dataOffset, nl);
						dataOffset += nl; // skipping to the end of the line
					} else if (char === '\'' && !isCommentBlock) {
						inString = !inString;
					}
				}
				command += char;
			}
			if (nextCharEscaped){
				isEscaped = true;
				nextCharEscaped = false;
			} else if (isEscaped) {
				isEscaped = false;
			}
		}
		// ignoring new line at end of the buffer, but sending the last request even if it is not closed with `;`
        if (command.trim().length) {
            commandBuffer.push(command);
        }
		return commandBuffer;
	}
	this.setDelimiter();
}

/**
 *
 * @param {string} _username - Database username
 * @param {string} _password - database user password
 * @param {string} _host - The database host server (defaults to localhost)
 * @param {string} _port - The port the host server is listening on (defaults to 3306)
 * @param {string} _verbosity - Log level DEFAULT Low -- 'NONE' - no logging; 'MED'|'M' - Medium logging; 'FULL@|'F' - Full logging
 * @param {string} _database - The database on the host server
 * @param {boolean
 * } _force - Boolean indicating if the execution must be continued on query error (defaults to TRUE)
 * @param {boolean} _serial - If true then run tasks in serial. anything else, tasks run in parallel
 * @param {boolean} _setDB - If set to true then use the database (argument 5) to set the database before running files in
 * @return {*|{hello}|{first, second}}
 */
function processCommandFile(_username, _password, _host, _port, _verbosity, _database, _force, _serial, _setDB) {
    var buffer;
    var host = _host ? _host : 'localhost';
    var port = _port ? _port : 3306;
    var verbosity = _verbosity === 'FULL' || _verbosity === 'F' ? 3 : _verbosity === 'MED' || _verbosity === 'M' ? 2 : _verbosity === 'NONE' ? 0 : 1;
    var force = _force !== false;
    var serial = _serial === true;
    var setDB = _setDB === true;

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

        var data = buffer.toString('utf8', 0, buffer.length),
			charParser = new CharParser(),
			commandBuffer = charParser.processCharacters(data);

        var dbConnection = dbConnect(_username, _password, host, port, _database);
        var name = file.path;
        if (verbosity > 0) {
            console.log('Starting to process \'' + name + '\'');
        }
        processCommands(name, commandBuffer, dbConnection, verbosity, force, serial, (setDB?_database:undefined), function() {
            dbConnection.end(function() {
                console.log('Executed ' + commandBuffer.length + ' commands from file \'' + name + '\'');
                cb(null, file);
            }); 
        });
    });
}

module.exports = processCommandFile;
