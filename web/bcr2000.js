$ = jQuery;

$(document).ready(function () {
    var TetraDefs = exports;                                // for now
    var form = $('#bcr');

    function makeEncoder(id) {
        var id = 'encoder' + id;
        this.append(BUTTON({ id: id, 'class': 'encoder' }, ''));
    }

    function makeButton(id) {
        var id = 'button' + id;
        this.append(BUTTON({ id: id, 'class': 'button' }, ''));
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

    function editParameter () {
        if (document.editedControl != this) {
            $(document.editedControl).removeClass('selected');
            $(this).addClass('selected');
            var assignedToParameter = document.assignments[this.id];
            $('#parameter-name-list')
                .val(assignedToParameter ? assignedToParameter.index : '<not assigned>');
            document.editedControl = this;
        }
        $('#control-dialog').dialog('open');
    }

    function saveParameter () {
        var id = document.editedControl.id;
        var parameter = TetraDefs.parameterDefinitions[$(this).val()];
        document.assignments[id] = parameter;
        $('#' + id)
            .empty()
            .append(DIV(null, parameter.name));
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