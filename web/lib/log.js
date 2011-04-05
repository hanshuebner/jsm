function addToLog(message) {
    $("#log")
        .append(message + "<br/>")
        .attr('scrollTop', $("#log").attr("scrollHeight"));
}

