const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const router = express.Router();
const db = require('./medi_conn');
router.use(express.static(path.join(__dirname, 'public')));
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'analytics_chart.html'));
});

router.get('/transactions-per-year', (req, res) => {
    const query = `
        SELECT YEAR(Trans_date) AS Year, COUNT(*) AS TransactionCount
        FROM transactions
        GROUP BY YEAR(Trans_date)
        ORDER BY Year;
    `;

    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

router.get('/status-counts', (req, res) => {
    const query = `
        SELECT Status, COUNT(*) AS Count
        FROM medicines
        GROUP BY Status;
    `;

    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

router.get('/user-comparison', (req, res) => {
    const query = `SELECT COUNT(*) AS TotalUsers FROM Users;`;

    db.query(query, (err, results) => {
        if (err) throw err;

        const actualUserCount = results[0].TotalUsers;
        const startYear = 2020;
        const baseUserCount = 200;
        const growthRate = 1.10;
        const currentYear = new Date().getFullYear();
        let expectedUserCount = baseUserCount;

        for (let year = startYear + 1; year <= currentYear; year++) {
            expectedUserCount *= growthRate;
        }
        expectedUserCount = Math.round(expectedUserCount);

        res.json({
            actualUserCount,
            expectedUserCount
        });
    });
});

module.exports = router;
