var fs = require('fs');
var url = require('url');
var _ = require('underscore');

function dir (req, resp) {
    resp.writeHead(200, { 'Content-Type': 'application/json'});
    resp.end(JSON.stringify({ dir: _.select(fs.readdirSync("."), function (path) { return path.match(/\.syx$/); }) }));
}

function get (req, resp, filename) {

    var stats = fs.statSync(filename);
    if (!stats || !stats.isFile()) {
        resp.writeHead(404, { 'Content-Type': 'text/plain' });
        resp.end("Invalid filename");
        return;
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
        resp.writeHead(404, { 'Content-Type': 'text/plain' });
        resp.end("error reading sysex file \"" + filename + "\": " + e);
        return;
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
                resp.writeHead(500, { 'Content-Type': 'text/plain' });
                resp.end("can't PUT to existing file \"" + filename + "\"");
            } else {
                var data;
                try {
                    data = JSON.parse(buffer);
                }
                catch (e) {
                    resp.writeHead(500, { 'Content-Type': 'text/plain' });
                    resp.end("cannot parse JSON data: " + e);
                    return;
                }

                fs.writeFile(filename, data.preset, 'utf-8', function (error) {
                    if (error) {
                        resp.writeHead(500, { 'Content-Type': 'text/plain' });
                        resp.end("cannot save data to file \"" + filename + "\": " + error);
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
                switch (req.method)
                {
                case 'GET':
                    get(req, resp, args[0]);
                    break;
                case 'POST':
                case 'PUT':
                    put(req, resp, args[0]);
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

