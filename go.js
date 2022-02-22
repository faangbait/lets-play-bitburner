import HackableBaseServer from "./if.server.hackable"
import BasePlayer from "./if.player";
import { dpList } from "./lib.utils"; 

function execHackingScript(ns, servers) {
	let home = new HackableBaseServer(ns, "home")
	let home_pids = home.pids;

	let hacking_scripts = home_pids.filter(p => p.filename.startsWith("sbin.hack"))
	let hacking_script;

	if (hacking_scripts.length > 1) {
		throw "Two hacking scripts are running";
	} else {
		try { hacking_script = hacking_scripts[0]; } catch {}
	}
	let command = ns.peek(1);
	if (command == "NULL PORT DATA") { command = "sbin.hack.roundrobin.js" }
	
	if (hacking_script) {
		if (hacking_script.filename !== command) {
			ns.kill(hacking_script.pid);
			servers.map(s => s.pids).flat().filter(proc => proc.filename.startsWith("bin.")).forEach(proc => ns.kill(proc.pid));
			ns.exec(command, "home");
		}
	} else {
		ns.exec(command, "home");
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	let player = new BasePlayer(ns, "player");

	let servers = [];
	let slist = dpList(ns);
	for (let s of slist) {
		servers.push(new HackableBaseServer(ns, s))
	}

	for (let server of servers) {
		await ns.scp(["bin.wk.js", "bin.hk.js", "bin.gr.js"], "home", server.id)
	}


	while (true) {
		for (let server of servers) {
			if (!server.admin && server.ports.required <= player.ports) {
				server.sudo();
				await ns.scp(["bin.wk.js", "bin.hk.js", "bin.gr.js"], "home", server.id)
			}
		}
		execHackingScript(ns, servers);
		await ns.sleep(10);
	}
}
