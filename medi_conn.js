const mysql = require('mysql2');
const DB_USERNAME = "root";
const DB_PASS = "My!nst@_1136";
const DB_HOSTNAME = "localhost";
const DB_NAME = "medishare";

const connection = mysql.createConnection({
    host: DB_HOSTNAME,
    user: DB_USERNAME,
    password: DB_PASS,
    database: DB_NAME,
});

connection.connect((err) => {
    if (err) {
        console.error('DATABASE CONNECTION ERROR:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to the database successfully.');
    }
});
module.exports = connection;
