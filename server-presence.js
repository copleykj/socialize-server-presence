var Servers = new Mongo.Collection("presence:servers");

Servers._ensureIndex({"lastPing": 1 }, { expireAfterSeconds: 10 });
Servers._ensureIndex({createdAt:-1});

var serverId = null;
var isWatcher = false;
var observeHandle = null;
var intervalHandle = null;
var exitFunctions = [];

ServerPresence = {};

var insert = function() {
    var date = new Date();
    serverId = Servers.insert({lastPing:date, createdAt:date});
};

var start = function () {
    observe();
    intervalHandle = Meteor.setInterval(function() {
        Servers.update(serverId, {$set:{lastPing:new Date()}});
    }, 5000);
    insert();

    //if there isn't any other instance watching and doing cleanup
    //then we need to do a full cleanup since this is likely the only instance
    if(!checkForWatcher()){
        runCleanupFunctions();
    }
};


/*
*  We have to bind the meteor environment here since process event callbacks
*  run outside fibers
*/
var stop = Meteor.bindEnvironment(function () {
    Servers.update({_id:serverId}, {$set:{graceful:true}});
    observeHandle.stop();
    exit();
});

var exit = function () {
    //Call all of our externally supplied exit functions
    runCleanupFunctions(serverId);

    //Exit application gracefully since we've caught SIGINT, SIGTERM and SIGHUP
    process.exit();

};

var runCleanupFunctions = function(serverId) {
    _.each(exitFunctions, function(exitFunc){
        exitFunc(serverId);
    });
};

var checkForWatcher = function() {
    var current = Servers.findOne({watcher:true});
    if(!current){
        setAsWatcher();
    }else{
        return true;
    }
};

var updateWatcher = function() {
    var server = Servers.findOne({}, {sort:{createdAt:-1}});
    if(server._id === serverId){
        setAsWatcher();
    }
};

var setAsWatcher = function() {
    isWatcher = true;
    Servers.update({_id:serverId}, {$set:{watcher:true}});
};

var observe = function(){
    var self = this;
    observeHandle = Servers.find().observe({
        removed: function(document){
            if(document._id === serverId){
                if(!isWatcher){
                    throw new Meteor.Error("Server Presence Timeout", "The server-presence package has detected inconsistent presence state. To avoid inconsistent database state your application is exiting.");
                    process.exit();
                }else{
                    insert();
                }
            }else if(isWatcher){
                if(!document.graceful){
                    runCleanupFunctions(document._id);
                }
            }else if(document.watcher){
                updateWatcher();
            }
        }
    });
};

ServerPresence.onCleanup = function(cleanupFunction){
    if(_.isFunction(cleanupFunction)){
        exitFunctions.push(cleanupFunction);
    }else{
        throw new Meteor.Error("Not A Function", "ServerPresence.onCleanup requires function as parameter");
    }
};

ServerPresence.serverId = function() {
    return serverId;
};

Meteor.startup(function () {
    start();
});

/*
*  Here we are catching signals due to the fact that node (Maybe it's a Meteor issue?) doesn't
*  seem to run the exit callbacks except for SIGHUP. Being that SIGTERM is the standard POSIX
*  signal sent when a system shuts down, it doesn't make much sense to only run out cleanup on
*  HUP signals.
*/
process.on("SIGTERM", stop);

process.on("SIGINT", stop);

process.on("SIGHUP", stop);
