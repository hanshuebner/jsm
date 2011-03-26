$ = jQuery;

editedControl = { changed: function () { return false; } };
assignments = {};

function loadPreset(presetNumber)
{
    console.log('load preset', presetNumber);
    $('#presetNumber').html(presetNumber);
}

$(document).ready(function () {

    var TetraDefs = exports;                                // for now

    // preset selector
    function editPreset () {
        var presetNumber = $(this).html();
        $('#choosePreset').css('display', 'none');
        $('#main').css('display', 'block');
        loadPreset(presetNumber);
    }

    $('#choosePreset select')
        .append(_.map(_.range(1, 33),
                      function (i) {
                          return OPTION(null, i)
                      }));
    $('#choosePreset form')
        .submit(function () { return false; });
    $('#choosePreset option')
        .click(editPreset);

    // preset editor
    function savePreset () {
        $('#main').css('display', 'none');
        $('#choosePreset').css('display', 'block');
    }

    $('form').submit(function () { return false; });
    
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
        if (editedControl.uiButton != this) {

            if (editedControl.changed()) {
                if (!confirm('discard edits?')) {
                    return;
                }
            }

            $(editedControl.uiButton).removeClass('selected');
            $(this).addClass('selected');

            editedControl = assignments[this.id] || {

                id: this.id,
                uiButton: this,
                controlType: $(this).attr('control-type'),
                controlNumber: $(this).attr('control-number'),
                name: '',
                bcl: '',
                parameter: undefined,

                display: function () {
                    $('#controlType').html(this.controlType);
                    $('#controlNumber').html(this.controlNumber);
                    $('#controlName').val(this.name || '');
                    $('#parameter-name-list')
                        .val(this.parameter ? this.parameter.index : "<not assigned>")
                        .attr('disabled', false);
                    $('#bcl')
                        .val(this.bcl || '');
                    $(this.uiButton).html(this.name);
                },

                save: function () {
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
                },

                revert: function () {
                    this.display();
                },

                makeBcl: function (parameter) {
                    return "$" + this.controlType + ' ' + this.controlNumber + "\n"
                        + '  .easypar NRPN ' + parameter.index + ' 1 ' + (parameter.min || 0) + ' ' + parameter.max + ' absolute/14' + "\n"
                        + '  .showvalue on' + "\n"
                        + '  .mode 1dot' + "\n"
                        + '  .resolution 10 50 100 500' + "\n";
                },

                setEditedParameter: function (parameter) {
                    $('#bcl').val(this.makeBcl(parameter));
                    var editName = $('#controlName').val()
                    if ((editName == '') || (this.parameter && (editName == this.parameter.name))) {
                        $('#controlName').val(parameter.name);
                    }
                },

                changed: function () {
                    return this.bcl != $('#bcl').val()
                        || this.name != $('#controlName').val();
                }
            };

            editedControl.display();
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
    $('#preset form')
        .submit(function () { return false; });
    $('#savePreset')
        .click(savePreset);

    setInterval(pollForChanges, 250);
});