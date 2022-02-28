import TIXStock from "./if.stock.tix" ;

export default class FourSigmaTIXStock extends TIXStock {
	constructor (ns, ticker) {
		super();
		this.ns = ns;
		this._ticker = ticker;
		this.history = [];
		this.cycleTick = 0;
		this.currentTick = 0;
	}

	get forecast() { return this.ns.stock.getForecast(this.ticker)}
	get volatility() { return this.ns.stock.getVolatility(this.ticker)}
	get expected_value() { return this.forecast * this.volatility }

	calcForecast(history=this.history) {
		return this.forecast
	}

	get std_dev() { return 0 }
	get hasInverted() { return ((this.lastForecast < .5 && this.forecast >= .5) || (this.lastForecast >= .5 && this.forecast < .5)) }

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
