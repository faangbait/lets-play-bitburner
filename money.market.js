import BasePlayer from "if.player";
import BaseStock from "if.stock";
import TIXStock from "if.stock.tix";
import FourSigmaTIXStock from "if.stock.4s";
import PrettyTable from "src.prettytable";

const stock_list = ["ECP", "MGCP", "BLD", "CLRK", "OMTK", "FSIG", "KGI", "FLCM", "STM", "DCOMM", "HLS", "VITA", "ICRS", "UNV", "AERO", "OMN", "SLRS", "GPH", "NVMD", "WDS", "LXO", "RHOC", "APHE", "SYSC", "CTK", "NTLK", "OMGA", "FNS", "JGN", "SGC", "CTYS", "MDYN", "TITN"]

const ACL = {
	WSE: 1, 	// 00000001
	TIX: 2, 	// 00000010
	WSE4S: 4, 	// 00000100
	TIX4S: 8, 	// 00001000
	LIMIT: 16, 	// 00010000
	SHORT: 32, 	// 00100000
}

/** @param {NS} ns **/
export async function main(ns) {
	let player = new BasePlayer(ns, "player");
	let permissions = 0;
	permissions += ACL.WSE * player.market.manual.wse;
	permissions += ACL.TIX * player.market.api.tix;
	permissions += ACL.WSE4S * player.market.manual.fourSigma;
	permissions += ACL.TIX4S * player.market.api.fourSigma;
	permissions += ACL.LIMIT * false
	permissions += ACL.SHORT * false
	
	ns.clearLog();
	ns.print("Initializing Stock Market with following parameters: ")
	ns.print("WSE: ", !!(permissions & ACL.WSE))
	ns.print("TIX: ", !!(permissions & ACL.TIX))
	ns.print("WSE4S: ", !!(permissions & ACL.WSE4S))
	ns.print("TIX4S: ", !!(permissions & ACL.TIX4S))
  ns.print("LIMIT: ", !!(permissions & ACL.LIMIT))
	ns.print("SHORT: ", !!(permissions & ACL.SHORT))
    
	
  let stocks = [];
  for (let s of stock_list) {
      stocks.push(new BaseStock(ns, s))
  }

  for (let s of stocks) {
      await s.updateCache(false);
  }

	if (!(permissions & ACL.WSE)) { return }

    if (permissions & ACL.TIX) {
        stocks = [];
        for (let s of stock_list) {
            stocks.push(new TIXStock(ns, s))
        }
    }

    if (permissions & ACL.TIX4S) {
        stocks = [];
        for (let s of stock_list) {
            stocks.push(new FourSigmaTIXStock(ns, s))
        }
    }

    if (permissions & ACL.WSE4S) {}
    	
    for (let s of stocks) {
        s.updateCache().catch(console.error)
    }

	while(true) {

        if (permissions & ACL.TIX4S) {
            // automatically buys and sells stocks based on
            // forecast data

            stocks.sort((a,b) => b.forecast - a.forecast)

            for (let st of stocks) {
                try {
                    if (st.forecast < .5) { st.unbuy() }
                } catch {}
            }

            for (let st of stocks) {
                try {
                    if (st.forecast > .535) { st.max_long(); }
                } catch {}
            }
        }

		ns.clearLog();
		let pt = new PrettyTable();
		let rows = [];
		let headers = ["TICK", "CAST", "POS"];
		for (let s of stocks) {
			rows.push(
				[
					s.ticker, 
					ns.nFormat(s.forecast, "0.000"),
					ns.nFormat(s.position.value, "0.0a"),
				]
			)
		}
		pt.create(headers, rows);
		ns.print(pt.print());
		await ns.sleep(6000);
	}

}
