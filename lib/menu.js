var mongoose = require('mongoose'),
    async = require('async'),
    content = require('./content')(),
    models = require('./models');

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
}

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
        if(item.path.substring(0, 1) !== '.'){
            if(item.type === 'file' && (item.path.substring(item.path.length - 9) === '.markdown' || item.path.substring(item.path.length - 3) === '.md')){
                if(item.path.substring(0, 1) === '/'){
                    item.path = item.path.substring(1);
                }
                content.getFinishedContentObj(item.path, conf, function(err, finishedObj){
                    if(err){
                        forCallback(err);
                    }else{
                        if(finishedObj.redirect){
                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.redirect, 'weight': finishedObj.weight};
                        }else{
                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path, 'weight': finishedObj.weight};
                            if(newMenuObj.path.substring(newMenuObj.path.length - 8, newMenuObj.path.length) === 'overview'){
                                newMenuObj.weight = 0;
                            }
                        }
                        menuArray.push(newMenuObj);
                        forCallback(null);
                    }
                });
            }else if(item.type === 'dir'){
                if(conf.ignoreDirs){
                    var ignoreDir = false;
                    async.forEach(conf.ignoreDirs, function(dir, forCallback2){
                        if(item.path === dir){
                            ignoreDir = true;
                        }
                        forCallback2(null);
                    },
                    function(err){
                        if(err){
                            console.log(err);
                        }else{
                            if(ignoreDir){
                                console.log("Ignoring directory: " + item.path);
                                forCallback(null);
                            }else{
                                content.getFinishedContentObj(item.path + '/overview.markdown', conf, function(err, finishedObj){
                                    if(err){
                                        forCallback('error menu parsing dir: ' + item.path + err);
                                    }else{
                                        var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path.replace('/overview',''), 'weight': finishedObj.weight, 'children':[]};
                                        menuArray.push(newMenuObj);
                                        buildMenu(item.path, conf, newMenuObj.children, forCallback);
                                    }
                                });
                            }
                        }
                    });
                }else{
                    content.getFinishedContentObj(item.path + '/overview.markdown', conf, function(err, finishedObj){
                        if(err){
                            forCallback('error menu parsing dir: ' + item.path + err);
                        }else{
                            var newMenuObj = {'title': finishedObj.title, 'path': finishedObj.path.replace('/overview',''), 'weight': finishedObj.weight, 'children':[]};
                            menuArray.push(newMenuObj);
                            buildMenu(item.path, conf, newMenuObj.children, forCallback);
                        }
                    });
                }
            }else{
                console.log('parsing menu skipped non-markdown file: ' + item.path );
                forCallback(null);
            }
        }else{
            console.log('parsing menu skipped dotfile: ' + item.path);
            forCallback(null);
        }
    }
}

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
    }, callback);// callback is given (err, results), where results is the sorted array
}

function saveMenu(menuArr, conf, callback){
    conf.Menu.findOne({'title': 'menu'}, function(err, menu){
        if(err){
            callback(err);
        }else if(menu){
            console.log('updating menu');
            menu.menuArray = menuArr ;
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
}

exports.indexMenu = indexMenu;
exports.buildMenu = buildMenu;
exports.sortMenu = sortMenu;
exports.saveMenu = saveMenu;
