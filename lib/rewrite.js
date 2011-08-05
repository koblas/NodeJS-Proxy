var path = require('path');
var url = require('url');
var fs  = require('fs');

var rewriter = null;

var choices  = [
    { 
        id : 'off',
        handler : null,
        name : 'off'
    }
];

/*
** Load the choices from the configured modules...
*/

fs.readdir(path.join(process.cwd(), "/rewrite"), function (err, files) {
    var base = path.join(process.cwd(), "/rewrite");

    for (var idx in files) {
        var file = path.join(base, files[idx]);

        var r = require(file);

        choices.push({
            id : files[idx].substr(0, files[idx].length - 3),
            name : r.name,
            handler : r.rewrite,
        });
    }
});

function rewrite(uri, request, callback) {
    if (rewriter == null)
        return null;
    return rewriter(rewrite_dev(uri));
}

function rewrite_choices() {
    var l = [];
    for (var i in choices) {
        l.push(choices[i].id);
    }
    return l;
}

function rewrite_set(choice) {
    for (var i in choices) {
        if (choice == choices[i].id) {
            rewriter = choices[i].handler;
            return true;
        }
    }
    return false;
}

exports.rewrite = rewrite;
exports.rewrite_choices = rewrite_choices;
exports.rewrite_set = rewrite_set;
