/** @param {NS} ns **/

function range(size, startAt = 0) {
	return [...Array(size).keys()].map(i => i + startAt);
}

export async function main(ns) {
	// purchases hacknet servers to meet a minimum requirement
	// to get access to Netburners faction

	// 8 servers
	// 100 levels

	let totalLevels = 0;
	while (totalLevels < 100) {
		let nodes = range(ns.hacknet.numNodes())
		totalLevels = nodes.reduce((a,b) => a + ns.hacknet.getNodeStats(b).level, 0)
		try { nodes.filter(n => ns.hacknet.getNodeStats(n).level < 13).forEach(n => ns.hacknet.upgradeLevel(n, 1))} catch {}
		if (nodes.length < 8) {
			ns.hacknet.purchaseNode();
		}

		await ns.sleep(1)
	}

}
