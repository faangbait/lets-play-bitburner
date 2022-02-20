/** @param {NS} ns **/

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

function threadCount(ns, hostname, scriptRam) {
	let threads = 0;
	let free_ram = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)

	threads = free_ram / scriptRam
	return Math.floor(threads)
}

export async function main(ns) {
	let servers = dpList(ns);
	// let target = "foodnstuff"
	ns.disableLog("ALL");
	for (let server of servers) {
		await ns.scp(["bin.wk.js", "bin.hk.js", "bin.gr.js"], "home", server)
	}

	while(true) {
		let targets = dpList(ns).filter(s => ns.getServerMoneyAvailable(s) > 5000 && !ns.getPurchasedServers().includes(s) && s != "home");
		for (let server of servers) {
			for (let target of targets) {
				if (ns.hasRootAccess(server) && ns.hasRootAccess(target) && ns.getServerMoneyAvailable(target) > 5000) {
					// divert all of this server's available threads to the most valuable command
					if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target) + 3) {
						let available_threads = threadCount(ns, server, 1.75)
						// weaken the target while security > minsecurity
						if (available_threads >= 1) {
							ns.exec("bin.wk.js", server, available_threads, target)
						}
					} else {
						let available_threads = threadCount(ns, server, 1.7)

						// hack the target
						if (available_threads >= 1) {
							ns.exec("bin.hk.js", server, available_threads, target)
						}
					}

				} else {
					// open all possible ports on every server; then attempt to nuke the server
					try {
						ns.brutessh(server)
						ns.ftpcrack(server)
						ns.relaysmtp(server)
						ns.httpworm(server)
						ns.sqlinject(server)
					} catch {}
					
					try {
						ns.nuke(server)
					} catch {}
			}

			}

		await ns.sleep(10)
		}
	}
}
