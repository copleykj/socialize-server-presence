# Server Presence

This packages keeps track of servers running your application and provides a way to run cleanup tasks when they die

<!-- TOC depthFrom:1 depthTo:6 withLinks:1 updateOnSave:1 orderedList:0 -->
- [Supporting The Project](#supporting-the-project)
- [Installation](#installation)
- [API](#api)
<!-- /TOC -->

## Supporting The Project

Finding the time to maintain FOSS projects can be quite difficult. I am myself responsible for over 30 personal projects across 2 platforms, as well as Multiple others maintained by the [Meteor Community Packages](https://github.com/meteor-community-packages) organization. Therfore, if you appreciate my work, I ask that you either sponsor my work through GitHub, or donate via Paypal or Patreon. Every dollar helps give cause for spending my free time fielding issues, feature requests, pull requests and releasing updates. Info can be found in the "Sponsor this project" section of the [GitHub Repo](https://github.com/copleykj/socialize-server-presence)

## Installation

```shell
meteor add socialize:server-presence
```

## API

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
