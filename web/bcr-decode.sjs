var fs = require('fs');
var url = require('url');

function handle (req, resp) {
    var file = url.parse(req.url, true).query.file;
    log.info('file', file);

    if (!file) {
        throw "no file GET parameter";
    }
    if (file.match(/[\/\\]/)) {
        throw "illegal character in file name";
    }

    resp.writeHead(200, { 'Content-Type': 'text/plain'});

    var buf = fs.readFileSync(file);
    for (var i = 0; i < buf.length; ) {
        if (buf[i] != 0xf0) {
            throw "expected sysex begin";
        }
        var j;
        for (j = i; buf[j] != 0xf7; j++)
            ;
        resp.write(decodeOneMessage(buf.slice(i, j)) + "\n");
        i = j + 1;
    }
    resp.end('');
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