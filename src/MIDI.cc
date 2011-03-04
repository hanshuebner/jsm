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
{
public:
  static void Initialize(Handle<Object> target);

  enum PortDirection { INPUT, OUTPUT };

  // Get id of MIDI port with the given name.  Returns the ID or -1 if
  // no MIDI device with the given name is found
  static int getPortIndex(PortDirection direction, string name);

private:
  static Handle<Value> getPorts(PortDirection direction);
  static Handle<Value> inputPorts(const Arguments& args);
  static Handle<Value> outputPorts(const Arguments& args);

};

class MIDIInput
  : public EventEmitter
{
public:
  static void Initialize(Handle<Object> target);

private:
  // Symbols emitted for events
  static Persistent<String> _messageSymbol;
  static Persistent<String> _clockSymbol;
};

class MIDIOutput
  : public ObjectWrap
{
public:
  static void Initialize(Handle<Object> target);

public:
  MIDIOutput(int portId) { cout << "MIDIOutput(" << portId << ")" << endl; }
  virtual ~MIDIOutput() { cout << "~MIDIOutput()" << endl; }

  static Handle<Value> New(const Arguments& args);
  static Handle<Value> send(const Arguments& args);

  static Persistent<FunctionTemplate> _constructorTemplate;
};

// //////////////////////////////////////////////////////////////////
// MIDI methods
// //////////////////////////////////////////////////////////////////

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

void
MIDI::Initialize(Handle<Object> target) {
  HandleScope scope;

  target->Set(String::NewSymbol("inputPorts"), FunctionTemplate::New(inputPorts)->GetFunction());
  target->Set(String::NewSymbol("outputPorts"), FunctionTemplate::New(outputPorts)->GetFunction());

  MIDIOutput::Initialize(target);
  
  /*
  NODE_SET_PROTOTYPE_METHOD(functionTemplate, "openOutput", openOutput);
  */
  /*
  _messageSymbol = NODE_PSYMBOL("message");
  _clockSymbol = NODE_PSYMBOL("clock");
  */
}

// //////////////////////////////////////////////////////////////////
// MIDIOutput methods
// //////////////////////////////////////////////////////////////////

Handle<Value>
MIDIOutput::New(const Arguments& args)
{
  HandleScope scope;

  string portName = *String::Utf8Value(args[0]);
  int portId = MIDI::getPortIndex(MIDI::OUTPUT, portName);
  if (portId < 0) {
    string errorMessage = (string) "Invalid MIDI output port name: " + portName;
    ThrowException(String::New(errorMessage.c_str()));
  }

  MIDIOutput* midiOutput = new MIDIOutput(portId);
  midiOutput->Wrap(args.This());
  return args.This();
}

Handle<Value>
MIDIOutput::send(const Arguments& args)
{
  return Handle<Value>();
}

Persistent<FunctionTemplate> MIDIOutput::_constructorTemplate;

void
MIDIOutput::Initialize(Handle<Object> target)
{
  Handle<FunctionTemplate> midiOutputTemplate = FunctionTemplate::New(New);
  _constructorTemplate = Persistent<FunctionTemplate>::New(midiOutputTemplate);
  _constructorTemplate->InstanceTemplate()->SetInternalFieldCount(1);
  _constructorTemplate->SetClassName(String::NewSymbol("MIDIOutput"));
  NODE_SET_PROTOTYPE_METHOD(_constructorTemplate, "send", MIDIOutput::send);

  target->Set(String::NewSymbol("MIDIOutput"), _constructorTemplate->GetFunction());
}

// //////////////////////////////////////////////////////////////////
// Initialization interface
// //////////////////////////////////////////////////////////////////

extern "C" {
  static void init (Handle<Object> target)
  {
    MIDI::Initialize(target);
  }

  NODE_MODULE(MIDI, init);
}

