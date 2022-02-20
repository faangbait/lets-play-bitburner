import BasePlayer from "if.player";

/** @param {NS} ns **/
export async function main(ns) {
	// spawn the relevent subscripts given the "status" of a game
	let status = ns.args[0] // an integer from 0 to ~100 representing how many times we've reset
	let player = new BasePlayer(ns, "player");

	if (player.market.api.fourSigma) {
		ns.run("sbin.market.js");
	}

	if (status < 10) {
		ns.run("hnet.js");
	} else {
		ns.run("hnet-full.js")
	}

	let pid;

	while (!player.software.ssh) {
		if (!pid) {
			pid = ns.run("maxcash.js")
		}
		ns.sleep(10);
	}

	try { ns.kill(pid) } catch {}
	
	ns.run("go.js")

}
