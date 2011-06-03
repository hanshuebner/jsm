// tetra-controllerjsm.js

// Copyright 2011 Hans Huebner, All Rights Reserved

var fs = require('fs');
var events = require('events');
var antinode = require('antinode');
var _ = require('underscore');

var hub = new events.EventEmitter();

options = hub.options = {
    httpPort: 8100,
    oscPort: 4343,
    bcrPresetFilename: '../foobar3.syx'
};

hub.addWebHandler = function(handler)
{
    var oldHandler = this.handleWebRequest;
    hub.handleWebRequest = function (req, resp, nextHandler) {
        handler(req, resp, function (req, resp) {
            oldHandler(req, resp, nextHandler);
        });
    };
}
hub.handleWebRequest = function(req, resp, nextHandler) {
    nextHandler(req, resp);
}

hub.webServer = antinode.start({ port: options.httpPort,
                                 request_preprocessor: function (req, resp, nextHandler) { hub.handleWebRequest(req, resp, nextHandler); },
                                 default_host: {
                                     root: "../web/"
                                 }
                               });

var editBufferFilename = 'editbuffer.json';
console.log('loading', editBufferFilename);
fs.readFile(editBufferFilename, 'utf-8', function (err, data) {
    if (data) {
        console.log('loading edit buffer from', editBufferFilename);
        hub.currentPreset = JSON.parse(data);
    } else {
        console.log('no edit buffer file found, initializing with zeros');
        hub.currentPreset = { name: 'unknown', parameters: [] };
        _.each(_.range(384), function(parameter) { hub.currentPreset.parameters[parameter] = 0; });
    }
    setInterval(function () {
        var temporaryFile = editBufferFilename + '.tmp';
        fs.writeFile(temporaryFile, JSON.stringify(hub.currentPreset),
                     function (err) {
                         if (err) {
                             console.log('error saving edit buffer:', err);
                         } else {
                             fs.rename(temporaryFile, editBufferFilename,
                                       function (err) {
                                           if (err) {
                                               console.log('error renaming edit buffer file:', err);
                                           }
                                       });
                         }
                     });
    }, 1000);

    hub.on('presetChange', function (preset) {
        console.log('new preset:', preset.name);
        hub.currentPreset = preset;
    });
    hub.on('newListener', function (event, listener) {
        if (event == 'presetChange') {
            listener(hub.currentPreset);
        }
    });

    hub.on('parameterChange', function (parameter, value, from) {
        console.log('hub parameter change, parameter', parameter, 'value', value, 'from', from && from.name);
        hub.currentPreset.parameters[parameter] = value;
    });

    console.log('reading controller modules');
    var controllers = [];
    var dir = fs.readdirSync('controllers');
    _.each(dir,
           function (filename) {
               if (filename.match(/\.js$/)) {
                   try {
                       console.log('reading', filename);
                       var controller = require('./controllers/' + filename);
                       controllers.push(controller.make(hub));
                   }
                   catch (e) {
                       console.log('could not make controller', filename, 'error', e);
                   }
               }
           });
    console.log('done');
});

