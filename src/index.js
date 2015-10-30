var through = require('through2');
var gutil = require('gulp-util');
var mysql = require('mysql');

const PLUGIN_NAME = 'gulp-mysql-command-file-processor';

function dbConnect(_user, _passw, _host, _port) {
	var client = mysql.createConnection({
		host: _host,
		user: _user,
		password: _passw,
		port: _port
	});
	client.connect();
	return client
}
/**
 *
 * @param _fileName - Name of the file being streamed
 * @param _commandBuffer - Array of the processed commands
 * @param _dbConnection - A live connection to the database
 * @param _verbosity - The log level required -- 0(NONE) - 3(Full)
 */
function processCommands(_fileName,_commandBuffer,_dbConnection,_verbosity) {
	var commandsDone = false, commandCount = 0, processNextCommand = true;
	var runCmd = function () {
		var msg='';
		if (!commandsDone) {
			if (processNextCommand) {
				if (_verbosity>1) msg = "Executing '"+_fileName+"' query#" + (commandCount + 1) + ' ........ ';
				if (_verbosity==3) msg += _commandBuffer[commandCount];
				if (msg) console.log(msg);
				processNextCommand = false;
				_dbConnection.query(_commandBuffer[commandCount] + ';', function (err, res) {
					if (err) {
						console.log("Command#" + (commandCount + 1) + " in file '"+_fileName+"' failed :: " + err);
						process.exit(-1);
					} else {
						if (_verbosity=='MED'||_verbosity=='FULL') console.log('Successfully executed query #' + (commandCount + 1))
						commandCount++;
						if (commandCount == _commandBuffer.length) {
							commandsDone = true;
							_dbConnection.end(function(err){})
							if (_verbosity>0) console.log("Executed "+commandCount+" commands from file '"+_fileName+"'");
						} else processNextCommand = true;
					}
				});
				setTimeout(runCmd, 40);
			} else setTimeout(runCmd, 40);
		}
	}
	if (_commandBuffer.length > 0) runCmd()
}
/**
 *
 * @param _username - Database username
 * @param _password - database user password
 * @param _host - The database host server (defaults to localhost)
 * @param _port - The port the host server is listening on (defaults to 3306)
 * @param _verbosity - Log level DEFAULT Low -- 'NONE' - no logging; 'MED'|'M' - Medium logging; 'FULL@|'F' - Full logging
 * @return {*|{hello}|{first, second}}
 */
function processCommandFile(_username, _password, _host, _port, _verbosity) {
	var buffer,
		host = _host?_host:'localhost',
		port = _port?_port:3306,
		verbosity=_verbosity=='FULL'||_verbosity=='F'?3:_verbosity=='MED'||_verbosity=='M'?2:_verbosity=='NONE'?0:1;
	if (!(_username && _password)){
		throw new gutil.PluginError(PLUGIN_NAME, 'Both database and username and password must be defined');
	}
	return through.obj(function (file, enc, cb) {
		if (file.isBuffer()) {
			buffer = file.contents
		} else if (file.isStream()) {
			buffer = file.contents
		} else {
			this.emit('error', new PluginError(PLUGIN_NAME, 'Buffers not supported!'));
			return cb();
		}
		var dataOffset= 0,char,commandBuffer=[], command='', inString=false, isEscaped=false;
		data = buffer.toString("utf8", 0, buffer.length);
		while (dataOffset < buffer.length) {
			char = data.charAt(dataOffset++);
			if (char == ';' && !(inString || isEscaped)) {
				commandBuffer.push(command);
				command = '';
			} else {
				if(char=='\\')
					isEscaped = true;
				else {
					if (char == "'" && !isEscaped) {
						inString = !inString;
					}
					if (isEscaped)
						isEscaped=false;
				}
				command += char;
			}
		}
		var dbConnection = dbConnect(_username, _password, host, port),
			name=file.path;
		if (verbosity>0) console.log("Starting to process '"+name+"'");
		processCommands(name, commandBuffer, dbConnection, verbosity);

		cb(null,file)
	});
}

module.exports = processCommandFile;