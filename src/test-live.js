var Ableton = require('./live.js');
var live = new Ableton.Live('localhost');

live.on('/live/tempo', function (bpm) { console.log('bpm', bpm); });
live.on('/live/name/clip', function (track, clip, name, color) { console.log('clip', track + '/' + clip, 'changed name to', name) });

live.send('/live/tempo', 120);
live.send('/live/tempo', 121);
live.send('/remix/set_peer', '', 9001);
live.send('/remix/echo', 'hello');
live.send('/remix/set_peer', '192.168.5.1', 9090);
live.send('/remix/echo', 'nix is');
live.send('/remix/set_peer', '', 9001);
live.send('/remix/echo', 'hello hello');

var repl = require('repl');
var replContext = repl.start().context;
replContext.live = live;



