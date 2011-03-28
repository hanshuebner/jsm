#!/usr/bin/env node
/**
 * Simple webserver with logging. By default, serves whatever files are
 * reachable from the directory where node is running.
 */
var fs = require('fs'),
antinode = require('./antinode/lib/antinode'),
sys = require('sys');
bcr2000 = require('./src/bcr2000-web.js');

var settings = {
    port: 8100,
    request_preprocessor: bcr2000.handleRequest,

    default_host: {
        root: "web/"
    }
};

antinode.start(settings);
