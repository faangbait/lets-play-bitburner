/**
 * returns an array of servers dynamically
 */
export function dpList(ns, current="home", set=new Set()) {
	let connections = ns.scan(current)
	let next = connections.filter(c => !set.has(c))
	next.forEach(n => {
		set.add(n);
		return dpList(ns, n, set)
	})
	return Array.from(set.keys())
}

export class Cacheable {
	constructor(){}
	
	async createEventListener(fieldSet) {
		const embeddedObject = (obj, field) => {
			return obj[field];
		}

		let splitFields = fieldSet.split(".");
		let oldValue;
		while (true) {
			let subObj = this;
			for (let field of splitFields) {
				subObj = embeddedObject(subObj, field);
			}
			if (oldValue != subObj) {
				oldValue = subObj;
				this.updateCache(false);
			}
			await this.ns.asleep(1);
		}

	}
}
