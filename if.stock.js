export default class BaseStock { 
	constructor(ns, ticker) {
		this.ns = ns;
		this._ticker = ticker;
	}

    listGetters(instance, properties=new Set()) {
        let getters = Object.entries(
            Object.getOwnPropertyDescriptors(
                Reflect.getPrototypeOf(instance)
            )).filter(e => typeof e[1]["get"] === 'function' && e[0] !== '__proto__').map(e => e[0])

        getters.forEach(g => {
            properties.add(g);
            return this.listGetters(Object.getPrototypeOf(instance), properties)
        })
        return properties
    }


	get ticker() { return this._ticker };
  get symbol() { return this._symbol };

	async updateCache(repeat=true, kv=new Map()) {
        do {
            const db = await handleDB();
            let old = await db["get"]("stocks", this.symbol) || {}
            let getters = this.listGetters(this)
            getters.forEach(g => {
                if (this[g]) {
                    old[g] = this[g];
                }
            })
            kv.forEach((v,k) => old[k] = v)

            await db["put"]("stocks", old)
            if (repeat) { await this.ns.asleep(6000) }
        } while (repeat)
    }
}
