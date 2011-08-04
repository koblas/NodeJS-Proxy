var url = require('url');

function rewrite_dev(uri) {
    if (uri == 'http://player.ooyala.com/info/primary/')
        return null;
    if (uri == 'http://control.adap.tv/crossdomain.xml') {
        return 500;
    }

    var parsed = url.parse(uri);

    var stageHosts = [
        "www.ooyala.com",
        "ooyala.co.jp",
        "ooyala.jp",
        "www.ooyala.jp",
        "local.ooyala.jp",
        "staging.ooyala.jp",
        "a.ooyala.com",
        "f1.a.ooyala.com",
        "f2.a.ooyala.com",
        "videos.teen.com",
        "f3.a.ooyala.com",
        "p.ooyala.com",
        "player.ooyala.com",
        "sas.ooyala.com",
        "l.player.ooyala.com",
    ];

    if (stageHosts.indexOf(parsed.host) >= 0) {
        parsed.host = "dev.corp.ooyala.com:3000";
        return url.format(parsed);
    }

    return null;
}

function rewrite_stage(uri) {
    if (uri == 'http://player.ooyala.com/info/primary/')
        return null;

    var parsed = url.parse(uri);

    var stageHosts = [
        "www.ooyala.com",
        "ooyala.co.jp",
        "ooyala.jp",
        "www.ooyala.jp",
        "local.ooyala.jp",
        "staging.ooyala.jp",
        "a.ooyala.com",
        "f1.a.ooyala.com",
        "f2.a.ooyala.com",
        "videos.teen.com",
        "f3.a.ooyala.com",
        "p.ooyala.com",
        "player.ooyala.com",
        "sas.ooyala.com",
        "l.player.ooyala.com",
    ];

    if (stageHosts.indexOf(parsed.host) >= 0) {
        parsed.host = "player-staging.ooyala.com";
        return url.format(parsed);
    }

    return null;
}

function rewrite(uri) {
    return rewrite_dev(uri);
}

exports.rewrite = rewrite;
