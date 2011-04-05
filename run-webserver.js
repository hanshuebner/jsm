#!/usr/bin/env node
/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var fs = require('fs'),
sys = require('sys'),
antinode = require('./antinode/lib/antinode'),
_ = require('underscore'),
io = require('socket.io'),
bcr2000 = require('./src/bcr2000-web.js');

var settings = {
    port: 8100,
    request_preprocessor: bcr2000.handleRequest,

    default_host: {
        root: "web/"
    }
};

var server = antinode.start(settings);
var socket = io.listen(server);

function newSocketClient(client) {
    console.log('new socket client');
    process.stdin.resume();
    process.stdin.on('data', function (data) {
        data = data.toString('ascii', 0, data.length - 1);
        console.log('stdin data', data);
        client.send(data);
    });
    client.on('message', function (message) {
        console.log('client message', message);
    });
    client.on('disconnect', function () {
        console.log('client disconnect');
        process.stdin.removeAllListeners();
    });
}

socket.on('connection', newSocketClient);