import BaseServer from "./if.server"

const CONSTANTS = {
	ServerBaseGrowthRate:  1.03,
	ServerMaxGrowthRate: 1.0035
}

const BitNodeMultipliers = {
	ServerGrowthRate: 1
}
export function numCycleForGrowthTransition(server, growth, p, cores = 1) {
  return numCycleForGrowthCorrected(server, server.moneyAvailable * growth, server.moneyAvailable, p, cores);
}

export function numCycleForGrowthCorrected(server, targetMoney, startMoney, p, cores = 1) {
	if (startMoney < 0) { startMoney = 0; } // servers "can't" have less than 0 dollars on them
	if (targetMoney > server.moneyMax) { targetMoney = server.moneyMax; } // can't grow a server to more than its moneyMax
	if (targetMoney <= startMoney) { return 0; } // no growth --> no threads

	// exponential base adjusted by security
	const adjGrowthRate = (1 + (CONSTANTS.ServerBaseGrowthRate - 1) / server.hackDifficulty);
	const exponentialBase = Math.min(adjGrowthRate, CONSTANTS.ServerMaxGrowthRate); // cap growth rate

	// total of all grow thread multipliers
	const serverGrowthPercentage = server.serverGrowth / 100.0;
	const coreMultiplier = 1 + ((cores - 1) / 16);
	const threadMultiplier = serverGrowthPercentage * p.hacking_grow_mult * coreMultiplier * BitNodeMultipliers.ServerGrowthRate;

	const x = threadMultiplier * Math.log(exponentialBase);
	const y = startMoney * x + Math.log(targetMoney * x);
	/* Code for the approximation of lambert's W function is adapted from
	 * https://git.savannah.gnu.org/cgit/gsl.git/tree/specfunc/lambert.c
	 * using the articles [1] https://doi.org/10.1007/BF02124750 (algorithm above)
	 * and [2] https://doi.org/10.1145/361952.361970 (initial approximation when x < 2.5)
	 */
	let w;
	if (y < Math.log(2.5)) {
		/* exp(y) can be safely computed without overflow.
		 * The relative error on the result is better when exp(y) < 2.5
		 * using Padé rational fraction approximation [2](5)
		 */
		const ey = Math.exp(y);
		w = (ey + 4/3 * ey*ey) / (1 + 7/3 * ey + 5/6 * ey*ey);
	} else {
		/* obtain initial approximation from rough asymptotic [1](4.18)
		 * w = y [- log y when 0 <= y]
		 */
		w = y;
		if (y > 0) w -= Math.log(y);
	}
	let cycles = w/x - startMoney;

	const bt = exponentialBase**threadMultiplier;
	let corr = Infinity;
	// Two sided error because we do not want to get stuck if the error stays on the wrong side
	do {
		// c should be above 0 so Halley's method can't be used, we have to stick to Newton-Raphson
		const bct = bt**cycles;
		const opc = startMoney + cycles;
		const diff = opc * bct - targetMoney;
		corr = diff / (opc * x + 1.0) / bct
		cycles -= corr;
	} while (Math.abs(corr) >= 1)
	/* c is now within +/- 1 of the exact result.
	 * We want the ceiling of the exact result, so the floor if the approximation is above,
	 * the ceiling if the approximation is in the same unit as the exact result,
	 * and the ceiling + 1 if the approximation is below.
	 */
	const fca = Math.floor(cycles);
	if (targetMoney <= (startMoney + fca)*Math.pow(exponentialBase, fca*threadMultiplier)) {
		return fca;
	}
	const cca = Math.ceil(cycles);
	if (targetMoney <= (startMoney + cca)*Math.pow(exponentialBase, cca*threadMultiplier)) {
		return cca;
	}
	return cca + 1;
}

/**
 * This function calculates the number of threads needed to grow a server based on a pre-hack money and hackAmt
 * (ie, if you're hacking a server with $1e6 moneyAvail for 60%, this function will tell you how many threads to regrow it
 * A good replacement for the current ns.growthAnalyze if you want players to have more control/responsibility
 * @param server - Server being grown
 * @param hackProp - the proportion of money hacked (total, not per thread, like 0.60 for hacking 60% of available money)
 * @param prehackMoney - how much money the server had before being hacked (like 200000 for hacking a server that had $200000 on it at time of hacking)
 * @param p - Reference to Player object
 * @returns Number of "growth cycles" needed to reverse the described hack
 */
export function numCycleForGrowthByHackAmt(server, hackProp, prehackMoney, p, cores = 1) {
	if (prehackMoney > server.moneyMax) prehackMoney = server.moneyMax;
	const posthackMoney = Math.floor(prehackMoney * Math.min(1, Math.max(0, (1 - hackProp))));
	return numCycleForGrowthCorrected(server, prehackMoney, posthackMoney, p, cores);
}

/**
 * This function calculates the number of threads needed to grow a server based on an expected growth multiplier assuming it will max out
 * (ie, if you expect to grow a server by 60% to reach maxMoney, this function will tell you how many threads to grow it)
 * PROBABLY the best replacement for the current ns.growthAnalyze to maintain existing scripts
 * @param server - Server being grown
 * @param growth - How much the server is being grown by, as a multiple in DECIMAL form (e.g. 1.5 rather than 50). Infinity is acceptable.
 * @param p - Reference to Player object
 * @returns Number of "growth cycles" needed
 */
export function numCycleForGrowthByMultiplier(server, growth, p, cores = 1) {
	if (growth < 1.0) growth = 1.0;
	const targetMoney = server.moneyMax;
	const startingMoney = server.moneyMax / growth;
	return numCycleForGrowthCorrected(server, targetMoney, startingMoney, p, cores);
}

export default class HackableBaseServer extends BaseServer {
	constructor(ns, hostname) {
		super();
		this.ns = ns;
		this._id = hostname
	}

    get isTarget() { return (!this.purchased && !this.isHome && (this.money.max > 0) && (this.ports.open >= this.ports.required) && this.admin && (this.level <= this.ns.getPlayer().hacking))}
    get isAttacker() { return ( this.purchased || this.isHome || (this.ram.max > 0 && this.admin))}
	get isHWGWReady() { return (this.money.available == this.money.max && this.security.level == this.security.min)}
    get pids() { return this.ns.ps(this.id) }
    get targeting_pids() { 
        const dpList = (ns, current="home", set=new Set()) => {
            let connections = ns.scan(current);
            let next = connections.filter(c => !set.has(c));
            next.forEach(n => {
                set.add(n);
                return dpList(ns, n, set);
            });
            return Array.from(set.keys());
        };

        let pids = [];
        for (let server of dpList(this.ns)) {
            const ps = this.ns.ps(server);
            for (let process of ps) {
                if (process.args.length > 0) {
                    if (process.args[0] === this.id) {
                        pids.push(process);
                    }
                }
            }
        }
        return pids;
    }

	sudo = () => {
		try {
			ns.brutessh(this.id)
			ns.ftpcrack(this.id)
			ns.relaysmtp(this.id)
			ns.httpworm(this.id)
			ns.sqlinject(this.id)
		} catch {}
				
		try {
			ns.nuke(this.id)
		} catch {}
	}

    async updateCache(repeat=true, kv=new Map()) {
        do {
        
            let getters = this.listGetters(this)
            for (let o of Object.keys(getters)) {
                if (!kv.has(getters[o])) {
                    kv.set(getters[o], this[getters[o]])
                }
            }

            await super.updateCache(false, kv)
            if (repeat) {
                await this.ns.asleep((Math.random() * 10000) + 55000); // base server update rate is 60s. we'll call faster updates when we need them.
            }

        } while (repeat)
    }
}
