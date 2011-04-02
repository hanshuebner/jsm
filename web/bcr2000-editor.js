
// imports
var $ = jQuery;
var TetraDefs;

// constant to signify no current edited control
var noEditedControl = { changed: function () { return false; } };

// global application state
var currentControlEditor = noEditedControl;
var currentFilename;
var currentFileChanged;
var currentPresetChanged;

var allPages = [];

function Page(elementId)
{
    this.elementId = elementId;
    allPages.push(this);
}

Page.prototype.$ = function () {
    return $('#' + this.elementId);
}

Page.prototype.show = function ()
{
    _.each(allPages,
           function (page) {
               page.$.css('display', 'none');
           });
    this.$.trigger('show');
    this.$.css('display', 'block');
}

function loadFile(filename)
{
    console.log('load file', filenae);
}

var assignments;

function loadPreset(presetNumber)
{
    console.log('load preset', presetNumber);
    $('#presetNumber').html(presetNumber);
    currentPreset = parsedBCL.presets[presetNumber - 1];
    assignments = {};
    $("#bcr form button")
        .each(function (index, button) {
            if (currentPreset.controls[button.id]) {
                assignments[button.id] = new ControlEditor(button);
            } else {
                $(button).children('span').html('');
            }
        });
}

function Control(name, type, id, bcl)
{
    this.name = name;
    this.type = type;
    this.id = id;
    this.bcl = bcl;
}

function parseBCL(string)
{
    var retval = { originalString: string,
                   temporaryPreset: { controls: {} },
                   presets: [] };

    function parseControl (command, chunk) {
        if (command.replace(/^\$(encoder|button) +([0-9]+) *(|;.*)$/,
                            function (match, type, id, name) {
                                name = name.replace(/; */, "");
                                retval.temporaryPreset.controls[type + id] = new Control(name, type, id, chunk);
                            }) == command) {
            console.log('error parsing "' + command + '"');
        }
    }
    
    var bclHandlers = {
        rev: function (command) {
            retval.rev = command;
        },
        global: function (command, chunk) {
            chunk.unshift(command);
            retval.global = chunk;
        },
        preset: function (command, chunk) {
            retval.temporaryPreset.presetInfo = chunk;
            _.each(chunk,
                   function (line) {
                       line.replace(/^ *\.name +' *([^ ].+?) *' *(|;.*)$/,
                                    function (match, presetName) {
                                        retval.temporaryPreset.name = presetName;
                                    });
                   });
        },
        encoder: parseControl,
        button: parseControl,
        store: function (command) {
            if (command.replace(/^\$store *([0-9]+)/,
                                function (match, presetNumber) {
                                    retval.presets[presetNumber - 1] = retval.temporaryPreset;
                                    retval.temporaryPreset = { controls: {} };
                                }) == command) {
                console.log('error parsing "' + command + '"');
            }
        },
        end: function () {
        }
    };

    var currentCommand;
    var currentChunk;

    _.each(string.split(/\n/),
           function (line) {
               if (line.match(/^\$[a-z]+/)) {
                   if (currentCommand) {
                       if (bclHandlers[currentCommand]) {
                           bclHandlers[currentCommand](currentChunk.shift(), currentChunk);
                       } else {
                           console.log('unsupported BCL command: "' + currentCommand + '"');
                       }
                   }
                   currentCommand = line.replace(/\$([a-z]+).*/, "$1");
                   currentChunk = [ line ];
               } else {
                   currentChunk.push(line);
               }
           });

    return retval;
}

function serializeBCL (parsedBCL) {
    var retval = parsedBCL.rev + "\n";

    function addChunk(chunk) {
        retval += chunk.join("\n") + "\n";
    }

    addChunk(parsedBCL.global);

    function addPreset(preset) {
        retval += "$preset\n";
        addChunk(preset.presetInfo);
        _.each(['encoder', 'button'],
               function (type) {
                   _.each(_.range(1, 65),
                          function (controlId) {
                              var control = preset.controls[type + controlId];
                              if (control) {
                                  retval += "$" + type + " " + controlId;
                                  if (control.name) {
                                      retval += " ;" + control.name;
                                  }
                                  retval += "\n";
                                  addChunk(control.bcl);
                              }
                          });
               });
    }

    _.each(_.range(32), function (presetId) {
        var preset = parsedBCL.presets[presetId];
        if (preset) {
            addPreset(preset);
            retval += "$store " + (presetId + 1) + "\n";
        }
    });

    if (parsedBCL.temporaryPreset.presetInfo.length) {
        addPreset(parsedBCL.temporaryPreset);
    }

    retval += "$end\n";

    return retval;
}

