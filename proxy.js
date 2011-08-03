/*
** Peteris Krumins (peter@catonmat.net)
** http://www.catonmat.net  --  good coders code, great reuse
**
** A simple proxy server written in node.js.
**
*/

var http    = require('http');
var sys     = require('sys');
var url     = require('url');
var fs      = require('fs');
var uuid    = require('./lib/uuid');
var getopt  = require('./lib/getopt');
var path    = require('path');
var mime    = require('./lib/mime');
var config  = require('./config').config;
var rewrite = require('./lib/rewrite').rewrite;

var blacklist = [];
var iplist    = [];

var verbose = 0;

var listeners = [];

var history = [];

fs.watchFile(config.black_list,    function(c,p) { update_blacklist(); });
fs.watchFile(config.allow_ip_list, function(c,p) { update_iplist(); });

function update_list(msg, file, mapf, collectorf) {
  fs.stat(file, function(err, stats) {
    if (!err) {
      sys.log(msg);
      fs.readFile(file, function(err, data) {
        collectorf(data.toString().split("\n")
                   .filter(function(rx) { return rx.length })
                   .map(mapf));
      });
    }
    else {
      sys.log("File '" + file + "' was not found.");
      collectorf([]);
    }
  });
}

function update_blacklist() {
  update_list(
    "Updating host black list.",
    config.black_list,
    function(rx) { return RegExp(rx) },
    function(list) { blacklist = list }
  );
}

function update_iplist() {
  update_list(
    "Updating allowed ip list.",
    config.allow_ip_list,
    function(ip){return ip},
    function(list) { iplist = list }
  );
}

function ip_allowed(ip) {
  if (iplist.length == 0 && ip == '127.0.0.1') return true;
  return iplist.some(function(ip_) { return ip==ip_; });
}

function host_allowed(host) {
  return !blacklist.some(function(host_) { return host_.test(host); });
}

function deny(response, msg) {
  response.writeHead(401);
  response.write(msg);
  response.end();
}

function update_listeners(hobj) {
    var nlisteners = [];

    var msgs = hobj || [];

    for (var idx in listeners) {
        var lfunc = listeners[idx];

        if (msgs.length > 0) {
            if (lfunc(msgs)) {
                nlisteners.push(lfunc);
            }
        } else {
            nlisteners.push(lfunc);
        }
    }

    listeners = nlisteners;
}

function microtime() {
    // Returns either a string or a float containing the current time in seconds and microseconds  
    // 
    // version: 1107.2516
    // discuss at: http://phpjs.org/functions/microtime
    // +   original by: Paulo Freitas
    // *     example 1: timeStamp = microtime(true);
    // *     results 1: timeStamp > 1000000000 && timeStamp < 2000000000
    return new Date().getTime() / 1000;
}

/*
**  Main dispatch point.
*/
function server_cb(request, response) {
    var host = request.headers['host'].split(':');
    if (host[0] == "localhost") {
        return dashboard_router(request, response);
    }

    var history_obj = new Object();

    history_obj.uuid = uuid();
    history_obj.request_url = request.url;
    history_obj.start_timestamp   = microtime();
    history_obj.timestamp   = microtime();
    history_obj.request_headers = request.headers;

    history.push(history_obj);

    var ip = request.connection.remoteAddress;
    if (!ip_allowed(ip) || !host_allowed(request.url)) {
        msg = "IP " + ip + " is not allowed to use this proxy";
        history_obj.proxy = 'DENIED';
        deny(response, msg);
        sys.log(msg);
        update_listeners([history_obj]);
        return;
    }

    var newurl = rewrite(request.url);

    if (newurl) {
        history_obj.proxy = 'PROXY';
        sys.log(ip + ": PROXY " + request.method + " " + request.url + " => " + newurl);
    } else {
        history_obj.proxy = 'PASS';
        sys.log(ip + ": PASS " + request.method + " " + request.url);
        newurl = request.url;
    }

    var surl = url.parse(newurl);
    var proxy = http.createClient(surl.port || 80, surl.hostname);
    var proxy_request = proxy.request(request.method, newurl, request.headers);

    proxy_request.addListener('response', function(proxy_response) {
        proxy_response.addListener('data', function(chunk) {
            response.write(chunk, 'binary');
        });
        proxy_response.addListener('end', function() {
            response.end();
        });

        history_obj.timestamp = microtime();
        history_obj.status_code = proxy_response.statusCode;
        history_obj.response_headers = proxy_response.headers;
        sys.log(newurl + " Response = " + proxy_response.statusCode + " Headers=" + JSON.stringify(proxy_response.headers));

        update_listeners([history_obj]);

        response.writeHead(proxy_response.statusCode, proxy_response.headers);
    });
    request.addListener('data', function(chunk) {
        proxy_request.write(chunk, 'binary');
    });
    request.addListener('end', function() {
        proxy_request.end();
    });

    update_listeners([history_obj]);
}

