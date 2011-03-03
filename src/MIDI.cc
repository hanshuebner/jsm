// -*- C++ -*-

#include <iostream>
#include <v8.h>
#include <node.h>
#include <node_events.h>
#include <portmidi.h>

using namespace v8;
using namespace node;
using namespace std;

class MIDI
  : public ObjectWrap
{
public:
  static void Initialize(Handle<Object> target);

private:
  enum PortDirection { INPUT, OUTPUT };
  static Handle<Value> getPorts(PortDirection direction);
  static Handle<Value> inputPorts(const Arguments& args);
  static Handle<Value> outputPorts(const Arguments& args);

  // Get id of MIDI port with the given name.  Returns the ID or -1 if
  // no MIDI device with the given name is found
  static int getPortIndex(PortDirection direction, string name);

  static Persistent<ObjectTemplate> _midiOutputTemplate;

  static Handle<Value> openInput(const Arguments& args) { return Handle<Value>(); };
  static Handle<Value> openOutput(const Arguments& args);

};

class MIDIInput
  : public EventEmitter
{
private:
  // Symbols emitted for events
  static Persistent<String> _messageSymbol;
  static Persistent<String> _clockSymbol;
};

class MIDIOutput
  : public ObjectWrap
{
public:
  MIDIOutput(int portId) { cout << "MIDIOutput(" << portId << ")" << endl; }
  virtual ~MIDIOutput() { cout << "~MIDIOutput()" << endl; }

  Handle<Value> send(const Arguments& args);
};

int
MIDI::getPortIndex(PortDirection direction, string name)
{
  for (int id = 0; id < Pm_CountDevices(); id++) {
    const PmDeviceInfo* deviceInfo = Pm_GetDeviceInfo(id);
    if (((direction == INPUT) ^ deviceInfo->output)
        && (name == deviceInfo->name)) {
      return id;
    }
  }
  return -1;
}

Handle<Value>
MIDI::getPorts(PortDirection direction)
{
  Local<Array> retval = Array::New();
  unsigned count = 0;
  for (int id = 0; id < Pm_CountDevices(); id++) {
    const PmDeviceInfo* deviceInfo = Pm_GetDeviceInfo(id);
    if ((direction == INPUT) ^ deviceInfo->output) {
      retval->Set(count++, String::New(deviceInfo->name));
    }
  }
  return retval;
}

Handle<Value>
MIDI::inputPorts(const Arguments& args)
{
  return getPorts(INPUT);
}

Handle<Value>
MIDI::outputPorts(const Arguments& args)
{
  return getPorts(OUTPUT);
}

Handle<Value>
MIDI::openOutput(const Arguments& args)
{
  string portName = *String::Utf8Value(args[0]);
  int portId = getPortIndex(OUTPUT, portName);
  if (portId < 0) {
    string errorMessage = (string) "Invalid MIDI output port name: " + portName;
    ThrowException(String::New(errorMessage.c_str()));
  }
  MIDIOutput* midiOutput = new MIDIOutput(portId);
  Local<Object> jsObject = _midiOutputTemplate->NewInstance();
  jsObject->SetInternalField(0, External::New(midiOutput));
  return jsObject;
}

void
MIDI::Initialize(Handle<Object> target) {
  HandleScope scope;

  target->Set(String::NewSymbol("inputPorts"), FunctionTemplate::New(inputPorts)->GetFunction());
  target->Set(String::NewSymbol("outputPorts"), FunctionTemplate::New(outputPorts)->GetFunction());
  target->Set(String::NewSymbol("openInput"), FunctionTemplate::New(openInput)->GetFunction());
  target->Set(String::NewSymbol("openOutput"), FunctionTemplate::New(openOutput)->GetFunction());

  Handle<ObjectTemplate> midiOutputTemplate = ObjectTemplate::New();
  midiOutputTemplate->SetInternalFieldCount(1);
  _midiOutputTemplate = Persistent<ObjectTemplate>::New(midiOutputTemplate);
  /*
  NODE_SET_PROTOTYPE_METHOD(_midiOutputTemplate, "send", MIDIOutput::send);
  NODE_SET_PROTOTYPE_METHOD(functionTemplate, "openOutput", openOutput);
  */
  /*
  _messageSymbol = NODE_PSYMBOL("message");
  _clockSymbol = NODE_PSYMBOL("clock");
  */
}

Persistent<ObjectTemplate> MIDI::_midiOutputTemplate;

extern "C" {
  static void init (Handle<Object> target)
  {
    MIDI::Initialize(target);
  }

  NODE_MODULE(MIDI, init);
}

