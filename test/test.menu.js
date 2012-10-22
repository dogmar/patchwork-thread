// Library to test
var menu = require('../lib/menu'),
    async = require('async');

exports['test sortMenu'] = function (test) {
    // test data
    var menuArr = [
        {weight: 5},
        {weight: 9},
        {weight: 22},
        {weight: 2},
        {weight: 1},
        {weight: 0}
    ];
    menu.sortMenu(menuArr, function(err, sortedMenu){
        test.expect(menuArr.length - 1);
        var count = 0;
        async.whilst(
            function(){return count < menuArr.length - 1;},
            function(callback){
                test.ok(sortedMenu[count].weight < sortedMenu[++count].weight);
                callback();
            },
            function (err) {
                if(err){
                    console.log(err);
                }
                test.done();
            }
        );
    });
}
