# Server Presence #

This packages keeps track of servers running your application and provides a way to run cleanup tasks when they die


## Installation ##

```shell
$ meteor add socialize:server-presence
```

## API ##

**`ServerPresence.serverId();`** - Get the current Id of the server.

```javascript
Meteor.publish(null, function(){
    if(this.userId && this._session){
        var id = UserSessions.insert({serverId:ServerPresence.serverId(), userId:this.userId, sessionId:this._session.id});

        this.onStop(function(){
            UserSessions.remove(id);
        });
    }
}, {is_auto:true});
```

**`ServerPresence.registerCleanupFunction(function)`** - registers a function to clean up data related to a particular server. If the server died cleanly the function will be passed the ID of the server and you should take action to clean up data just for this particular server. If the server died without cleaning up after itself and was the only server instance running the cleanup function will be called without a serverId parameter and depending on your app you may want to do a global cleanup.

```javascript
ServerPresence.onCleanup(function(serverId){
    if(serverId){
        UserSessions.remove({serverId:serverId});
    }else{
        UserSessions.remove({});
    }
});
```

## Supporting the Project ##
In the spirit of keeping this and all of the packages in the [Socialize](https://atmospherejs.com/socialize) set alive, I ask that if you find this package useful, please donate to it's development.

[Bitcoin](https://www.coinbase.com/checkouts/4a52f56a76e565c552b6ecf118461287) / [Patreon](https://www.patreon.com/user?u=4866588) / [Paypal](https://www.paypal.me/copleykj)
