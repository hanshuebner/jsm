
function drawAdsr(svg)
{
    var width = parseInt(svg.root().getAttribute('width'));
    var height = parseInt(svg.root().getAttribute('height'));
    var sustainLength = 32;                                 // length of the sustain segment in the graph
    var xTrans = 3;
    var yTrans = height - 3;
    var xScale = width / (4 * 128 + sustainLength + 3);     // A,D,S,R segments variable + sustain segment length 32 + safety margin for markers
    var yScale = -(height / (128 + 6));

    var controlNames = svg.root().parentNode.getAttribute('controls');
    console.log('controlNames', controlNames);
    var controls = controlNames.split(',');
    var keys = [ 'delay', 'attack', 'decay', 'sustain', 'release' ];
    this.controls = [];
    var that = this;
    for (var i = 0; i < keys.length; i++) {
        this.controls[keys[i]] = $('#' + controls[i])[0];
        $(this.controls[keys[i]])
            .bind('change', function () {
                that.redraw();
            });
    }


    function elemXtoX(elemX) {
        return (elemX - xTrans) / xScale;
    }
    function elemYtoY(elemY) {
        return (elemY - yTrans) / yScale;
    }

    this.getControl = function (name)
    {
        return this.controls[name].control.getInternalValue();
    }

    this.setControl = function (name, value)
    {
        value = Math.max(0, Math.min(127, Math.round(value)));
        this.controls[name].setInternalValue(value);
    }

    this.redraw = function ()
    {
        var v = {};
        var that = this;
        _.each(keys, function (key) {
            v[key] = that.getControl(key);
        });
        console.log('delay', v.delay, 'attack', v.attack, 'decay', v.decay, 'sustain', v.sustain, 'release', v.release);
        svg.clear();
        var g = svg.group({ transform: 'translate(' + xTrans + ',' + yTrans + ') scale(' + xScale + ',' + yScale + ')' });
        var points = [ [-3, 0],
                       [v.delay, 0],
                       [v.delay + v.attack, 127],
                       [v.delay + v.attack + v.decay, v.sustain],
                       [v.delay + v.attack + v.decay + 32, v.sustain],
                       [v.delay + v.attack + v.decay + 32 + v.release, 0] ];
        svg.polyline(g, points, { fill: 'transparent',
                                  stroke: 'orange',
                                  strokeWidth: 4 });
        var that = this;
        function mouseMove (e) {
            if (svg.drag) {
                //                    console.log('dragging', svg.drag.key, 'key', svg.drag.key, 'at', elemXtoX(e.offsetX), elemYtoY(e.offsetY), 'delta', (svg.drag.start - ((this.key == 'sustain') ? elemYtoY(e.offsetY) : elemXtoX(e.offsetX))));
                that.setControl(svg.drag.key,
                                svg.drag.oldValue - (svg.drag.start - ((svg.drag.key == 'sustain') ? elemYtoY(e.offsetY) : elemXtoX(e.offsetX))));
                that.redraw();
            }
        }
        function mouseUp (e) {
            if (svg.drag) {
                console.log('mouse up at', elemXtoX(e.offsetX), elemYtoY(e.offsetY));
                $(document)
                    .unbind('mousemove', mouseMove)
                    .unbind('mouseup', mouseUp);
                svg.drag = undefined;
            }
        }
        for (var i = 1; i < points.length; i++) {
            var knob = svg.rect(g,
                                points[i][0] - 3, points[i][1] - 2,
                                7, 7,
                                { fill: 'black',
                                  stroke: 'black' });
            knob.key = keys[i-1];
            $(knob).bind('mousedown', function (e) {
                console.log('knob', this.key, 'clicked at', elemXtoX(e.offsetX), elemYtoY(e.offsetY), e);
                svg.drag = { key: this.key,
                             oldValue: that.getControl(this.key),
                             start: (this.key == 'sustain') ? elemYtoY(e.offsetY) : elemXtoX(e.offsetX)
                           };

                $(document)
                    .bind('mousemove', mouseMove)
                    .bind('mouseup', mouseUp);
            });
        }

    }

    this.redraw();
}

$(document).ready(function () {
    $('input').bind('change', function () {
        $('.adsr').each(function () { this.redraw() });
    });
    document.onmousedown = function() { return false; } // disable page text selection
});