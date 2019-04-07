import { LocalAdapter } from '../adapter';
import { createTests } from './adapter.test';

createTests('local', broker => new LocalAdapter(broker));
