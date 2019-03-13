var fp = require('find-free-port');

export const findPort = (range = 3000) =>
  new Promise<number>((yay, nay) =>
    fp(range, range + 1000, function(err: any, freePort: number) {
      if (err) {
        return nay(err);
      } else {
        return yay(freePort);
      }
    })
  );
