var mongoose = require('mongoose')
  , async = require('async')
  , content = require('./content')()
  , models = require('./models')
  ;

module.exports = function(contentParam){

    if(contentParam){
        content = contentParam;
    }

    content2 = require('./content')();
    content.parseDir = content2.parseDir;

    function indexMenu(conf, callback){
        var menuArr = [];
        console.log('menu index request received');
        buildMenu(conf.rootPath, conf, menuArr, function(err, menuArray){
            if(err){
                callback('error building menu: ' + err);
            }else{
                sortMenu(menuArray, function(err, sortedMenu){
                    if(err){
                        callback('error sorting menu: ' + err);
                    }else{
                        saveMenu(sortedMenu, conf, function(err){
                            if(err){
                                callback('error saving menu: ' + err);
                            }else{
                                callback(null);
                            }
                        });
                    }
                });
            }
        });
    };

    function buildMenu(path, conf, menuArray, callback){
        conf.github.ghrepo.contents(path, function(err, data){
            if(err){
                callback('ghrepo error: ' + err);
            }else{
                async.forEach(data, parseMenuArray, function(err){
                    if(err){
                        callback(err);
                    }else{
                        callback(null, menuArray);
                    }
                });
            }
        });

        function parseMenuArray(item, forCallback){
            content.parseDir(item.path, conf, 
                function(path, callback){
                    console.log('fileFunc: ' + path);
                    content.getFinishedContentObj(item.path, conf, function(err, finishedObj){
                        if(err){
                            callback(err);
                        }else{
                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path, 'weight': finishedObj.weight};
                            if(item.path.substring(item.path.length - 14, item.path.length) === 'index.markdown'){
                                newMenuObj.path = newMenuObj.path.replace("index","");
                                newMenuObj.weight = 0;
                            }
                            menuArray.push(newMenuObj);
                            callback(null);
                        }
                    });
                },
                function(path, callback){
                    console.log('dirFunc: ' + path);
                    content.getFinishedContentObj(item.path + '/index.markdown', conf, function(err, finishedObj){
                        if(err){
                            callback('error menu parsing dir: ' + item.path + err);
                        }else{
                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path.replace('/index',''), 'weight': finishedObj.weight, 'children':[]};
                            menuArray.push(newMenuObj);
                            buildMenu(item.path, conf, newMenuObj.children, callback);
                        }
                    });
                },
                forCallback
            );
            /*
            if(item.path.substring(0, 1) !== '.'){
                if(item.path === ('README.md' || 'README.markdown' || 'readme.md' || 'readme.markdown')){
                    console.log('parsing menu skipped readme: ' + item.path );
                    forCallback(null);
                }else if(item.type === 'file' && (item.path.substring(item.path.length - 9) === '.markdown' || item.path.substring(item.path.length - 3) === '.md')){
                    if(item.path.substring(0, 1) === '/'){
                        item.path = item.path.substring(1);
                    }
                    content.getFinishedContentObj(item.path, conf, function(err, finishedObj){
                        if(err){
                            forCallback(err);
                        }else{
                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path, 'weight': finishedObj.weight};
                            if(item.path.substring(item.path.length - 14, item.path.length) === 'index.markdown'){
                                newMenuObj.path = newMenuObj.path.replace("index","");
                                newMenuObj.weight = 0;
                            }
                            menuArray.push(newMenuObj);
                            forCallback(null);
                        }
                    });
                }else if(item.type === 'dir'){
                    if(item.path === conf.blog.path){
                        forCallback(null);
                    }else{
                        var ignoreDir = false;
                        async.series([
                            function(callback){
                                async.parallel([
                                    function(callback){
                                        if(conf.ignore){
                                            async.forEach(conf.ignore, function(dir, forCallback2){
                                                if(item.path === dir){
                                                    ignoreDir = true;
                                                }
                                                forCallback2(null);
                                            },
                                            callback
                                            );
                                        }else{
                                            callback(null);
                                        }
                                    },
                                    function(callback){
                                        if(conf.assets && conf.assets.path === item.path){
                                            ignoreDir = true;
                                        }
                                        callback(null);
                                    }],
                                    function(err, results){
                                        callback(err);
                                    });
                            },
                            function(callback){
                                if(ignoreDir){
                                    console.log('Menu parsing, ignoring directory: ' + item.path);
                                    callback(null);
                                }else{
                                    content.getFinishedContentObj(item.path + '/index.markdown', conf, function(err, finishedObj){
                                        if(err){
                                            callback('error menu parsing dir: ' + item.path + err);
                                        }else{
                                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path.replace('/index',''), 'weight': finishedObj.weight, 'children':[]};
                                            menuArray.push(newMenuObj);
                                            buildMenu(item.path, conf, newMenuObj.children, callback);
                                        }
                                    });
                                }
                            }],
                            forCallback
                        );
                    }
                }else{
                    console.log('parsing menu skipped non-markdown file: ' + item.path );
                    forCallback(null);
                }
            }else{
                console.log('parsing menu skipped dotfile: ' + item.path);
                forCallback(null);
            }
            */
        };
    };

    function sortMenu(menuArr, callback){
        async.sortBy(menuArr, function(item, sortCallback){
            if(item.children){
                if(item.children.length > 0){
                    sortMenu(item.children, function(err, results){
                        item.children = results;
                        sortCallback(null, item.weight);
                    });
                }else{
                    sortCallback(null, item.weight);
                }
            }else{
                sortCallback(null, item.weight);
            }
        }, callback);
    };

    function saveMenu(menuArr, conf, callback){
        conf.Menu.findOne({'title': 'menu'}, function(err, menu){
            if(err){
                callback(err);
            }else if(menu){
                console.log('updating menu');
                menu.menuArray = menuArr;
            }else{
                console.log('saving new menu');
                var menu = new conf.Menu({
                    title: "menu",
                    menuArray: menuArr
                });
            }

            menu.save(function(err){
                if(err){
                    callback(err);
                }else{
                    console.log('menu saved to mongodb');
                    callback(null);
                }
            });
        });
    };

    return { indexMenu: indexMenu
           , buildMenu: buildMenu
           , sortMenu: sortMenu
           , saveMenu: saveMenu
           };

};
