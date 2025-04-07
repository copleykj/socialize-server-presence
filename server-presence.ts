import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

const Servers = new Mongo.Collection('presence:servers');

if (Servers.createIndexAsync) {
  try {
    await Servers.createIndexAsync({ lastPing: 1 }, { expireAfterSeconds: 10 });
    await Servers.createIndexAsync({ createdAt: -1 });
  } catch (e) {
    if (e instanceof Error) {
      throw new Meteor.Error('Failed to initialize indexes for socialize:server-presence:\n\n', e.message);
    }
  }
} else if (Servers.createIndex) {
  Servers.createIndex({ lastPing: 1 }, { expireAfterSeconds: 10 });
  Servers.createIndex({ createdAt: -1 });
} else {
  Servers._ensureIndex({ lastPing: 1 }, { expireAfterSeconds: 10 });
  Servers._ensureIndex({ createdAt: -1 });
}

let serverId: string | null = null;
let isWatcher = false;
let observeHandle: Meteor.LiveQueryHandle | null = null;
let exitGracefully = true;

const exitFunctions: Array<
  (serverId: string | null | undefined) => void | Promise<void>
  > = [];


const insert = async () => {
  const date = new Date();
  serverId = await Servers.insertAsync({ lastPing: date, createdAt: date });
};

const runCleanupFunctions = async (removedServerId?: string | null) => {
  const promises = exitFunctions.map((exitFunc) => {
    return exitFunc(removedServerId);
  });
  await Promise.all(promises);
};

const setAsWatcher = async () => {
  isWatcher = true;
  Servers.updateAsync({ _id: serverId }, { $set: { watcher: true } });
};

const updateWatcher = async () => {
  const server = await Servers.findOneAsync({}, { sort: { createdAt: -1 } });
  if (server && server._id === serverId) {
    await setAsWatcher();
  }
};

const observe = () => {
  observeHandle = Servers.find().observe({
    async removed(document) {
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
          await runCleanupFunctions(document._id);
        }
      } else if (document.watcher) {
        if (!document.graceful) {
          await runCleanupFunctions(document._id);
        }
        await updateWatcher();
      }
    },
  });
};

const checkForWatcher = async () => {
  const current = await Servers.findOneAsync({ watcher: true });
  if (current) {
    return true;
  }
  await setAsWatcher();
  return false;
};

const start = async () => {
  observe();

  Meteor.setInterval(async () => {
    if (serverId) {
      Servers.updateAsync(serverId, { $set: { lastPing: new Date() } });
    }
  }, 5000);

  await insert();

  // if there isn't any other instance watching and doing cleanup
  // then we need to do a full cleanup since this is likely the only instance
  if (!await checkForWatcher()) {
    runCleanupFunctions();
  }
};

const exit = async () => {
  // Call all of our externally supplied exit functions
  await runCleanupFunctions(serverId);
};

/*
*  We have to bind the meteor environment here since process event callbacks
*  run outside fibers
*/
const stop = Meteor.bindEnvironment(async () => {
  if (exitGracefully) {
    await Servers.updateAsync({ _id: serverId }, { $set: { graceful: true } });
    observeHandle?.stop();
    await exit();
  }
});


export const ServerPresence = {
  onCleanup: (cleanupFunction: (serverId: string | null | undefined) => void | Promise<void>) => {
    if (typeof cleanupFunction === 'function') {
      exitFunctions.push(cleanupFunction);
    } else {
      throw new Meteor.Error('Not A Function', 'ServerPresence.onCleanup requires function as parameter');
    }
  },
  serverId: () => serverId,
};

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
