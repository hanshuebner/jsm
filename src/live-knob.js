var util = require('util');
var events = require('events');

var MIDI = require('MIDI');
var PowerMate = require('powermate');
var Buzzers = require('buzzers');

var powerMate = new PowerMate.PowerMate();
powerMate.setLed(0);

var buzzers;
try {
    buzzers = new Buzzers.BuzzerController();
}
catch (e) {
    console.log('no buzzers');
}

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
        var now = (new Date).getTime();
        delta = now - lastMidiBeat;
        lastMidiBeat = now;
//        console.log(delta, 'beat/midi');
        // Got a quarter note
        brightness = 255;
        powerMate.setLed(brightness);
        if (buzzers) {
            buzzers.led(0, true);
            buzzers.led(1, true);
            buzzers.led(2, true);
            buzzers.led(3, true);
        }
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
            if (buzzers) {
                buzzers.led(0, false);
                buzzers.led(1, false);
                buzzers.led(2, false);
                buzzers.led(3, false);
            }
        }
    }
});

// Names of the tracks in the current live set
var tracks = [];

// TrackArmer - Click records a clip, turning arms another track

function TrackArmer()
{
    events.EventEmitter.call(this);

    this.selectTrack(0);

    this.on('clickTurn', function (delta) {
        // determine next selected track
        var nextTrack = Math.max(0, Math.min(tracks.length - 1, this.currentTrack + delta));
        if (nextTrack != this.currentTrack) {
            this.selectTrack(nextTrack);
        }
    }.bind(this));

    live.on('/live/track', function (trackIndex) {
        trackIndex -= 1;
        this.currentTrack = trackIndex;
    }.bind(this));

    live.on('/live/track/info', function (trackNumber) {
        if (trackNumber == this.currentTrack) {
            for (var i = 2; i < arguments.length; i += 3) {
                var clipNumber = arguments[i];
                var state = arguments[i+1];
                this.clips[clipNumber] = state;
            }
        }
    }.bind(this));

    // Clip recording quantized to global quantization.  The first
    // free clip in the currently selected track is recorded to.  As
    // the currently selected track is always armed (see the clickTurn
    // handler), the /live/play/clipslot message sent to live actually
    // starts recording, not playing, at the start of the next bar.
    // As soon as that bar starts, Live creates the clip and sends a
    // /live/name/clip message which is handled below.
    this.on('click', function () {
        console.log('record clip, clips', this.clips);
        var emptyClip = 0;
        while (this.clips[emptyClip]) {
            emptyClip++;
        }
        live.send('/live/play/clipslot', this.currentTrack, emptyClip);
        this.recordingClip = emptyClip;
    }.bind(this));

    // If we receive a /live/name/clip message for the clip that we're
    // currently recording to, stop that clip (at the beginning of the
    // next bar).
    live.on('/live/name/clip', function(trackNumber, clipNumber, name, color) {
        if (trackNumber == this.currentTrack && clipNumber == this.recordingClip) {
            live.send('/live/stop/clip', trackNumber, clipNumber);
        }
    }.bind(this));
}

util.inherits(TrackArmer, events.EventEmitter);

TrackArmer.prototype.selectTrack = function (nextTrack)
{
    // unarm current track
    if (this.currentTrack != undefined) {
        live.send('/live/arm', this.currentTrack, 2);
    }
    this.currentTrack = nextTrack
    this.clips = [];
    console.log('track', this.currentTrack);
    // select current track
    live.send('/live/track/view', this.currentTrack);
    // inquire track state
    live.send('/live/track/info', this.currentTrack);
    // .. and arm it
    live.send('/live/arm', this.currentTrack, 1);
}

// PowerMate knob handling logic

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

// forward received bundles as individual messsage
live.on('#bundle', function (time) {
    for (var i = 1; i < arguments.length; i++) {
        this.emit.apply(this, arguments[i]);
    }
});

live.on('/live/refresh', function () {
    tracks = [];
});

live.on('/live/name/track', function (index, name) {
    tracks[index] = name;
});

// Make live send its current track configuration
live.send('/live/name/track');
