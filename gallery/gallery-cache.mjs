import {parentPort} from 'node:worker_threads';
import {gallery} from './server.mjs';
parentPort.postMessage(JSON.stringify(gallery()));
