/* global Package */
Package.describe({
  name: 'socialize:server-presence',
  summary: 'Scalable server presence',
  version: '1.0.5',
  git: 'https://github.com/copleykj/socialize-server-presence.git',
});

Package.onUse(function _(api) {
  api.versionsFrom(['3.0']);

  api.use(['ecmascript', 'typescript', 'mongo'], 'server');
  api.use(['zodern:types']);

  api.mainModule('server-presence.ts', 'server');
});
