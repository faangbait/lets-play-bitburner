import BasePlayer from "if.player";
import BaseStock from "if.stock";
import TIXStock from "if.stock.tix";
import FourSigmaTIXStock from "if.stock.4s";
import PrettyTable from "src.prettytable";
import {stockExtenderLimit, stockExtenderShort } from "if.stock.short";

const stock_list = ["ECP", "MGCP", "BLD", "CLRK", "OMTK", "FSIG", "KGI", "FLCM", "STM", "DCOMM", "HLS", "VITA", "ICRS", "UNV", "AERO", "OMN", "SLRS", "GPH", "NVMD", "WDS", "LXO", "RHOC", "APHE", "SYSC", "CTK", "NTLK", "OMGA", "FNS", "JGN", "SGC", "CTYS", "MDYN", "TITN"]

const ACL = {
	WSE: 1, 	// 00000001
	TIX: 2, 	// 00000010
	WSE4S: 4, 	// 00000100
	TIX4S: 8, 	// 00001000
	LIMIT: 16, 	// 00010000
	SHORT: 32, 	// 00100000
}

const sleepTime = 1000;
const expectedTickTime = 6000;
const accelTickTime = 4000;
let inversionThreshold = 7;
let cycleTick = 0;
let cycleDetected = false;
let currentTick = 0;
const nearTermWindowLength = 10;

function hasTickOccurred(stocks) {
	return stocks.some(s => s.hasTicked);
}

function hasCycleOccurred(stocks) {
	// determine whether a critical mass of inversions has happened
	let inverted = stocks.reduce((a,b) => a + b.hasInverted, 0)
	if (inverted > inversionThreshold) {
		inversionThreshold = Math.min(inverted + 1, 15)
		return true;
	}
	return false;
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("asleep");
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
    
    if (permissions & ACL.SHORT) {
        for (let s of stocks) {
            s = stockExtenderShort(ns, s)
        }
    }

    if (permissions & ACL.LIMIT) {
        for (let s of stocks) {
            s = stockExtenderLimit(ns, s)
        }
    }
	
    for (let s of stocks) {
        s.updateCache().catch(console.error)
    }

	while(true) {
        if (permissions & ACL.TIX4S) { cycleDetected = true; }
        
        if (permissions & ACL.TIX) {
            if (permissions & ACL.SHORT) {
                stocks.sort((a,b) => b.absoluteForecast - a.absoluteForecast)
            } else {
                stocks.sort((a,b) => b.expected_value - a.expected_value)
            }

            for (let st of stocks) {
                try {
                    if (cycleDetected) {
                        if (st.bearish) { st.unbuy(); }
                        if (st.bullish) { st.unsell(); }
                    }
                } catch {}
            }

            try {
                if (hasTickOccurred(stocks)) {
                    currentTick = (currentTick + 1) % 75;
                    // ns.tprint("Tick detected!")
                    stocks.forEach(s => s.onTickDetected())

                    if (hasCycleOccurred(stocks)) {
                        // ns.tprint("Inversion detected!")
                        cycleDetected = true;
                        cycleTick = currentTick - nearTermWindowLength;
                        stocks.forEach(s => s.cycleTick = cycleTick);
                    }

                    if (cycleDetected) {
                        stocks.sort((a,b) => b.expected_value - a.expected_value)
                        stocks.filter(s => s.bullish).forEach(s => s.max_long());
                    }
                }

            } catch {}
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

		await ns.sleep(sleepTime);
	}

}
