var async = require('async'),
    request = require('request'),
    yaml = require('js-yaml'),
    pagedown = require('pagedown'),
    converter = new pagedown.Converter(),
    _s = require('underscore.string'),
    imgRegex = /\<img[\s\S]+?\/>/;


module.exports = function(requestParam){
    if(typeof requestParam !== 'undefined'){
        request = requestParam;
    }
    function parseDir(path, conf, fileFunc, dirFunc, callback){
        conf.github.ghrepo.contents(path, function(err, data){
            if(err){
                callback(err);
            }else{
                async.forEach(data, 
                    function(item, forCallback){
                        if(item.type === 'file'){
                            async.parallel([
                                function(callback){
                                    checkDotfile(item.path, callback);
                                },
                                function(callback){
                                    checkMarkdownFile(item.path, callback);
                                },
                                function(callback){
                                    checkReadme(item.path, callback);
                                }
                            ],
                            function(err, result){
                                if(err){
                                    console.log(err);
                                    forCallback(null);
                                }else{
                                    fileFunc(item.path, forCallback);
                                }
                            });
                        }else if(item.type === 'dir'){
                            async.parallel([
                                function(callback){
                                    checkIgnoreDir(item.path, conf, callback);
                                },
                                function(callback){
                                    checkAssetsDir(item.path, conf, callback);
                                }
                            ],
                            function(err, result){
                                if(err){
                                    console.log(err);
                                    forCallback(null);
                                }else{
                                    dirFunc(item.path, conf, function(err){
                                        parseDir(item.path, conf, fileFunc, dirFunc, forCallback);
                                    });
                                }
                            });
                        }else{
                            console.log('Unknown file type: ' + item.path);
                            forCallback(null);
                        }
                    },
                    callback);
            }
        });
    };

    function checkDotfile(path, callback){
        var pathArr = path.split('/');
        if(pathArr[pathArr.length - 1].substring(0, 1) === '.'){
            callback('Skipping dotfile: ' + path);
        }else{
            callback(null);
        }
    };
    function checkMarkdownFile(path, callback){
        if(path.substring(path.length - 9) === '.markdown' || path.substring(path.length - 3) === '.md'){
            callback(null);
        }else{
            callback('Skipping non-markdown file: ' + path);
        }
    };
    function checkReadme(path, callback){
        if(path.toLowerCase().substring(0,6) === 'readme'){
            callback('Skipping readme file: ' + path);
        }else{
            callback(null);
        }
    };
    function checkIgnoreDir(path, conf, callback){
        if(conf.ignore){
            var ignoreDir = false;
            async.forEach(conf.ignore, function(dir, forCallback){
                if(path === dir){
                    ignoreDir = true;
                }
                forCallback(null);
            },
            function(err){
                if(ignoreDir){
                    callback('Ignoring directory: ' + path);
                }else{
                    callback(null);
                }
            });
        }else{
            callback(null);
        }
    };
    function checkAssetsDir(path, conf, callback){
        if(conf.assets && (path === conf.assets.path)){
            callback('Ignoring asset dir: ' + path);
        }else{
            callback(null);
        }
    };
        
    function getContent(path, conf, callback){
        conf.github.ghrepo.contents(path, function(err, data){
            if(err){
                callback(err);
            }else{
                if(data.type === 'file'){
                    var rawHeader = {Accept: 'application/vnd.github.beta.raw+json'};
                    if(conf.github.credentials){
                        var rawPath = 'https://' + conf.github.credentials.username + ':' + conf.github.credentials.password + '@api.github.com/repos/' + conf.github.repoName + '/contents/' + path;
                    }else{
                        var rawPath = 'https://api.github.com/repos/' + conf.github.repoName + '/contents/' + path;
                    }
                    var options = {
                        uri: rawPath,
                        headers: rawHeader
                    };
                    request(options, function(err2, rawContent, body){
                        if(err2){
                            callback(err2);
                        }else{
                            callback(null, rawContent);
                        }
                    });    
                }else{
                    callback('Not a file: ' + path);
                }
            }
        });
    }

    function parseContent(rawContent, callback){
        //regex to find yaml front matter
        var regex = /^\s*---[\s\S]+?---\s*/gi,
            idRegex = /(<h\d)(>)(.+?){#([\S\w]+?)}(<\/h\d>)/g,
            match = regex.exec(rawContent.body);
        if(match){
            var yamlString = match[0].replace(/---/g,'');
            var parsedObj = yaml.load(yamlString);
            parsedObj.body = converter.makeHtml(rawContent.body.replace(match[0], '')).replace(idRegex, "$1 id=" + '"' + "$4" + '"' + "$2$3$5");
            callback(null, parsedObj);
        }else{
            callback("Error parsing yaml front matter because of no match in file: ")
        }
    }

    function addExtraMetadata(parsedObj, path, callback){
        var pathArr = path.split('/'),
            cat = '';
        pathArr.pop();
        async.forEachSeries(pathArr, function(item, forCallback){
            cat += (item + '.');
            forCallback(null);
        },function(err){
            if(err){
                callback(err);
            }else{
                parsedObj.docid = path.replace(".markdown","").replace('.md','').replace(/\//g,'-');
                parsedObj.path = path.replace(".markdown","").replace('.md','').replace("/index","");
                parsedObj.category = cat.substring(0, cat.length-1);
                if(!parsedObj.weight){
                    parsedObj.weight = 0;
                }
                if(parsedObj.date){
                    var dateArr = parsedObj.date.split('/');
                    if(dateArr.length < 3){
                        dateArr = parsedObj.date.split('-');
                    }
                    parsedObj.month = dateArr[0];
                    parsedObj.year = dateArr[2];
                    parsedObj.slug = parsedObj.path.split('/').slice(-1);
                    parsedObj.excerpt = _s.stripTags(parsedObj.body);
                    parsedObj.img = imgRegex.exec(parsedObj.body)[0];
                }
                callback(null, parsedObj);
            }
        });
    }

    function getFinishedContentObj(path, conf, callback){
        getContent(path, conf, function(err, rawContent){
            if(err){
                callback('getContent error for path ' + path + ': ' + err);
            }else{
                parseContent(rawContent, function(err, parsedObj){
                    if(err){
                        callback('parseContent error for path ' + path + ': ' + err);
                    }else{
                        addExtraMetadata(parsedObj, path, function(err, finishedObj){
                            if(err){
                                callback('addExtraMetadata error for path ' + path + ': ' + err);
                            }else{
                                callback(null, finishedObj);
                            }
                        });
                    }
                });
            }
        });
    }

    return {
        parseDir: parseDir,
        getContent: getContent,
        parseContent: parseContent,
        addExtraMetadata: addExtraMetadata,
        getFinishedContentObj: getFinishedContentObj
    };
};
