// -*- C++ -*-

#include <iostream>
#include <v8.h>
#include <node.h>
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
  static Persistent<FunctionTemplate> persistentFunctionTemplate;

  enum PortDirection { INPUT, OUTPUT };
  static Handle<Value> getPorts(PortDirection direction);
  static Handle<Value> inputPorts(const Arguments& args);
  static Handle<Value> outputPorts(const Arguments& args);

  static Handle<Value> openInput(const Arguments& args) { return Handle<Value>(); };
  static Handle<Value> openOutput(const Arguments& args) { return Handle<Value>(); };

};

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

/*
class MIDIInputPort
  : public EventEmitter,
    private MIDIPort
{
private:
  // Symbols emitted for events
  static Persistent<String> _messageSymbol;
  static Persistent<String> _clockSymbol;

  //
};

class MIDIOutputPort {
};

*/

void
MIDI::Initialize(Handle<Object> target) {
  HandleScope scope;

  target->Set(String::NewSymbol("inputPorts"), FunctionTemplate::New(inputPorts)->GetFunction());
  target->Set(String::NewSymbol("outputPorts"), FunctionTemplate::New(outputPorts)->GetFunction());
  /*
  NODE_SET_PROTOTYPE_METHOD(functionTemplate, "openInput", openInput);
  NODE_SET_PROTOTYPE_METHOD(functionTemplate, "openOutput", openOutput);
  */
  /*
  _messageSymbol = NODE_PSYMBOL("message");
  _clockSymbol = NODE_PSYMBOL("clock");
  */
}

Persistent<FunctionTemplate> MIDI::persistentFunctionTemplate;

extern "C" {
  static void init (Handle<Object> target)
  {
    MIDI::Initialize(target);
  }

  NODE_MODULE(MIDI, init);
}

