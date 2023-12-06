/* eslint-disable import/no-unresolved */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
/* eslint-enable import/no-unresolved */

const Servers = new Mongo.Collection('presence:servers');

if (Servers.createIndexAsync) {
  try {
    Servers.createIndexAsync({ lastPing: 1 }, { expireAfterSeconds: 10 });
    Servers.createIndexAsync({ createdAt: -1 });
  } catch (e) {
    throw new Meteor.Error('Failed to initialize indexes');
  }
} else if (Servers.createIndex) {
  Servers.createIndex({ lastPing: 1 }, { expireAfterSeconds: 10 });
  Servers.createIndex({ createdAt: -1 });
} else {
  Servers._ensureIndex({ lastPing: 1 }, { expireAfterSeconds: 10 });
  Servers._ensureIndex({ createdAt: -1 });
}

let serverId = null;
let isWatcher = false;
let observeHandle = null;
let exitGracefully = true;

const exitFunctions = [];

/* eslint-disable import/prefer-default-export */
export const ServerPresence = {};

const insert = () => {
    const date = new Date();
    serverId = Servers.insert({ lastPing: date, createdAt: date });
};

const runCleanupFunctions = (removedServerId) => {
    exitFunctions.forEach((exitFunc) => {
        exitFunc(removedServerId);
    });
};

const setAsWatcher = () => {
    isWatcher = true;
    Servers.update({ _id: serverId }, { $set: { watcher: true } });
};

const updateWatcher = () => {
    const server = Servers.findOne({}, { sort: { createdAt: -1 } });
    if (server._id === serverId) {
        setAsWatcher();
    }
};

const observe = () => {
    observeHandle = Servers.find().observe({
        removed(document) {
            if (document._id === serverId) {
                if (!isWatcher) {
                    Meteor._debug('Server Presence Timeout', 'The server-presence package has detected inconsistent presence state. To avoid inconsistent database state your application is exiting.');
                    exitGracefully = false;
                    process.kill(process.pid, 'SIGHUP');
                } else {
                    insert();
                }
            } else if (isWatcher) {
                if (!document.graceful) {
                    runCleanupFunctions(document._id);
                }
            } else if (document.watcher) {
                if (!document.graceful) {
                    runCleanupFunctions(document._id);
                }
                updateWatcher();
            }
        },
    });
};

const checkForWatcher = () => {
    const current = Servers.findOne({ watcher: true });
    if (current) {
        return true;
    }
    setAsWatcher();
    return false;
};

const start = () => {
    observe();

    Meteor.setInterval(function serverTick() {
        Servers.update(serverId, { $set: { lastPing: new Date() } });
        return true;
    }, 5000);

    insert();

    // if there isn't any other instance watching and doing cleanup
    // then we need to do a full cleanup since this is likely the only instance
    if (!checkForWatcher()) {
        runCleanupFunctions();
    }
};

const exit = () => {
    // Call all of our externally supplied exit functions
    runCleanupFunctions(serverId);
};

/*
*  We have to bind the meteor environment here since process event callbacks
*  run outside fibers
*/
const stop = Meteor.bindEnvironment(function boundEnvironment() {
    if (exitGracefully) {
        Servers.update({ _id: serverId }, { $set: { graceful: true } });
        observeHandle.stop();
        exit();
    }
});


ServerPresence.onCleanup = (cleanupFunction) => {
    if (typeof cleanupFunction === 'function') {
        exitFunctions.push(cleanupFunction);
    } else {
        throw new Meteor.Error('Not A Function', 'ServerPresence.onCleanup requires function as parameter');
    }
};

ServerPresence.serverId = () => serverId;

Meteor.startup(() => {
    start();
});

/*
*  Here we are catching signals due to the fact that node (Maybe it's a Meteor issue?) doesn't
*  seem to run the exit callbacks except for SIGHUP. Being that SIGTERM is the standard POSIX
*  signal sent when a system shuts down, it doesn't make much sense to only run out cleanup on
*  HUP signals.
*/

['SIGINT', 'SIGHUP', 'SIGTERM'].forEach((sig) => {
  process.once(sig, () => {
    stop();
    process.kill(process.pid, sig);
  });
});
