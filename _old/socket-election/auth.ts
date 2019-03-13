/**
 * Adds connection listeners to the given socket.io server, so clients
 * are forced to authenticate before they can receive events.
 *
 * @param {Object} io - the socket.io server socket
 *
 * @param {Object} config - configuration values
 * @param {Function} config.authenticate - indicates if authentication was successfull
 * @param {Function} config.postAuthenticate=noop -  called after the client is authenticated
 * @param {Function} config.disconnect=noop -  called after the client is disconnected
 * @param {Number} [config.timeout=1000] - amount of millisenconds to wait for a client to
 * authenticate before disconnecting it. A value of 'none' means no connection timeout.
 */
const noop = () => {};
export function socketIOAuth(io: any, config: any) {
  config = config || {};
  var timeout = config.timeout || 1000;
  var postAuthenticate = config.postAuthenticate || noop;
  var disconnect = config.disconnect || noop;
  const namespaces = Object.keys(io.nsps).reduce(
    (arr, key) => [...arr, io.nsps[key]] as any,
    []
  );

  namespaces.forEach(forbidConnections);
  io.on('connection', function(socket: any) {
    socket.auth = false;
    socket.on('authentication', function(data: any) {
      config.authenticate(socket, data, function(err: any, success: any) {
        if (success) {
          console.log('Authenticated socket %s', socket.id);
          socket.auth = true;

          namespaces.forEach(function(nsp: any) {
            restoreConnection(nsp, socket);
          });

          socket.emit('authenticated', success);
          return postAuthenticate(socket, data);
        } else if (err) {
          console.log(
            'Authentication error socket %s: %s',
            socket.id,
            err.message
          );
          socket.emit('unauthorized', { message: err.message }, function() {
            socket.disconnect();
          });
        } else {
          console.log('Authentication failure socket %s', socket.id);
          socket.emit(
            'unauthorized',
            { message: 'Authentication failure' },
            function() {
              socket.disconnect();
            }
          );
        }
      });
    });

    socket.on('disconnect', function() {
      return disconnect(socket);
    });

    if (timeout !== 'none') {
      setTimeout(function() {
        // If the socket didn't authenticate after connection, disconnect it
        if (!socket.auth) {
          console.log('Disconnecting socket %s', socket.id);
          socket.disconnect('unauthorized');
        }
      }, timeout);
    }
  });
}

/**
 * Set a listener so connections from unauthenticated sockets are not
 * considered when emitting to the namespace. The connections will be
 * restored after authentication succeeds.
 */
function forbidConnections(nsp: any) {
  nsp.on('connect', function(socket: any) {
    if (!socket.auth) {
      console.log('removing socket from %s', nsp.name);
      delete nsp.connected[socket.id];
    }
  });
}

/**
 * If the socket attempted a connection before authentication, restore it.
 */
function restoreConnection(nsp: any, socket: any) {
  if (nsp.sockets[socket.id]) {
    console.log('restoring socket to %s', nsp.name);
    nsp.connected[socket.id] = socket;
  }
}
