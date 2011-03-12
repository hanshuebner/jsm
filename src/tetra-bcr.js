// Bridge between DSI Tetra and Behringer BCR2000

// The DSI Tetra lacks a decent number of control knobs, which is what
// the Behringer BCR2000 is all about.  Even though the BCR2000 can
// send NRPN messages and thus fully control the Tetra, it cannot
// determine the actual current state of the Tetra, so initially the
// values displayed on the LED rings on the BCR2000 will not reflect
// the actual values set in the Tetra.

// This program sits between the BCR2000 and the Tetra.  Upon startup,
// it reads the parameter values out of the Tetra and stores them.  It
// then sends the current values of the parameters that are assigned
// to controls (knobs, buttons) to the BCR2000.  Whenever a parameter
// is changed (either using the BCR2000 or the controls on the Tetra
// front panel), this program records the change, so it always has a
// mirror of the internal synth state.

// Preset changing on the BCR2000 is performed by this program, and
// not directly by the "change preset" buttons.  This is done so that
// the current BCR2000 preset is always known and the current
// parameter set can be sent to the BCR2000 after a preset change, to
// update the displayed values.

var TetraBCR = {

    function MidiReceiverContext(messageCallback, nrpnCallback)
    {
        this.currentNRPNParameter = 0;
        this.currentNRPNValue = 0;
        this.messageCallback = messageCallback;
        this.nrpnCallback = nrpnCallback;
    }

    MidiReceiverContext.prototype.processNRPN(messageBytes)
    {
        switch (messageBytes[1]) {
        case 0x63:
            this.currentNRPNParameter = messageBytes[2] << 7;
            this.currentNRPNValue = 0;
            break;
        case 0x62:
            this.currentNRPNParameter &= ~0x7f;
            this.currentNRPNParameter |= messageBytes[2];
            break;
        case 0x06:
            this.currentNRPNValue = messageBytes[2] << 7;
            break;
        case 0x26:
            this.currentNRPNValue &= ~0x7f;
            this.currentNRPNValue |= messageBytes[2];
            this.nrpnCallback();
        }

    var bcrInput;
    var bcrOutput;
    var tetraInput;
    var tetraOutput;

    var TETRA_SYSEX_PREFIX;

    var tetraNRPNContext = { parameter: 0, value: 0 };
    var bcrNRPNContext = { parameter: 0, value: 0 };
    var currentEditBuffer = [];

    function processMIDIMessages(messageCallback, error, messages)
    {
        if (error) {
            console.log('error ' + error + ' receiving MIDI messages');
        }
        for (var i in messages) {
            var message = messages[i];
            messageCallback(message);
        }
    }

    function processTetraMessage(messageString) {
        var message = midiMessageToArray(messageString);
        if (expectedTetraResponsePrefix && messageString.startsWith(expectedTetraResponsePrefix)) {
            expectedTetraResponseCallback();
        } else if ((message[0] & 0xf0) == 0xb0) {
            interpretNRPNMessage(message, tetraNRPNContext);
        } else {
            console.log('MIDI message from Tetra ignored: ' + messageString);
        }
    }

    function processBCRMessage(messageString) {


    function requestFromTetra(requestMessage, responseMessagePrefix, callback)
    {
        // requestMessage is the message to send to the Tetra
        // responseMessagePrefix is the prefix of the message that the Tetra will send as response
        // callback is the function to call when the response has been received.  It will be called with one argument,
        // an array containing the response parsed into numbers
        if (expectedTetraResponsePrefix) {
            throw 'already waiting for response ' + expectedTetraResponsePrefix + ' from tetra';
        }
        expectedTetraResponsePrefix = responseMessagePrefix;
        expectedTetraResponseCallback = callback;
        tetraOutput.send(requestMessage);
    }

    function readCurrentEditBuffer(callback)
    {
        requestFromTetra(TETRA_READ_CURRENT_EDIT_BUFFER,
                         TETRA_READ_CURRENT_EDIT_BUFFER_RESPONSE,
                         function (response) {
                             if (response.length != TETRA_EDIT_BUFFER_RESPONSE_LENGTH) {
                                 throw 'could not read current edit buffer parameters from Tetra, response too short';
                             }
                             for (var i = 0; i < TETRA_EDIT_BUFFER_PARAMETER_COUNT; i++) {
                                 parameters[parameterReportIndexToNRPNNumber(i)]
                                     = response[EDIT_BUFFER_DATA_BEGIN + i * 2] << 8 + response[EDIT_BUFFER_DATA_BEGIN + i * 2 + 1];
                             }
                             callback();
                         });
    }