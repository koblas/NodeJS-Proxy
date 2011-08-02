
var mime = module.exports = {
    types: {
        'htm' : 'text/html',
        'html' : 'text/html',
        'js' : 'application/javascript',
        'txt' : 'text/plain',
        'gif' : 'image/gif',
        'png' : 'image/png',
        'jpg' : 'image/jpeg',
    },

    default_type : 'application/octet-stream',

    lookup: function(path, fallback) {
        var ext = path.replace(/.*[\.\/]/, '').toLowerCase();
        return mime.types[ext] || fallback || mime.default_type;
    },
};
