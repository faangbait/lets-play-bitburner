import HackableBaseServer from "./if.server.hackable"
import BasePlayer from "./if.player";
import {numCycleForGrowthCorrected} from "./if.server.hackable"

/**
 * returns an array of servers dynamically
 */
function dpList(ns, current="home", set=new Set()) {
	let connections = ns.scan(current)
	let next = connections.filter(c => !set.has(c))
	next.forEach(n => {
		set.add(n);
		return dpList(ns, n, set)
	})
	return Array.from(set.keys())
}

export async function main(ns) {
	let slist = dpList(ns);
	let servers = [];
	for (let s of slist) {
		servers.push(new HackableBaseServer(ns, s))
	}

	let player = new BasePlayer(ns, "player")
	let home = new HackableBaseServer(ns, "home");
	let target = new HackableBaseServer(ns, "n00dles");

	let growThreads = numCycleForGrowthCorrected(ns.getServer(target.id), target.money.max, target.money.available, ns.getPlayer(), home.cores);
	let weakThreads1 = Math.ceil((target.security.level - target.security.min) * 20)
	let weakThreads2 = Math.ceil(growThreads / 12.5)


	while (growThreads > 0 || weakThreads1 > 0 || weakThreads2 > 0) {
		// prepare a server that will be the target of our batch
		growThreads = numCycleForGrowthCorrected(ns.getServer(target.id), target.money.max, target.money.available, ns.getPlayer(), home.cores);
		weakThreads1 = Math.ceil((target.security.level - target.security.min) * 20)
		weakThreads2 = Math.ceil(growThreads / 12.5)



		if (home.threadCount(1.75) >= (growThreads + weakThreads1 + weakThreads2)) {
			if (weakThreads1 > 0) {
				ns.exec("bin.wk.js", "home", weakThreads1, target.id)
			}
			if (growThreads > 0) {
				ns.exec("bin.gr.js", "home", growThreads, target.id)
			}
		} else {
			if (weakThreads1 > 0 && home.threadCount(1.75) > 0) {
				ns.exec("bin.wk.js", "home", Math.min(weakThreads1, home.threadCount(1.75)), target.id)
			} else if (growThreads > 0 && home.threadCount(1.75) > 0) {
				ns.exec("bin.gr.js", "home", Math.min(growThreads, home.threadCount(1.75)), target.id)
			} else if (weakThreads2 > 0 && home.threadCount(1.75) > 0) {
				ns.exec("bin.wk.js", "home", Math.min(weakThreads2, home.threadCount(1.75)), target.id)
			}
		}

		await ns.sleep(10);
	}

	while (true) {
		// skim the approprate amount of money off the server
		// weaken the server to bring back to zero security
		// grow the server to replace this money
		// weaken the server to bring back to zero security

		let hackPercent = .1;
		let hackThreads = Math.floor(ns.hackAnalyzeThreads(target.id, target.money.max * hackPercent))
		weakThreads1 = Math.ceil(hackThreads / 25)
		growThreads = numCycleForGrowthCorrected(ns.getServer(target.id), target.money.max, target.money.max * (1 - hackPercent) , ns.getPlayer(), home.cores);
		weakThreads2 = Math.ceil(growThreads / 12.5)

		let hackTime = ns.getHackTime(target.id);
		let growTime = hackTime * 3.2;
		let weakenTime = hackTime * 4;
		let currentTime = performance.now();
		let next_landing = weakenTime + 3000 + currentTime;
		let nextBatch = []

		let proposed_batch = {
			hk: hackThreads,
			wk1: weakThreads1,
			gr: growThreads,
			wk2: weakThreads2
		}

		let required_ram = 1.7 * proposed_batch.hk
		required_ram += 1.75 * proposed_batch.wk1
		required_ram += 1.75 * proposed_batch.gr
		required_ram += 1.75 * proposed_batch.wk2

		let available_ram = home.ram.free;

		if (available_ram > required_ram) {
			ns.exec("bin.hk.js", "home", proposed_batch.hk, target.id, false, next_landing)
			ns.exec("bin.wk.js", "home", proposed_batch.wk1, target.id, false, next_landing + 40)
			ns.exec("bin.gr.js", "home", proposed_batch.gr, target.id, false, next_landing + 80)
			ns.exec("bin.wk.js", "home", proposed_batch.wk2, target.id, false, next_landing + 120)
		}

		await ns.sleep(200)
	}

}