/*
**
*/

function send_file(request, response, filename) {
  var fullpath = path.join(process.cwd(), filename);

  sys.log("Static = " + filename);

  path.exists(fullpath, function(exists) {
    if (!exists) {
        response.writeHead(404, {"Content-Type" : "text/plain"});
        response.write("404 Not Found\n");
        response.end();
        return;
    }

    fs.readFile(fullpath, "binary", function(err, file) {
        if (err) {
            response.writeHead(500, {"Content-Type" : "text/plain"});
            response.write(err + "\n");
            response.end();
            return;
        }

        response.writeHead(200, {"Content-Type" : mime.lookup(filename) });
        response.write(file, "binary");
        response.end();
    });
  });
}

function dashboard_update(request, response) {
  send_file(request, response, "_update.html");
}

/* JOIN and PART are "session things"... */
function handle_join(request, response) {
    response.writeHead(200, {"Content-Type" : "application/json" });
    response.write("{}", "binary");
    response.end();
}

function handle_part(request, response) {
    response.writeHead(200, {"Content-Type" : "application/json" });
    response.write("{}", "binary");
    response.end();
}

/* PROCESS MESSAGE */
function handle_recv(request, response) {
    var surl = url.parse(request.url, true);
    var since = surl.query['since'];

    var lfunc = function(msg) {
        response.writeHead(200, {"Content-Type" : "application/json" });
        response.write(JSON.stringify({ 'messages' : msg }), "binary");
        response.end();
        return false;
    };

    msgs = [];
    for (var idx in history) {
        if (history[idx].timestamp > since) {
            msgs.push(history[idx]);
        }
    }

    if (msgs.length > 0) {
        lfunc(msgs);
    } else {
        listeners.push(lfunc);
    }
}

function dashboard_router(request, response) {
    var surl = url.parse(request.url, true);
    var ip = request.connection.remoteAddress;

    var routes = {
        "/" : function() { send_file(request, response, "static/index.html"); },
        "/client.js" : function() { send_file(request, response, "static/client.js"); },
        "/DevTools.css" : function() { send_file(request, response, "static/devTools.css"); },
        "/DevTools.js" : function() { send_file(request, response, "static/devTools.js"); },
        "/update" : dashboard_update,
        "/join" : handle_join,
        "/recv" : handle_recv,
        "/part" : handle_part,
    };

    sys.log(ip + " : LOCAL " + request.url);

    var f = null;

    if (surl.pathname.match(/\/Images/)) {
        f = function() { send_file(request, response, "static" + surl.pathname); }
    } else {
        f = routes[surl.pathname];
    }

    if (f)
        return f(request, response);

    msg = "Not found";
    deny(response, msg);
}

/*
**
*/
function main(argv) {
    var parser, option;

    var port = config.proxy_port;

    parser = new getopt.BasicParser('vp:', argv);
    while ((option = parser.getopt()) !== undefined && !option.error) {
      if (option.option == 'p') {
         port = option.optarg;
      } else if (option.option == 'v') {
         verbose ++;
      }
    }

    update_blacklist();
    update_iplist();

    sys.log("Starting the proxy server on port=" + port);
    http.createServer(server_cb).listen(port);
}

main(process.argv);
