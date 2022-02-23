import PrettyTable from "./src.prettytable";
import { handleDB } from "./lib.db";
import { ServerCache, getAllFromCache } from "./if.cache";
/** @param {NS} ns **/
export async function main(ns) {
	let tailed = ns.args[0];

	let servers = [];
	let slist = await getAllFromCache('servers');
	for (let s of slist) {
		let server = new ServerCache(ns, s.id);
		await server.uncache();
		servers.push(server);
	}

	servers.sort((a,b) => a.level - b.level)

	let pt = new PrettyTable();
	let headers = ["SERVERNAME", "LEVEL", "HACKED", "CASH%", "SEC+", "POWER"]
	let rows = servers.map(s => [
		s.id,
		s.level,
		s.admin ? s.backdoored ? "\u0138it" : "\u01a6oot" : s.ports.required,
		ns.nFormat(s.money.available / s.money.max || "", "0%"),
		ns.nFormat(s.isTarget ? s.security.level - s.security.min : "", "0.0"),
		s.power || ""
	])

	pt.create(headers, rows);

	while (tailed) {
		ns.tail();
		ns.clearLog();
		ns.print(pt.print());
		await ns.sleep(100)
	}
	
	ns.tprint(pt.print());
}
