import BaseStock from "./if.stock" ;

export default class TIXStock extends BaseStock {
	constructor (ns, ticker) {
		super();
		this.ns = ns;
		this._ticker = ticker;
	}

	get maxShares() { return this.ns.stock.getMaxShares(this.ticker); }
	
	get price() { 
		return {
			bull: this.ns.stock.getAskPrice(this.ticker),
			bear: this.ns.stock.getBidPrice(this.ticker)
		}
	}
	
	get position() { 
		let pos = this.ns.stock.getPosition(this.ticker);
		return {
			bull: pos[0],
			bullPrice: pos[1],
			bear: pos[2],
			bearPrice: pos[3],
			value: pos[0] * this.price.bull + (pos[2] * this.price.bear - (pos[2] * this.price.bear - pos[2] * this.price.bull))
		}
	}
	
	_golong(shares) {
		return this.ns.stock.buy(this.ticker, shares) * shares
	}

	max_long() { 
		let shares = (this.ns.getServerMoneyAvailable("home") - 100000) / this.price.bull
		shares = Math.floor(Math.min(shares, this.maxShares - this.position.bull))
		if (shares * this.price.bull > 2000000) {
			return this._golong(shares)
		}
	}
	
	longCost(shares) { return (shares * this.price.bull) + 100000 }
	
	unbuy(shares=this.position.bull) {
		return this.ns.stock.sell(this.ticker, shares);
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
			await this.ns.asleep(6000); // base server update rate is 60s. we'll call faster updates when we need them.
		}

	} while (repeat)
	}
}
