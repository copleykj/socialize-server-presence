/* eslint-disable no-undef */
Package.describe({
    name: 'socialize:server-presence',
    summary: 'Scalable server presence',
    version: '0.1.3',
    git: 'https://github.com/copleykj/socialize-server-presence.git',
});

Package.onUse(function _(api) {
    api.versionsFrom('1.3');

    api.use(['ecmascript', 'mongo', 'underscore'], 'server');

    api.mainModule('server-presence.js', 'server');
});
