$ = jQuery;

$(document).ready(function () {
    var form = $('#mainform');

    function makeEncoder(id) {
        var id = 'encoder' + id;
        this.append(BUTTON({ id: id, class: 'encoder' }, ''));
    }

    function makeButton(id) {
        var id = 'button' + id;
        this.append(BUTTON({ id: id, class: 'button' }, ''));
    }

    function br(elem) {
        elem.append(BR());
    }
    
    _.each(_.range(1, 9), _.bind(makeEncoder, form));
    _.each(_.range(33, 57), _.bind(makeEncoder, form));
    _.each(_.range(33, 57), _.bind(makeButton, form));
    _.each(_.range(63, 65), _.bind(makeButton, form));
});