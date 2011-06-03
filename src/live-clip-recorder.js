
var MIDI = require('MIDI');
var OSC = require('osc');
var _ = require('underscore');
var buzzers = require('buzzers').buzzers;

// 'USB Midi Cable'

var toLive = new OSC.Client('localhost', 9000);
var fromLive = new OSC.Server(9001);
var midiInput = new MIDI.MIDIInput();

var trackNumber;
var recordingClip;
var track;

var RECORDING_MODE = { ONCE: 1, MANY: 2 };

function startRecording()
{
    console.log('record to clip', recordingClip);
    toLive.send('/live/play/clipslot', trackNumber, recordingClip);
}

var liveOscHandlers = {
    '/live/track': function (trackNumber_) {
        trackNumber = trackNumber_ - 1;
        console.log('track', trackNumber, 'selected');
        toLive.send('/live/track/info', trackNumber);
        track = [];
    },
    '/live/track/info': function () {
        for (var i = 2; i < arguments.length; i += 3) {
            var clipNumber = arguments[i];
            var state = arguments[i+1];
            track[clipNumber] = state;
        }
    },
    '/live/name/clip': function (trackNumber, clipNumber, name, color) {
        if (clipNumber == recordingClip) {
            toLive.send('/live/stop/clip', trackNumber, clipNumber);
            if (recordingMode == RECORDING_MODE.MANY) {
                recordingClip++;
                startRecording();
            }
        }
    },
};

fromLive.on('message', function (message) {
    console.log(message);
    var address = message.shift();
    if (liveOscHandlers[address]) {
        liveOscHandlers[address].apply(null, message);
    }
});

function recordClip(mode)
{
    if (!track) {
        console.log('no track selected');
        return;
    }
    
    toLive.send('/live/arm', trackNumber, 1);
    var freeClip = 0;
    for (var i = 0; i < track.length; i++) {
        if (track[i]) {
            freeClip = i + 1;
        }
    }
    recordingClip = freeClip;
    recordingMode = mode;
    startRecording();
}

midiInput.on('noteOn', function (pitch, velocity) {
    if (velocity) {
        switch (pitch) {
        case 0:
            recordClip(RECORDING_MODE.ONCE);
            break;
        case 1:
            recordClip(RECORDING_MODE.MANY);
            break;
        case 2:
            recordingMode = RECORDING_MODE.ONCE;
            break;
        }
    }
});

buzzers.on('button', function (buzzer, button, state) {
    console.log('button', button);
    if (state) {
        switch (button) {
        case 4:
            recordClip(RECORDING_MODE.ONCE);
            break;
        case 3:
            recordClip(RECORDING_MODE.MANY);
            break;
        case 2:
            recordingMode = RECORDING_MODE.ONCE;
            break;
        }
    }
});