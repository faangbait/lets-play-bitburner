import { handleDB } from "./lib.db";

export async function getAllFromCache(dataType) {
	const db = await handleDB();
	let data = await db["getAll"](dataType);
	return data;
}


export class ServerCache {
	constructor(ns, hostname) {
		this.ns = ns;
		this.id = hostname;
	}

	threadCount(scriptRam) {
		return Math.floor(this.ram.free / scriptRam)
	}

	uncache() { return (async () => {
		try {
			const db = await handleDB();
			let data = await db["get"]("servers", this.id)
			for (let prop of Object.keys(data)) {
				this[prop] = data[prop];
			}
			return this
		} catch { return null; }
	})();}
}


export class PlayerCache {
	constructor(ns, name) {
		this.ns = ns;
		this.id = name;
	}

	uncache() { return (async () => {
		try {
			const db = await handleDB();
			let data = await db["get"]("players", this.id)
			for (let prop of Object.keys(data)) {
				this[prop] = data[prop];
			}
			return this
		} catch { return null; }
	})();}
}
