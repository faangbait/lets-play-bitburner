import HackableBaseServer from "./if.server.hackable";

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

export default class HWGWBaseServer extends HackableBaseServer {
    constructor(ns, id) {
        super();
        this.ns = ns;
        this._id = id;
    }
    get isHWGWReady() { return (this.money.available == this.money.max && this.security.level == this.security.min) }
    get perfect_batch() {
        const home = new HackableBaseServer(ns, "home")
        const hackThreads = Math.floor(this.ns.hackAnalyzeThreads(this.id, this.money.max * this.calculate_hack_percent()));
        const growThreads = this.numCycleForGrowthCorrected(this.ns.getServer(this.id), this.money.max, this.money.max * (1 - this.calculate_hack_percent()) , this.ns.getPlayer(), home.cores);
        
        return {
            hk: hackThreads,
            gr: growThreads,
            wk1: Math.ceil(hackThreads / 25),
            wk2: Math.ceil(growThreads / 12.5),
        }
    }

    calculate_hack_percent() {
        return 0.1;
    }

    get hwgw_value() {
        // calculate $ per threadSecond
        let dollars = this.calculate_hack_percent() * this.money.max;
        let ram = this.perfect_batch.hk * 1.75 + this.perfect_batch.gr * 1.8 + this.perfect_batch.wk1 * 1.8 + this.perfect_batch.wk2 * 1.8;
        let seconds = this.ns.getHackTime(this.id) * 4.0
        return dollars / (ram * seconds)
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
