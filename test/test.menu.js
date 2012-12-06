var async = require('async')
// lib to test
  , menu = require('../lib/menu')()
// test data
  , menuArr = []
  , conf = {}
  ;

exports['test menu.indexMenu'] = {
    'blog and assets dirs': function(test){
        /*
        menu.indexMenu(conf, function(err){
        });
        */
        test.done();
    }
};

exports['test menu.buildMenu'] = {
    setUp: function(callback){
        var data = [ { path: 'something.md', type: 'file' }
                   , { path: 'something-else.md', type: 'file' }
                   , { path: 'fakeDir', type: 'dir' }
                   , { path: 'blog', type: 'dir' }
                   ]
          , data2 = [ { path: 'fakeDir/other.md', type: 'file' }
                    , { path: 'fakeDir/other2.md', type: 'file' }
                    ]
          , blogData = [ { path: 'should/not.md', type: 'file' }
                       ]
          , fakeContent = {
                getFinishedContentObj: function(path, conf, callback){
                    callback(null, { path: path, title: path, weight: path });
                }
            }
          ;
        menu = require('../lib/menu')(fakeContent);
        conf = { 
            github: {
                ghrepo: {
                    contents: function(path, callback){
                        if(path==='fakeDir'){
                            callback(null, data2);
                        }else{
                            callback(null, data);
                        }
                    }
                }
            }
            , blog: { path: 'blog' }
            , assets: { path: 'assets' }
        };
        menuArr = [];
        callback(null);
    }
  , 'blog and assets dirs': function(test){
        menu.buildMenu('root', conf, menuArr, function(err, menuArray){
            test.equal(menuArray[0].path,   'something.md');
            test.equal(menuArray[0].weight, 'something.md');
            test.equal(menuArray[0].title,  'something.md');
            test.equal(menuArray[1].path,   'something-else.md');
            test.equal(menuArray[1].weight, 'something-else.md');
            test.equal(menuArray[1].title,  'something-else.md');
            test.equal(menuArray[2].path,   'fakeDir.markdown');
            test.equal(menuArray[2].weight, 'fakeDir/index.markdown');
            test.equal(menuArray[2].title,  'fakeDir/index.markdown');
            test.equal(menuArray[2].children[0].path,   'fakeDir/other.md');
            test.equal(menuArray[2].children[0].weight, 'fakeDir/other.md');
            test.equal(menuArray[2].children[0].title,  'fakeDir/other.md');
            test.equal(menuArray.length, 3);
            test.equal(menuArray[2].children.length, 2);
            test.done();
        });
    }
};

exports['test menu.sortMenu'] = {
    setUp: function(callback){
        menuArr = [ { weight: 9 }
                  , { weight: 8 }
                  , { weight: 7 }
                  , { weight: 10
                    , children: [ { weight: 6 }
                                , { weight: 5 }
                                , { weight: 4 }
                                ]
                    }
                  , { weight: 6 }
                  , { weight: 5 }
                  ];
        callback(null);
    }
  , 'with recursion': function(test){
        menu.sortMenu(menuArr, function(err, menuArr){
            test.equal(menuArr[0].weight, 5);
            test.equal(menuArr[1].weight, 6);
            test.equal(menuArr[2].weight, 7);
            test.equal(menuArr[3].weight, 8);
            test.equal(menuArr[4].weight, 9);
            test.equal(menuArr[5].weight, 10);
            test.equal(menuArr[5].children[0].weight, 4);
            test.equal(menuArr[5].children[1].weight, 5);
            test.equal(menuArr[5].children[2].weight, 6);
            test.done();
        });
    }
};

exports['test menu.saveMenu'] = {
    'no errors, menu object exists in db': function(test){
        var menuObj = {
            save: function(callback){
                saved = menuObj.menuArray;
                callback(null);
            }
          , menuArray: []
          , saved: []
        };
        conf = { 
            Menu: {
                findOne: function(obj, callback){
                    callback(null, menuObj); 
                }
            }
        };
        menuArr = ['a', 1, 'f'];
        menu.saveMenu(menuArr, conf, function(err){
            test.equal(saved[0], 'a');
            test.equal(saved[1], 1);
            test.equal(saved[2], 'f');
            test.done();
        });
    }
  , 'no errors, no menu object in db': function(test){
        var menuObj = {
            save: function(callback){
                saved = menuObj.menuArray;
                callback(null);
            }
          , menuArray: []
          , saved: []
        };
        conf = { 
            Menu: function(obj){
                this.save = function(callback){
                    saved = obj.menuArray;
                    callback(null);
                };
                return {
                    save: this.save
                };
            }
        };
        conf.Menu.findOne = function(obj, callback){
            callback(null, null);
        };
        menuArr = ['b', 2, 'g'];
        menu.saveMenu(menuArr, conf, function(err){
            test.equal(saved[0], 'b');
            test.equal(saved[1], 2);
            test.equal(saved[2], 'g');
            test.done();
        });
    }
};
