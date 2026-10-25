import { merge } from '../merge';
import cards from './cards';
import developer from './developer';
import pachinko from './pachinko';
import room from './room';
import roulette from './roulette';
import scratch from './scratch';
import slot from './slot';
import wheel from './wheel';

export default merge(room, wheel, slot, roulette, pachinko, scratch, cards, developer);
