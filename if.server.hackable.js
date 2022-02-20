import BaseServer from "./if.server"

export default class HackableBaseServer extends BaseServer {
	constructor(ns, hostname) {
		super();
		this.ns = ns;
		this._id = hostname
	}

	sudo() {
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
