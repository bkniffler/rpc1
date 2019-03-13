import * as EventEmitter from 'events';
import * as dgram from 'dgram';
import * as Bonjour from 'bonjour';
import { findPort } from '../../socket/utils';

const bonjour = Bonjour();
const refreshInterval = 2500;

const heartbeatRequest: string = 'PING';
const heartbeatResponse: string = 'PONG';

const getAddresses = (service: any) =>
  service
    ? service.addresses.filter((x: string) => x.split('.').length === 4)
    : [];

interface ILeader {
  ipV4: string[];
  txt: any;
  name: string;
}
type ICheckLeaderValidity = (leader: ILeader) => boolean | Promise<boolean>;
export class Elector extends EventEmitter {
  private type: string;
  private host: string;
  private txt: any;
  private forceFollow = false;
  private checkLeaderValidity: ICheckLeaderValidity;
  private maxFailedResponses: number = 3;

  constructor(
    type: string,
    txt = {},
    forceFollow = false,
    checkLeaderValidity?: ICheckLeaderValidity,
    maxFailedResponses: number = 3
  ) {
    super();
    this.forceFollow = forceFollow;
    this.type = type;
    this.txt = txt;
    this.host = '0.0.0.0';
    this.checkLeaderValidity =
      checkLeaderValidity || (() => Promise.resolve(true));
    this.maxFailedResponses = maxFailedResponses;
  }

  public async start() {
    return this.elect().catch(error => console.log('error', error));
  }

  private _stop = false;
  public stop() {
    return new Promise(yay => {
      this._stop = true;
      if (this.interval) {
        clearInterval(this.interval);
      }
      const monitor = this.monitor;
      if (monitor) {
        monitor['bonjour'].stop(() => {
          monitor.close(yay);
          this.monitor = undefined;
        });
      } else {
        return yay();
      }
    });
  }

  private async elect(): Promise<void> {
    if (this._stop) {
      return;
    }
    try {
      const leader = await this.detect();
      if (this.forceFollow && !leader) {
        return this.elect();
      } else if (leader) {
        return this.follow(leader);
      } else {
        return this.lead();
      }
    } catch (err) {
      if (this._stop) {
        return;
      }
      return Promise.reject(err);
    }
  }

  private async detect(name?: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let leader: any = undefined;
      const watcher = bonjour.find(
        { type: this.type, protocol: 'udp' },
        async service => {
          if (
            service.name !== name &&
            !leader &&
            (await this.checkLeaderValidity({
              ipV4: getAddresses(service),
              txt: service.txt || {},
              name: service.name
            }))
          ) {
            leader = service;
            after();
          }
        }
      );

      watcher.start();

      const after = () => {
        clearTimeout(timeout);
        watcher.stop();
        if (this._stop) {
          return reject('Service stopped');
        }
        resolve(leader);
      };

      let timeout = setTimeout(
        after,
        Math.floor(Math.random() * 10000) + refreshInterval
      );
    });
  }

  private monitor: dgram.Socket | undefined = undefined;
  private async lead() {
    if (this._stop) {
      return;
    }
    try {
      const port = await findPort(12121);
      const name = `${this.type}-${Math.random()
        .toString(26)
        .slice(5)}`;
      // Publish election over bonjour
      console.log('Publish', name, this.type);
      const service = bonjour.publish({
        name,
        type: this.type,
        txt: this.txt,
        port,
        protocol: 'udp'
      });

      // Listen for heartbeat requests from followers
      this.monitor = dgram.createSocket('udp4');
      this.monitor.on('message', (message, remote) => {
        if (!this.monitor) {
          return;
        }
        this.monitor.send(
          heartbeatResponse,
          0,
          heartbeatResponse.length,
          remote.port,
          remote.address
        );
      });
      this.monitor.bind(port, this.host);
      this.monitor['bonjour'] = service;
    } catch (error) {
      // console.log('ERROR', error);
      this.emit(
        'error',
        new Error(
          'Failed to register this instance as leader, restarting election proces'
        )
      );
      this.emit('reelection');
      this.elect().catch(() => {});
      return;
    }

    // Tell the consumer that we are a leader;
    this.emit('leader');
  }

  private interval: any = undefined;
  private follow(leader: any) {
    if (this._stop) {
      return;
    }
    let numOfFailedResponses = 0;
    // Heartbeat Ping of the leader to see if re-election is required
    this.interval = setInterval(() => {
      try {
        if (numOfFailedResponses >= this.maxFailedResponses) {
          clearInterval(this.interval);
          this.emit('reelection');
          return this.elect().catch(() => {});
        }

        const client = dgram.createSocket('udp4');
        client.on('error', err => {
          this.emit('error', err);
        });
        client.on('message', (message, remote) => {
          if (message.toString() === heartbeatResponse) {
            numOfFailedResponses--;
          }
          client.close();
        });

        numOfFailedResponses++;
        client.send(
          heartbeatRequest,
          0,
          heartbeatRequest.length,
          leader.port,
          getAddresses(leader)[0],
          (err, bytes) => {
            if (err) this.emit('error', err);
          }
        );
      } catch (error) {
        numOfFailedResponses++;
      }
    }, refreshInterval);

    // Tell the consumer that we are a follower;
    this.emit('follower', {
      ipV4: getAddresses(leader),
      txt: leader.txt || {},
      name: leader.name
    });
  }
}

export function elect(
  type: string,
  {
    txt,
    forceFollow,
    maxFailedResponses,
    checkLeaderValidity
  }: ElectorOptions = {} as any
) {
  return new Elector(
    type,
    txt,
    forceFollow,
    checkLeaderValidity,
    maxFailedResponses
  );
}

export interface ElectorOptions {
  txt?: any;
  checkLeaderValidity?: ICheckLeaderValidity;
  forceFollow?: boolean;
  maxFailedResponses?: number;
}
