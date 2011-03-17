$ = jQuery;

$(document).ready(function () {
    var TetraDefs = exports;                                // for now
    var form = $('#bcr');

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

    document.assignments = {};

    function makeBcl(control, parameter) {
        return "$" + $(control).attr('control-type') + ' ' + $(control).attr('control-number') + "\n"
            + '  .easypar NRPN ' + parameter.index + ' 1 ' + (parameter.min || 0) + ' ' + parameter.max + ' absolute/14' + "\n"
            + '  .showvalue on' + "\n"
            + '  .mode 1dot' + "\n"
            + '  .resolution 10 50 100 500' + "\n";
    }

    function editParameter () {
        if (document.editedControl != this) {

            $(document.editedControl).removeClass('selected');
            $(this).addClass('selected');

            $('#control-type').html($(this).attr('control-type'));
            $('#control-number').html($(this).attr('control-number'));

            var assignment = document.assignments[this.id];
            if (assignment) {
                $('#parameter-name-list')
                    .val(assignment.parameter.index);
                $('#bcl')
                    .val(assignment.bcl);
            } else {
                $('#parameter-name-list')
                    .val('<not assigned>');
                $('#bcl')
                    .val('');
            }
            document.editedControl = this;
        }
    }

    function saveParameter () {
        var control = document.editedControl;
        if (control) {
            var type = $(control).attr('control-type');
            var number = $(control).attr('control-number');
            var id = control.id;
            var parameter = TetraDefs.parameterDefinitions[$(this).val()];
            var bcl = makeBcl(control, parameter);
            document.assignments[id] = {
                parameter: parameter,
                bcl: bcl
            };
            $('#' + id)
                .empty()
                .append(DIV(null, parameter.name));
            $('#bcl').val(bcl);
        }
    }


    _.each(_.range(1, 9), _.bind(makeEncoder, form));
    _.each(_.range(33, 57), _.bind(makeEncoder, form));
    _.each(_.range(33, 57), _.bind(makeButton, form));
    _.each(_.range(63, 65), _.bind(makeButton, form));

    $('#bcr button')
        .click(editParameter);
    $('#control select')
        .change(saveParameter);
});