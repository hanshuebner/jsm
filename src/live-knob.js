var util = require('util');
var events = require('events');

var MIDI = require('MIDI');
var powerMate = require('powermate').powerMate;
powerMate.setLed(0);

var Ableton = require('./live.js');
var live = new Ableton.Live('localhost');

var midiInput = new MIDI.MIDIInput();
console.log("opened MIDI input port", midiInput.portName);

// Handle incoming MIDI clock ticks by displaying a visual metronome.
var count = -1;
var ledPeriod = 0;
var lastMidiBeat = (new Date).getTime();

midiInput.on('timingClock', function () {
    // Raw MIDI clock pulses are generated on every 96th note.
    count++;
    if (count % 24 == 0) {
        delta = (new Date).getTime() - lastMidiBeat;
        lastMidiBeat = (new Date).getTime();
        console.log(delta, 'beat/midi');
        // Got a quarter note
        brightness = 255;
        powerMate.setLed(brightness);
        if (count % 96 == 0) {
            // one - long period
            ledPeriod = 12;
        } else {
            // two, three, four - short period
            ledPeriod = 3;
        }
    } else {
        // Not on a quarter note.  Possibly fade out the led.
        if (ledPeriod) {
            ledPeriod--;
        }
        if (!ledPeriod && brightness) {
            brightness -= 40;
            if (brightness < 0) {
                brightness = 0;
            }
            powerMate.setLed(brightness);
        }
    }
});

// Names of the tracks
var tracks = [];

// TrackArmer - Click records a clip, turning arms another track
function TrackArmer()
{
    events.EventEmitter.call(this);

    this.on('click', function () {
        console.log('record clip');
    });
    this.currentTrack = 0;
    this.on('clickTurn', function (delta) {
        live.send('/live/arm', that.currentTrack, 2);
        that.currentTrack += delta;
        that.currentTrack = Math.max(0, Math.min(tracks.length - 1, that.currentTrack));
        console.log('track', that.currentTrack);
        live.send('/live/track/view', that.currentTrack);
        live.send('/live/arm', that.currentTrack, 1);
    });
    var that = this;
    live.on('/live/track', function (trackIndex) {
        trackIndex -= 1;
        that.currentTrack = trackIndex;
    });
}

util.inherits(TrackArmer, events.EventEmitter);

var powerMateHandlers = [ new TrackArmer() ];
var handlerIndex = 0;

powerMate.on('buttonDown', function () {
    powerMateHandlers[handlerIndex].emit('click');
});
powerMate.delta = 0;
powerMate.clickWidth = 10;
powerMate.on('turn', function (delta, position) {
    this.delta += delta;
    if (Math.abs(this.delta) > this.clickWidth) {
        var steps = (this.delta / this.clickWidth) | 0;       // hacky cast to integer
        this.delta -= steps * this.clickWidth;
        powerMateHandlers[handlerIndex].emit('clickTurn', steps);
    }
    powerMateHandlers[handlerIndex].emit('turn', delta, position);
});

// Incoming Live message handlers

live.on('/live/play', function (playing) {
    if (playing == 1) {
        console.log('stop');
        count = -1;
        powerMate.setLed(0);
    }
});

live.on('/live/refresh', function () {
    tracks = [];
});

live.on('/live/name/track', function (index, name) {
    tracks[index] = name;
});

// forward received bundles as individual messsage
live.on('#bundle', function (time) {
    for (var i = 1; i < arguments.length; i++) {
        this.emit.apply(this, arguments[i]);
    }
});
live.send('/live/name/track');