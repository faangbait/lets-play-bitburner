/** @param {NS} ns **/
export async function main(ns) {
	let script = ns.args[0];

	ns.clearPort(1);
	await ns.writePort(1, script)
}
