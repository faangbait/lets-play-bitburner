/** @param {NS} ns **/
export async function main(ns) {
	let target = ns.args[0];
	let repeat = ns.args[1];
	do {
		await ns.hack(target)
	} while (repeat)
}
