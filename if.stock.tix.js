import BaseStock from "./if.stock" ;

const stock_list = ["ECP", "MGCP", "BLD", "CLRK", "OMTK", "FSIG", "KGI", "FLCM", "STM", "DCOMM", "HLS", "VITA", "ICRS", "UNV", "AERO", "OMN", "SLRS", "GPH", "NVMD", "WDS", "LXO", "RHOC", "APHE", "SYSC", "CTK", "NTLK", "OMGA", "FNS", "JGN", "SGC", "CTYS", "MDYN", "TITN"]
const cycleLength = 75;
const lowerBoundHistoryLength = 21;
const upperBoundHistoryLength = 151;
const nearTermWindowLength = 10;
const longTermWindowLength = 76;
const inversionDetectionTolerance = 0.10;

export function getAllTIXStocks(ns) {
	let stocks = [];
	for (let s of stock_list) {
		stocks.push(new TIXStock(ns, s));
	}
	return stocks;
}

export default class TIXStock extends BaseStock {
	constructor (ns, ticker) {
		super();
		this.ns = ns;
		this._ticker = ticker;
		this.history = [];
		this.cycleTick = 0;
		this.currentTick = 0;
	}

	get maxShares() { return this.ns.stock.getMaxShares(this.ticker); }
	
	get price() { 
		return {
			bull: this.ns.stock.getAskPrice(this.ticker),
			bear: this.ns.stock.getBidPrice(this.ticker),
			avg: (this.ns.stock.getAskPrice(this.ticker) + this.ns.stock.getBidPrice(this.ticker)) / 2
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

	get bullish() { return this.forecast > .535; }
	get bearish() { return this.forecast < .465; }

	get hasTicked() { return this.price.avg != this.lastPrice }
	
	onTickDetected() {
		this.currentTick = (this.currentTick + 1) % 75;
		this.lastPrice = this.price.avg;
		this.lastForecast = this.forecast;
		this.history.unshift(this.price.avg);
		this.history = this.history.slice(0, upperBoundHistoryLength);
	}

	get forecast() { return this.longTermForecast }

	calcForecast(history=this.history) {
		return history.reduce((ups, price, idx) => idx == 0 ? 0 : (this.history[idx - 1] > price ? ups + 1 : ups), 0) / (history.length - 1);
	}

	get nearTermForecast() { return this.calcForecast(this.history.slice(0, nearTermWindowLength)) }
	get longTermForecast() { return this.calcForecast(this.history.slice(0, this.probWindowLength)) }

	get volatility() {
		return this.history.reduce((max, price, idx) => Math.max(max, idx == 0 ? 0 : Math.abs(this.history[idx - 1] - price) / price), 0); 
	}

	get std_dev() {
        return Math.sqrt((this.forecast * (1 - this.forecast)) / this.probWindowLength);
	}

	get probWindowLength() {
		return Math.min(longTermWindowLength, (this.currentTick - this.cycleTick) % cycleLength); 
	}

    detectInversion(p1,p2) {
		const tol2 = inversionDetectionTolerance / 2;
		return ((p1 >= 0.5 + tol2) && (p2 <= 0.5 - tol2) && p2 <= (1 - p1) + inversionDetectionTolerance)
        /* Reverse Condition: */ || ((p1 <= 0.5 - tol2) && (p2 >= 0.5 + tol2) && p2 >= (1 - p1) - inversionDetectionTolerance);
	}

	get expected_value() {
		let normalizedProb = (this.forecast - 0.5);
		let conservativeProb = normalizedProb < 0 ? Math.min(0, normalizedProb + this.std_dev) : Math.max(0, normalizedProb - this.std_dev);
		return this.volatility * conservativeProb;
	}

	get preNearTermWindowProb() { return this.calcForecast(this.history.slice(nearTermWindowLength)); }

	get hasInverted() {
		return this.detectInversion(this.preNearTermWindowProb, this.nearTermForecast) && (this.history.length >= lowerBoundHistoryLength)
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
