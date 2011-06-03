var Ableton = require('./live.js');
var live = new Ableton.Live();

live.on('/live/tempo', function (bpm) { console.log('bpm', bpm); });
live.on('/live/name/clip', function (track, clip, name, color) { console.log('clip', track + '/' + clip, 'changed name to', name) });

live.send('/live/tempo', 120);
live.send('/live/tempo', 121);

var repl = require('repl');
var replContext = repl.start().context;
replContext.live = live;



