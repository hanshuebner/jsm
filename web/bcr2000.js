var $ = jQuery;

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

function loadPreset(presetNumber)
{
    console.log('load preset', presetNumber);
    $('#presetNumber').html(presetNumber);
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
                                retval.temporaryPreset.controls[type + id] = {
                                    name: name,
                                    type: type,
                                    id: id,
                                    bcl: chunk
                                };
                            }) == command) {
            console.log('error parsing "' + command + '"');
        }
    }
    
    var bclHandlers = {
        rev: function (command) {
            retval.rev = command;
        },
        global: function (command, chunk) {
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

    function addPreset(preset) {
        retval += "$preset\n";
        addChunk(preset.presetInfo);
        _.each(['encoder', 'button'],
               function (type) {
                   _.each(_.range(64),
                          function (controlId) {
                              var control = preset.controls[type + controlId];
                              if (control) {
                                  retval += "$" + type + " " + (controlId + 1);
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
    this.name = '';
    this.bcl = '';
    this.parameter = undefined;
}

ControlEditor.prototype.display = function () {
    $('#controlType').html(this.controlType);
    $('#controlNumber').html(this.controlNumber);
    $('#controlName').val(this.name || '');
    $('#parameter-name-list')
        .val(this.parameter ? this.parameter.index : "<not assigned>")
        .attr('disabled', false);
    $('#bcl')
        .val(this.bcl || '');
    $(this.uiButton).html(this.name);
}

ControlEditor.prototype.save = function () {
    var parameter = TetraDefs.parameterDefinitions[$('#control select').val()];
    var bcl = $('#bcl').val();
    var name = $('#controlName').val();
    if (parameter && (this.makeBcl(parameter) != bcl)) {
        parameter = undefined;
    }
    this.name = name;
    this.parameter = parameter;
    this.bcl = bcl;
    assignments[this.id] = editedControl;
    // change button label
    $('#' + this.id)
        .empty()
        .append(DIV(null, this.name));
}

ControlEditor.prototype.revert = function () {
    this.display();
}

ControlEditor.prototype.makeBcl = function (parameter) {
    return "$" + this.controlType + ' ' + this.controlNumber + "\n"
        + '  .easypar NRPN ' + parameter.index + ' 1 ' + (parameter.min || 0) + ' ' + parameter.max + ' absolute/14' + "\n"
        + '  .showvalue on' + "\n"
        + '  .mode 1dot' + "\n"
        + '  .resolution 10 50 100 500' + "\n";
}

ControlEditor.prototype.setEditedParameter = function (parameter) {
    $('#bcl').val(this.makeBcl(parameter));
    var editName = $('#controlName').val()
    if ((editName == '') || (this.parameter && (editName == this.parameter.name))) {
        $('#controlName').val(parameter.name);
    }
}

ControlEditor.prototype.changed = function () {
    return this.bcl != $('#bcl').val()
        || this.name != $('#controlName').val();
}

$(document).ready(function () {

    var TetraDefs = exports;                                // for now

    var noEditedControl = { changed: function () { return false; } };
    var editedControl = noEditedControl;
    var assignments = {};
    var currentFilename;

    // yet another multi-page "framework"
    function showPage(id, headline) {
        $("#pages > div").css('display', 'none');
        $('#headline')
            .empty()
            .append(SPAN(null, _.toArray(arguments).slice(1)));
        if (id) {
            $("#" + id).css('display', 'block');
        }
    }

    // file selector
    function editFile () {
        currentFilename = $(this).html();
        choosePreset();
    }

    function choosePreset() {
        $.getJSON("/bcr2000/" + currentFilename, function (data, status) {
            if (status == 'success') {
                parsedBCL = parseBCL(data.preset);
                showPage('choosePreset', 'Choose a preset in file ', SPAN(null, currentFilename), ' to edit');
            } else {
                alert('could not load file ' + currentFilename + ": " + status);
            }
        });
    }

    // preset editor
    function savePreset () {
        choosePreset();
    }

    // preset selector
    function editPreset () {
        var presetNumber = $(this).html();
        showPage('editPreset', 'Editing file ', SPAN(null, currentFilename), ' preset ', SPAN(null, presetNumber));
        loadPreset(presetNumber);
        $('#control input, #control select, #control textarea')
            .attr('disabled', 'disabled');
    }

    function saveFile () {
        showPage('chooseFile', 'Choose file to edit');
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
            this.append(BUTTON(makeControlAttributes('encoder', id), ''));
        }

        function makeButton(id) {
            this.append(BUTTON(makeControlAttributes('button', id), ''));
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

        if (editedControl.changed()) {
            if (!confirm('discard edits?')) {
                return;
            }
        }

        if (editedControl.uiButton == this) {

            $(editedControl.uiButton).removeClass('selected');
            $('#control input, #control select, #control textarea')
                .val('')
                .attr('disabled', 'disabled');
            $('#controlType, #controlNumber').html('&nbsp;');
            editedControl = noEditedControl;

        } else {

            $(editedControl.uiButton).removeClass('selected');
            $(this).addClass('selected');

            editedControl = assignments[this.id] || new ControlEditor(this);

            editedControl.display();

            $('#control input, #control select, #control textarea')
                .removeAttr('disabled');
        }
    }

    function selectParameter() {
        editedControl.setEditedParameter(TetraDefs.parameterDefinitions[$(this).val()]);
    }

    function pollForChanges() {
        if (editedControl.changed()) {
            $('#save, #revert').removeAttr('disabled');
        } else {
            $('#save, #revert').attr('disabled', 'disabled');
        }
    }

    makeVirtualBcr2000();
    makeTetraParameterSelector();
    $('#bcr button')
        .click(editControl);
    $('#control select')
        .change(selectParameter);
    $('#save')
        .click(function () { editedControl.save() });
    $('#revert')
        .click(function () { editedControl.revert() });
    $('#savePreset')
        .click(savePreset);

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
            showPage('chooseFile', 'Choose file to edit');
     }
    });

    setInterval(pollForChanges, 250);
});