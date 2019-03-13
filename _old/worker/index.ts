var Worker = require('tiny-worker');
var worker = new Worker(function() {
  self.onmessage = function(ev) {
    postMessage(ev.data);
  };
});

worker.onmessage = function(ev) {
  console.log(ev.data);
  worker.terminate();
};

worker.postMessage('Hello World!');
