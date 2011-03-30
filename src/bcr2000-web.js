var fs = require('fs');
var url = require('url');
var _ = require('underscore');

function http_error(message, status) {
    if (!status) {
        status = 500;
    }
    resp.writeHead(status, { 'Content-Type': 'text/plain' });
    resp.end(message);
}

function dir (req, resp) {
    resp.writeHead(200, { 'Content-Type': 'application/json'});
    var dir = [];
    _.each(fs.readdirSync("."),
           function (path) {
               path.replace(/(.*).syx$/,
                            function (match, name) {
                                dir.push(name);
                            });
           });
    resp.end(JSON.stringify({ dir: dir }));
}

function get (req, resp, filename) {

    var stats = fs.statSync(filename);
    if (!stats || !stats.isFile()) {
        return http_error("invalid filename: " + filename, 404);
    }

    function decodeOneMessage(buf) {
        if (buf[0] != 0xf0
            || buf[1] != 0x00
            || buf[2] != 0x20
            || buf[3] != 0x32) {
            throw "not a Behringer sysex message";
        }
        if (buf[6] == 0x20) {
            return buf.slice(9, buf.length);
        }
    }

    var response = '';
    try {
        var buf = fs.readFileSync(filename);
        for (var i = 0; i < buf.length; ) {
            if (buf[i] != 0xf0) {
                throw "expected sysex begin";
            }
            var j;
            for (j = i; buf[j] != 0xf7; j++)
                ;
            response += decodeOneMessage(buf.slice(i, j)) + "\n";
            i = j + 1;
        }
    }
    catch (e) {
        return http_error("error reading sysex file \"" + filename + "\": " + e, 404);
    }

    resp.writeHead(200, { 'Content-Type': 'application/json'});
    resp.end(JSON.stringify({ preset: response }));
}

function put (req, resp, filename) {
    var buffer = '';
    req.setEncoding('utf-8');
    req.on('data', function (data) {
        buffer += data;
    });
    req.on('end', function () {
        fs.stat(filename, function (error, stats) {
            if ((req.method == 'PUT') && !error) {
                return http_error("can't PUT to existing file \"" + filename + "\"");
            } else {
                var data;
                try {
                    data = JSON.parse(buffer);
                }
                catch (e) {
                    return http_error("cannot parse JSON data: " + e);
                }

                if (!data.preset) {
                    return http_error("uploaded JSON data does not contain a preset field");
                }

                var text = data.preset;
                
                var lines = text.split("\n");
                var newlineTerminated = false;
                if (text[text.length - 1] == "\n") {
                    lines.pop();
                    newlineTerminated = true;
                }
                // Allocate a buffer - The length is determined by the
                // number of bytes in the string representing the BCL
                // data plus 9 bytes per line to accommodate for the
                // sysex header.
                var buf = new Buffer(text.length + (newlineTerminated ? 0 : 1) + lines.length * 9);

                var p = 0;                 // output pointer in buffer
                var lineNumber = 0;        // BCL line number

                function decodeOneLine(line) {
                    buf[p++] = 0xf0;
                    buf[p++] = 0x00;
                    buf[p++] = 0x20;
                    buf[p++] = 0x32;
                    buf[p++] = 0x00;                     // device id 1, for now
                    buf[p++] = 0x15;                     // model -> bcr2000
                    buf[p++] = 0x20;                     // BCL message
                    buf[p++] = (lineNumber >> 7) & 0x7f; // line number MSB
                    buf[p++] = lineNumber & 0x7f;        // line number LSB
                    p += buf.write(line, p, 'binary');
                    buf[p++] = 0xf7;
                    lineNumber++;
                }

                _.each(lines, decodeOneLine);

                fs.writeFile(filename, buf, 'binary', function (error) {
                    if (error) {
                        return http_error("cannot save data to file \"" + filename + "\": " + error);
                    } else {
                        resp.writeHead(200, { 'Content-Type': 'application/json'});
                        resp.end(JSON.stringify({ savedTo: filename }));
                    }
                });
            }
        });
    });
}
        
exports.handleRequest = function (req, resp, nextHandler) {
    try {
        var path = url.parse(req.url).pathname;
        var args = path.split(/\//);
        args.shift();           // remove leading slash
        if (args[0] == "bcr2000") {
            args.shift();
            if (args[0]) {
                switch (req.method) {
                case 'GET':
                    get(req, resp, args[0] + '.syx');
                    break;
                case 'POST':
                case 'PUT':
                    put(req, resp, args[0] + '.syx');
                    break;
                default:
                    throw "Unsupported request method: " + req.method;
                }
            } else {
                dir(req, resp);
            }
        } else {
            nextHandler(req, resp, null);
        }
    }
    catch (e) {
        resp.writeHead(500, { 'Content-Type': 'text/plain' });
        resp.end('error processing request: ' + e);
    }
}

