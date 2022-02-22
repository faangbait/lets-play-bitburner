/** @param {NS} ns **/
import HackableBaseServer from "./if.server.hackable"
import BasePlayer from "./if.player";
import { dpList } from "./lib.utils";

export async function main(ns) {
	let sList = dpList(ns)
	let servers = [];
	let player = new BasePlayer(ns, "player")
	await player.updateCache(false)
	for (let s of sList) {
		let server = new HackableBaseServer(ns, s)
		servers.push(server);
	}

	let target = new HackableBaseServer(ns, "foodnstuff")

	while(true) {
		for (let server of servers) {
			try { await server.updateCache(false) } catch {}
			if (server.admin && target.admin) {
				// divert all of this server's available threads to the most valuable command
				if (target.security.level > target.security.min) {
					let available_threads = server.threadCount(1.75)
					// weaken the target while security > minsecurity
					if (available_threads >= 1) {
						ns.exec("bin.wk.js", server.id, available_threads, target.id)
					}
				} else if (target.money.available < target.money.max) {
					let available_threads = server.threadCount(1.75)

					// grow the target while money < maxmoney
					if (available_threads >= 1) {
						ns.exec("bin.gr.js", server.id, available_threads, target.id)
					}
				} else {
					let available_threads = server.threadCount(1.7)

					// hack the target
					if (available_threads >= 1) {
						ns.exec("bin.hk.js", server.id, available_threads, target.id)
					}
				}
			}

		await ns.sleep(1000)
		}
	}
}
