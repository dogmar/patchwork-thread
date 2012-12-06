var async = require('async'),
    express = require('express'),
    app = express.createServer(),
    content = require('./lib/content')(),
    menu = require('./lib/menu')(),
    database = require('./lib/database'),
    search = require('./lib/search'),
    models = require('./lib/models'),
    config = require('./lib/config')(),
    asset = require('./lib/asset')(),
    payload = require('./lib/payload')();

app.use(express.logger());
app.configure(function(){
    app.use(express.methodOverride());
    app.use(express.bodyParser());
    app.use(app.router);
    app.use(express.logger());
});

app.post('/pusher', function(req, res){
    console.log('post received');
    payload.pushPayload(req, function(err){
        if(err){
            console.log(err);
        }else{
            console.log('Post finished ' + Date());
        }
    });
});

app.get('/index/:part/:user/:repo', function(req, res){
    var parts = {};
    switch(req.params.part){
        case "content":
            parts.content = true;
            break;
        case "menu":
            parts.menu = true;
            break;
        case "assets":
            parts.assets = true;
            break;
        case "all":
            parts.content = true;
            parts.menu = true;
            parts.assets = true;
            break;
    }
    config.getConf(req.params.user, req.params.repo, function(err, conf){
        if(err){
            console.log(err);
            res.send(err);
        }else{
            async.parallel([
                function(callback){
                    if(parts.content){
                        indexContent(conf, callback);
                    }else{
                        callback(null);
                    }
                },
                function(callback){
                    if(parts.menu){
                        menu.indexMenu(conf, function(err){
                            if(err){
                                console.log(err);
                            }
                            callback(null);
                        });
                    }else{
                        callback(null);
                    }
                },
                function(callback){
                    if(parts.assets){
                        asset.handleAssets(conf, callback);
                    }else{
                        callback(null);
                    }
            }],
            function(err, results){
                if(err){
                    console.log(err);
                }
                console.log('done');
                res.send('done');
            });
        }
    });
});

function indexContent(conf, callback){
    content.parseDir(conf.rootPath, conf, function(filePath, forCallback){
        content.getFinishedContentObj(filePath, conf, function(err, finishedObj){
            if(err){
                console.log('error getting obj: ' + err);
                forCallback(null);
            }else{
                async.parallel([
                    function(paraCallback){
                        database.addToDB(finishedObj, conf, paraCallback);
                    },
                    function(paraCallback){
                        search.indexToSearch(finishedObj, conf, function(err){
                            if(err){
                                console.log('error indexToSearch: ' + err);
                            }
                            paraCallback(null);
                        });
                    }],
                    function(err, results){
                        forCallback(err);
                });
            }
        });
    },
    function(path, conf, callback){
        callback(null)
    }, callback);
};

app.listen(process.env.VCAP_APP_PORT || 4000);
