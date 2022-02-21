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
	let player = new BasePlayer(ns, "player")

	let slist = dpList(ns);
	let servers = [];
	for (let s of slist) {
		servers.push(new HackableBaseServer(ns, s))
	}
	servers.sort((a,b) => a.isHome - b.isHome)
	let home = new HackableBaseServer(ns, "home");

	let targets = servers.filter(s => s.isTarget);
	targets.sort((a,b) => b.money.growth - a.money.growth)
	let target = targets[0];

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
		let attackers = servers.filter(s => s.isAttacker);
		targets = servers.filter(s => s.isTarget);
		targets.sort((a,b) => b.money.growth - a.money.growth)

		let available_ram = new Map();
		for (let server of attackers) {
			available_ram.set(server.id, server.ram.free)
		};
		for (let target of targets) {
			// skim the approprate amount of money off the server
			// weaken the server to bring back to zero security
			// grow the server to replace this money
			// weaken the server to bring back to zero security

			let hackPercent = .1;
			let hackThreads = Math.floor(ns.hackAnalyzeThreads(target.id, target.money.max * hackPercent))
			weakThreads1 = Math.ceil((hackThreads / 25) + (target.security.level - target.security.min) * 20)
			growThreads = numCycleForGrowthCorrected(ns.getServer(target.id), target.money.max, target.money.available, ns.getPlayer(), home.cores)
			growThreads += numCycleForGrowthCorrected(ns.getServer(target.id), target.money.max, target.money.max * (1 - hackPercent) , ns.getPlayer(), home.cores);
			weakThreads2 = Math.ceil(growThreads / 12.5)

			let hackTime = ns.getHackTime(target.id);
			let growTime = hackTime * 3.2;
			let weakenTime = hackTime * 4;
			let currentTime = performance.now();
			let next_landing = weakenTime + 160 + currentTime;
			let nextBatch = []

			let proposed_batch = {
				hk: hackThreads,
				wk1: weakThreads1,
				gr: growThreads,
				wk2: weakThreads2
			}

			for (let server of servers) {
				if (proposed_batch.hk > 0) {
					if (available_ram.get(server.id) > proposed_batch.hk * 1.7) {
						nextBatch.push({
							attacker: server.id,
							filename: "bin.hk.js",
							threads: proposed_batch.hk,
							landing: next_landing
						})
						available_ram.set(server.id, available_ram.get(server.id) - proposed_batch.hk * 1.7)
						proposed_batch.hk = 0;
					}
				}
			}

			if (available_ram.get(home.id) > proposed_batch.gr * 1.75) {

				nextBatch.push({
					attacker: home.id,
					filename: "bin.gr.js",
					threads: proposed_batch.gr,
					landing: next_landing + 80
				})

				available_ram.set(home.id, available_ram.get(home.id) - proposed_batch.gr * 1.75);
				proposed_batch.gr = 0;
			}


			for (let server of servers) {
				if (proposed_batch.wk1 > 0) {
					if (available_ram.get(server.id) > proposed_batch.wk1 * 1.75) {
						nextBatch.push({
							attacker: server.id,
							filename: "bin.wk.js",
							threads: proposed_batch.wk1,
							landing: next_landing + 40
						})
						available_ram.set(server.id, available_ram.get(server.id) - proposed_batch.wk1 * 1.75)
						proposed_batch.wk1 = 0;

					} else {
						let available_threads = Math.floor((available_ram.get(server.id) / 1.75));
						if (available_threads > 0) {
							let batch = {
								attacker: server.id,
								filename: "bin.wk.js",
								threads: Math.floor((available_ram.get(server.id) / 1.75)),
								landing: next_landing + 40
							}
							nextBatch.push(batch)
							available_ram.set(server.id, available_ram.get(server.id) - batch.threads * 1.75)
							proposed_batch.wk1 = proposed_batch.wk1 - batch.threads;
						}
					}
				}
				
				if (proposed_batch.wk2 > 0) {
					if (available_ram.get(server.id) > proposed_batch.wk2 * 1.75) {
						nextBatch.push({
							attacker: server.id,
							filename: "bin.wk.js",
							threads: proposed_batch.wk2,
							landing: next_landing + 120
						})
						available_ram.set(server.id, available_ram.get(server.id) - proposed_batch.wk1 * 1.75)
						proposed_batch.wk2 = 0;
					} else {
						let available_threads = Math.floor((available_ram.get(server.id) / 1.75));
						if (available_threads > 0) {
							let batch = {
								attacker: server.id,
								filename: "bin.wk.js",
								threads: available_threads,
								landing: next_landing + 120
							}
							nextBatch.push(batch)
							available_ram.set(server.id, available_ram.get(server.id) - batch.threads * 1.75)
							proposed_batch.wk2 = proposed_batch.wk2 - batch.threads;

						}
					}
				}

			}

			let wkSanityCheck = nextBatch.filter(batch => batch.filename == "bin.wk.js")
			let hkSanityCheck = nextBatch.filter(batch => batch.filename == "bin.hk.js")
			let grSanityCheck = nextBatch.filter(batch => batch.filename == "bin.gr.js")
			
			if (wkSanityCheck.reduce((a,b) => a + b.threads, 0) == weakThreads1 + weakThreads2) {
				if (hkSanityCheck.reduce((a,b) => a + b.threads, 0) == hackThreads) {
					if (grSanityCheck.reduce((a,b) => a + b.threads, 0) == growThreads) {
						for (let cmd of nextBatch) {
							ns.exec(cmd.filename, cmd.attacker, cmd.threads, target.id, false, cmd.landing)
						}
					}
				}
			}

		}

		await ns.sleep(160)
	}

}
