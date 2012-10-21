var mongoose = require('mongoose'),
    async = require('async'),
    content = require('./content'),
    models = require('./models');

function indexMenu(conf, callback){
    var menuArr =[];
    console.log('menu index request received');
    buildMenu(menuArr, conf, function(err){
        if(err){
            callback('error building menu: ' + err);
        }else{
            sortMenu(menuArr, function(err, sortedMenu){
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

function buildMenu(menuArray, conf, callback){
    conf.github.ghrepo.contents(path, function(err, data){
        if(err){
            callback('ghrepo error: ' + err);
        }else{
            async.forEach(data, parseMenuArray, callback);
        }
    });

    function parseMenuArray(item, forCallback){
        if(item.path.substring(0, 1) !== '.'){
            if(item.type === 'file' && (item.path.substring(item.path.length - 9) === '.markdown' || item.path.substring(item.path.length - 3) === '.md')){
                if(item.path.substring(0, 1) === '/'){
                    item.path = item.path.substring(1);
                }
                content.getContent(item.path, ghrepo, currentConf.github.repoName, function(err, parsedObj){
                    if(err){
                        forCallback('getContent error for path ' + item.path + ': ' + err);
                    }else{
                        if(parsedObj.redirect){
                            var newMenuObj = {'title': parsedObj.title, 'path': parsedObj.redirect, 'weight': parsedObj.weight};
                        }else{
                            var newMenuObj = {'title': parsedObj.title, 'path': parsedObj.path, 'weight': parsedObj.weight};
                            if(newMenuObj.path.substring(newMenuObj.path.length - 8, newMenuObj.path.length) === 'overview'){
                                newMenuObj.weight = 0;
                            }
                        }
                        menuArray.push(newMenuObj);
                        forCallback(null);
                    }
                });
            }else if(item.type === 'dir'){
                if(item.path !== currentConf.imagePath){
                    content.getContent(item.path + '/overview.markdown', ghrepo, currentConf.github.repoName, function(err, parsedObj){
                        if(err){
                            forCallback('error menu parsing dir: ' + item.path + err);
                        }else{
                            var newMenuObj = {'title': parsedObj.title, 'path': parsedObj.path.replace('/overview',''), 'weight': parsedObj.weight, 'children':[]};
                            menuArray.push(newMenuObj);
                            buildMenu(item.path, currentConf, ghrepo, newMenuObj.children, forCallback);
                        }
                    });
                }else{
                    console.log('parsing menu skipped image path: ' + item.path);
                    forCallback(null);
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
    }, callback);
}

function saveMenu(menuArr, currentConf, mongoMenu, callback){
    mongoMenu.findOne({'title': 'menu'}, function(err, menu){
        if(err){
            callback(err);
        }else if(menu){
            console.log('updating menu');
            menu.menuArray = menuArr ;
        }else{
            console.log('saving new menu');
            var menu = new mongoMenu({
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