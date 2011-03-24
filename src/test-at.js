var MIDI = require('MIDI');

var i = 0;
var baseTime = MIDI.currentTime();
function checkAndRequeue(timestamp)
{
    console.log('at', timestamp, 'current', MIDI.currentTime());
    if (i++ < 10) {
        MIDI.at(baseTime + i * 100, checkAndRequeue);
    }
}

checkAndRequeue(MIDI.currentTime());