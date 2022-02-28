/**
 * 
 * @param {import(".").NS} ns 
 * @param {*} stockObject 
 * @returns 
 */
export const stockExtenderShort = (ns, stockObject) => {

    stockObject._goshort = function (shares) {
        return ns.stock.sell(stockObject.ticker, shares) * shares
    }

    stockObject.max_short = function () {
		let shares = (ns.getServerMoneyAvailable("home") - 100000) / stockObject.price.bear
		shares = Math.floor(Math.min(shares, stockObject.maxShares - stockObject.position.bear))
		if (shares * stockObject.price.bear > 2000000) {
			return stockObject._goshort(shares)
		}
    }

    stockObject.shortCost = function (shares) {
        return (shares * stockObject.price.bear) + 100000 
    }

    stockObject.unshort = function (shares=stockObject.position.bear) {
        return ns.stock.sellShort(stockObject.ticker, shares);
    }

    stockObject.absoluteForecast = function () {
        try { 
            return Math.abs(stockObject.forecast - .5)
        } catch {}
    }

    return stockObject;
};

/**
 * 
 * @param {import(".").NS} ns 
 * @param {*} stockObject 
 * @returns 
 */
export const stockExtenderLimit = (ns, stockObject) => {

    stockObject.orders = { get () {
        return ns.stock.getOrders()[stockObject.ticker]
        }
    }

    stockObject.cancelAllOrders = function () {
        return stockObject.orders.forEach(o => ns.stock.cancelOrder(stockObject.ticker, o.shares, o.price, o.type, o.position))
    }

    stockObject.order = function (shares, price, type, position) {
        ns.stock.placeOrder(stockObject.ticker, shares, price, type, position)
    }

    stockObject.stopLoss = function () {
        // an order placed at 90% of current buy price
        // that sells the stock upon the price dipping
        stockObject.order(
            stockObject.position.bear || stockObject.position.bull, 
            (stockObject.position.bull) ? stockObject.price.bull * .9 : stockObject.price.bear * 1.1, 
            "Stop Sell", 
            (stockObject.position.bull) ? "L" : "S"
            )
    }

    stockObject.limitExit = function () {
        // an order placed at 110% of purchase price
        // that exits the position upon the price rising
        stockObject.order(
            stockObject.position.bear || stockObject.position.bull, 
            (stockObject.position.bull) ? stockObject.price.bull * 1.1 : stockObject.price.bear * .9, 
            "Limit Sell", 
            (stockObject.position.bull) ? "L" : "S"
            )
    }
    

    return stockObject;
};
