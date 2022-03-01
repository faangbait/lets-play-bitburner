import BaseServer from "./if.server"

export default class HackableBaseServer extends BaseServer {
	constructor(ns, hostname) {
		super();
		this.ns = ns;
		this._id = hostname
	}

    get isTarget() { return (!this.purchased && !this.isHome && (this.money.max > 0) && (this.ports.open >= this.ports.required) && this.admin && (this.level <= this.ns.getPlayer().hacking))}
    get isAttacker() { return ( this.purchased || this.isHome || (this.ram.max > 0 && this.admin))}
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
			this.ns.brutessh(this.id)
			this.ns.ftpcrack(this.id)
			this.ns.relaysmtp(this.id)
			this.ns.httpworm(this.id)
			this.ns.sqlinject(this.id)
		} catch {}
				
		try {
			this.ns.nuke(this.id)
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