var parsedBCL;

function ControlEditor(buttonElement)
{
    this.id = buttonElement.id;
    this.uiButton = buttonElement;
    this.controlType = $(buttonElement).attr('control-type');
    this.controlNumber = $(buttonElement).attr('control-number');
    this.control = currentPreset.controls[this.id] || new Control('', this.controlType, this.controlNumber, []); /* id is controlNumber ? */
    var bcl = this.control.bcl.join('\n');
    function assignParameter (match, nrpn) {
        var parameter = TetraDefs.parameterDefinitions[nrpn];
        if (this.id == 'encoder1') {
            console.log('nrpn', nrpn,
                        'parameter', parameter,
                        'name', this.control.name,
                        'bcl', this.control.bcl.join('\n'),
                        'param-bcl', this.makeBcl(parameter));
        }
        if (parameter && this.makeBcl(parameter) == this.control.bcl.join('\n')) {
            this.parameter = parameter;
        }
    }
    bcl.replace(/ NRPN \d+ (\d+)/, _.bind(assignParameter, this));
    // determine if this control has previously been assigned to a parameter
    $(buttonElement).children('span').html(this.control.name);
}

ControlEditor.prototype.display = function () {
    $('#controlType').html(this.controlType);
    $('#controlNumber').html(this.controlNumber);
    $('#controlName').val(this.control.name || '');
    $('#parameter-name-list')
        .val(this.parameter ? this.parameter.index : "<not assigned>")
        .attr('disabled', false);
    $('#bcl')
        .val(this.control.bcl.join('\n') || '');
    $(this.uiButton).children('span').html(this.control.name);
}

ControlEditor.prototype.save = function () {
    var parameter = TetraDefs.parameterDefinitions[$('#control select').val()];
    var bcl = $('#bcl').val();
    var name = $('#controlName').val();
    if (parameter && (this.makeBcl(parameter) != bcl)) {
        parameter = undefined;
    }
    this.control.name = name;
    this.parameter = parameter;
    this.control.bcl = bcl.split('\n');
    assignments[this.id] = currentControlEditor;
    currentPreset.controls[this.id] = this.control;
    // change button label
    $('#' + this.id)
        .empty()
        .append(SPAN(null, this.control.name));
    currentFileChanged = true;
    currentPresetChanged = true;
}

ControlEditor.prototype.revert = function () {
    this.display();
}

ControlEditor.prototype.makeBcl = function (parameter) {
    return '  .easypar NRPN 1 ' + parameter.index + ' ' + (parameter.min || 0) + ' ' + parameter.max + ' absolute/14' + "\n"
        + '  .showvalue on' + "\n"
        + '  .mode 1dot' + "\n"
        + '  .resolution 10 50 100 500';
}

ControlEditor.prototype.setEditedParameter = function (parameter) {
    $('#bcl').val(this.makeBcl(parameter));
    $('#controlName').val(parameter.name);
}

ControlEditor.prototype.changed = function () {
    return this.control.bcl.join('\n') != $('#bcl').val()
        || this.control.name != $('#controlName').val();
}

