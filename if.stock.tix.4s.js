import TIXStock from "./if.stock.tix" ;

export default class FourSigmaTIXStock extends TIXStock {
	constructor (ns, ticker) {
		super();
		this.ns = ns;
		this._ticker = ticker;
	}

	get forecast() { return this.ns.stock.getForecast(this.ticker)}
	get volatility() { return this.ns.stock.getVolatility(this.ticker)}

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
				await this.ns.asleep(6000); // base server update rate is 60s. we'll call faster updates when we need them.
			}

		} while (repeat)
	}
}
