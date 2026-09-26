function getHealth(req, res) {
    res.json({
        message: "StockSense API is running"
    });
}

module.exports = {
    getHealth
};