$(document).ready(function () {

    TetraDefs = exports;                                // for now

    // yet another multi-page "framework"
    var currentPath = '';
    function showPage(path, headline) {
        var id = path[0];
        $("#pages > div").css('display', 'none');
        $('#headline')
            .empty()
            .append(SPAN(null, _.toArray(arguments).slice(1)));
        if (id) {
            $("#" + id).css('display', 'block');
            currentPath = document.location.hash = '#' + path.join('/');
        }
    }

    // file selector
    function editFile () {
        currentFilename = $(this).html();
        $.getJSON("/bcr2000/" + currentFilename, function (data, status) {
            if (status == 'success') {
                parsedBCL = parseBCL(data.preset);
                choosePreset();
            } else {
                alert('could not load file ' + currentFilename + ": " + status);
            }
        });
    }

    function choosePreset() {
        showPage(['choosePreset', currentFilename], 'Choose a preset in file ', SPAN(null, currentFilename), ' to edit');
    }

    // preset selector
    function editPreset () {
        var presetNumber = $(this).html();
        showPage(['editPreset', currentFilename, presetNumber], 'Editing file ', SPAN(null, currentFilename), ' preset ', SPAN(null, presetNumber));
        loadPreset(presetNumber);
        $('#control input, #control select, #control textarea')
            .attr('disabled', 'disabled');
    }

    function chooseFile () {
        showPage(['chooseFile'], 'Choose file to edit');
    }

    function saveFile () {
        $.post("/bcr2000/" + currentFilename,
               serializeJSON({ preset: serializeBCL(parsedBCL) }),
               function () {
                   chooseFile();
               },
              'json');
    }

    $('#choosePreset select')
        .append(_.map(_.range(1, 33),
                      function (i) {
                          return OPTION(null, i)
                      }));
    $('#choosePreset option')
        .click(editPreset);
    $('#saveFile')
        .click(saveFile);

    $('form')
        .submit(function () { return false; });
    
    function makeVirtualBcr2000() {
        function makeControlAttributes(type, number) {
            return { 'control-type': type,
                     'control-number': number,
                     'class': type,
                     id: (type + number) };
        }

        function makeEncoder(id) {
            this.append(BUTTON(makeControlAttributes('encoder', id), SPAN(null, '')));
        }

        function makeButton(id) {
            this.append(BUTTON(makeControlAttributes('button', id), SPAN(null, '')));
        }

        function br(elem) {
            elem.append(BR());
        }

        var form = $('#bcr form');
        _.each(_.range(1, 9), _.bind(makeEncoder, form));
        _.each(_.range(33, 57), _.bind(makeEncoder, form));
        _.each(_.range(33, 57), _.bind(makeButton, form));
        _.each(_.range(63, 65), _.bind(makeButton, form));
    }

    function makeTetraParameterSelector() {
        $('#parameter-name-list')
            .append(OPTION({ id: undefined }, '<not assigned>'));
        
        var index = 0;
        _.each(TetraDefs.parameterDefinitions, function (def) {
            if (def) {
                def.index = index;
                $('#parameter-name-list')
                    .append(OPTION({ value: index }, def.name));
            }
            index++;
        });
    }
    
    function editControl() {

        if (currentControlEditor.changed()) {
            if (!confirm('discard edits?')) {
                return;
            }
        }

        if (currentControlEditor.uiButton == this) {

            // deselect

            $(currentControlEditor.uiButton).removeClass('selected');
            $('#control input, #control select, #control textarea')
                .val('')
                .attr('disabled', 'disabled');
            $('#controlType, #controlNumber').html('&nbsp;');
            currentControlEditor = noEditedControl;

        } else {

            $(currentControlEditor.uiButton).removeClass('selected');
            $(this).addClass('selected');

            currentControlEditor = assignments[this.id] || new ControlEditor(this);

            currentControlEditor.display();

            $('#control input, #control select, #control textarea')
                .removeAttr('disabled');
            $('#control select').focus();
        }
    }

    function selectParameter() {
        currentControlEditor.setEditedParameter(TetraDefs.parameterDefinitions[$(this).val()]);
    }

    function pollForChanges() {
        // check for "back" button usage
        if (document.location.hash != currentPath) {
            console.log('move to', document.location.hash);
            showPage(document.location.hash.substr(1).split('/'));
        }

        // fixme attributes should be manipulated only when there have been changes
        if (currentControlEditor.changed()) {
            $('#saveControl, #revertControl').removeAttr('disabled');
        } else {
            $('#saveControl, #revertControl').attr('disabled', 'disabled');
        }
        if (currentFileChanged) {
            $('#saveFile').removeAttr('disabled');
        } else {
            $('#saveFile').attr('disabled', 'disabled');
        }
        $('#presetHasChanged').empty();
        if (currentPresetChanged) {
            $('#presetHasChanged').html("Preset has been edited");
        }
    }

    makeVirtualBcr2000();
    makeTetraParameterSelector();
    $('#bcr button')
        .click(editControl);
    $('#control select')
        .change(selectParameter);
    $('#saveControl')
        .click(function () { currentControlEditor.save() });
    $('#revertControl')
        .click(function () { currentControlEditor.revert() });
    $('#backToDirectory')
        .click(chooseFile);
    $('#backToFile')
        .click(choosePreset);

    $.getJSON("/bcr2000/", function (data, status) {
        if (status != 'success') {
            console.log('error loading directory:', status);
        } else {
            console.log('dir', data.dir);
            $('#chooseFile select')
                .empty()
                .append(_.map(data.dir,
                              function (name) {
                                  return OPTION(null, name)
                              }));
            $('#chooseFile option')
                .click(editFile);
            chooseFile();
     }
    });

    setInterval(pollForChanges, 250);
});