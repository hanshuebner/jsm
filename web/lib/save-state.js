function restoreStateFromCookie()
{
    if ($.cookie('state')) {
        var state = evalJSON($.cookie('state'));
        document.state = state;
        for (var key in document.state) {
            $('#' + key).val(state[key]).trigger('change');
        }
        document.state = state;
    } else {
        document.state = {};
    }
}

function saveStateToCookie()
{
    $.cookie('state', serializeJSON(document.state));
}

function saveState(key, value)
{
    document.state[key] = value;
    saveStateToCookie();
}

