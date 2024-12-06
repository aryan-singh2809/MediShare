const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const connection = require('./medi_conn');
const path = require('path');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cron = require('cron');
const router = express.Router();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));
router.use(express.static(path.join(__dirname, 'public')));
router.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/medi_homepg_login.html');
});
router.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/public/medi_homepg_signup.html');
});



router.get('/get-user-location', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.status(401).send('User not logged in.');
    }
    const query = 'SELECT Latitude, Longitude FROM users WHERE Username = ?';
    connection.execute(query, [username], (err, results) => {
        if (err) {
            console.error('Error fetching user location:', err);
            return res.status(500).send('Database error occurred while fetching location.');
        }
        if (results.length > 0) {
            const { Latitude, Longitude } = results[0];
            res.json({ userLat: Latitude, userLon: Longitude });
        } else {
            res.status(404).send('User not found.');
        }
    });
});




router.get('/userLatiLongi', (req, res) => {
    const { username } = req.session;
    // console.log(req.session);
    if (username) {
        return res.json({ username});
    } else {
        return res.status(404).json({ message: 'Location or username not found in session' });
    }
});



router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const adminQuery = 'SELECT * FROM masterlogin WHERE username = ?';
    connection.execute(adminQuery, [username], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.send('Database error occurred while logging in.');
        }

        if (results.length > 0) {
            const admin = results[0];

            if (password === admin.password) {
                req.session.username = admin.username;
                return res.sendFile(__dirname + '/public/medi_adminpg.html');
            } else {
                return res.send('Incorrect admin password. Please try again.');
            }
        } else {
            const userQuery = 'SELECT * FROM users WHERE username = ?';
            connection.execute(userQuery, [username], (err, results) => {
                if (err) {
                    console.error('Database query error:', err);
                    return res.send('Database error occurred while logging in.');
                }

                if (results.length > 0) {
                    const user = results[0];
                    bcrypt.compare(password, user.password, (err, isMatch) => {
                        if (err) {
                            console.error('Error comparing passwords:', err);
                            return res.send('An error occurred while verifying your password.');
                        }
                        if (isMatch) {
                            req.session.username = user.username;
                            // console.log(req.session.username);
                            return res.sendFile(__dirname + '/public/medi_userpg.html');
                        } else {
                            return res.send('Incorrect user password. Please try again.');
                        }
                    });
                    
                } else {
                    return res.send('Username not found. Please check your credentials.');
                }
            });
        
        }
    });
});








router.post('/signup', (req, res) => {
    const { username, email, password, latitude, longitude } = req.body;

    const queryCheck = 'SELECT * FROM users WHERE Username = ? OR Email = ?';
    connection.execute(queryCheck, [username, email], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.send('Database error occurred while signing up.');
        }

        if (results.length > 0) {
            return res.send('Username or Email already exists. Please use a different one.');
        } else {
            bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    return res.send('An error occurred while securing your password.');
                }
                const queryInsert = 'INSERT INTO users (Username, Email, Password, Latitude, Longitude) VALUES (?, ?, ?, ?, ?)';
                connection.execute(queryInsert, [username, email, hashedPassword, latitude, longitude], (err, results) => {
                    if (err) {
                        console.error('Database query error:', err);
                        return res.send('Database error occurred while creating your account.');
                    }

                    return res.send(`
                        <script>
                            alert('Your account has been created successfully!');
                            window.location.href = '/';
                        </script>
                    `);
                });
            });
        }
    });
});






// Updating Medicines Table
router.post('/submit-form', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.send('<script>alert("Please log in to sell medicines."); window.location.href = "/login";</script>');
    }
    const { medicine_name, quantity, expiry_date, price } = req.body;
    const queryGetLocation = 'SELECT Latitude, Longitude FROM users WHERE Username = ?';
    connection.execute(queryGetLocation, [username], (err, results) => {
        if (err) {
            console.error('Error fetching user location:', err);
            return res.send('An error occurred while fetching location data.');
        }

        if (results.length > 0) {
            const { Latitude: latitude, Longitude: longitude } = results[0];
            const insertQuery = `
                INSERT INTO medicines (Username, Name, Qty, Exp_date, Price, Status, Latitude, Longitude)
                VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)
            `;
            connection.execute(
                insertQuery,
                [username, medicine_name, quantity, expiry_date, price, latitude, longitude],
                (err, result) => {
                    if (err) {
                        console.error('Error inserting medicine data:', err);
                        return res.send('An error occurred while submitting the form. Please try again.');
                    }
                    res.redirect('/medi_seller_accpg.html');
                }
            );
        } else {
            return res.send('<script>alert("User location not found. Please update your profile."); window.location.href = "/medi_seller_accpg.html";</script>');
        }
    });
});






//Updating Seller_account table
router.post('/submit-seller-account', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.send('<script>alert("Please log in to submit your seller account details."); window.location.href = "/login";</script>');
    }
    const { acc_num, ifsc } = req.body;
    const insertQuery = `
        INSERT INTO seller_account (Username, Acc_num, IFSC)
        VALUES (?, ?, ?)
    `;
    connection.execute(insertQuery, [username, acc_num, ifsc], (err, result) => {
        if (err) {
            console.error('Error inserting seller account data:', err);
            return res.status(500).send('An error occurred while submitting your account details. Please try again.');
        }
        res.send({ success: true });
    });
});







// Cron job 24-hr check
const updateExpiredMedicines = () => {
    const today = new Date().toISOString().split('T')[0];

    const query = `
        UPDATE Medicines
        SET Status = 'Expired'
        WHERE Exp_date < ? AND Status != 'Expired';
    `;

    connection.execute(query, [today], (err, results) => {
        if (err) {
            console.error('Error updating expired medicines:', err.message);
            return;
        }
        console.log(`${results.affectedRows} medicine(s) marked as expired.`);
    });
};

const job = new cron.CronJob('0 0 * * *', () => {
    console.log('Running the updateExpiredMedicines job...');
    updateExpiredMedicines();
}, null, true, 'Asia/Kolkata');
job.start();

console.log('Scheduled task started. It will check for expired medicines every 24 hours.');







router.get('/api/medicines/pending', (req, res) => {
    const query = 'SELECT Id, Name, Username, Qty, Exp_date, Price FROM medicines WHERE status = "Pending"';
    connection.execute(query, (err, results) => {
        if (err) {
            console.error('Error fetching pending medicines:', err);
            return res.status(500).send('Error fetching pending medicines');
        }
        res.json(results);
    });
});

router.post('/api/medicines/update-status', (req, res) => {

    const { medicineId, status } = req.body;
    if (!medicineId || !status) {
        console.error("Error: Invalid data received", req.body);
        return res.status(400).json({ success: false, message: 'Invalid request data.' });
    }
    const query = 'UPDATE medicines SET Status = ? WHERE Id = ?';
    connection.execute(query, [status, medicineId], (err, results) => {
        if (err) {
            console.error('Error updating medicine status:', err);
            return res.status(500).json({ success: false, message: 'Database error.' });
        }

        if (results.affectedRows > 0) {
            return res.json({ success: true, message: 'Status updated successfully.' });
        } else {
            return res.status(404).json({ success: false, message: 'Medicine not found.' });
        }
    });
});




router.get('/api/transactions/completed', (req, res) => {
    const query = 'SELECT * FROM transactions WHERE Status = "Completed"';
    connection.execute(query, (err, results) => {
        if (err) {
            console.error('Error fetching completed transactions:', err);
            return res.status(500).send('Error fetching completed transactions');
        }
        res.json(results);
    });
});

router.get('/api/notifications/unreplied', (req, res) => {
    const query = 'SELECT * FROM notifications WHERE Reply = 0';
    connection.execute(query, (err, results) => {
        if (err) {
            console.error('Error fetching unreplied notifications:', err);
            return res.status(500).send('Error fetching unreplied notifications');
        }
        res.json(results);
    });
});

router.post('/submit-notification', (req, res) => {
    const { username, notif_text, is_read, reply } = req.body;
    if (typeof username !== 'string' || !notif_text || (is_read !== '0' && is_read !== '1')) {
        return res.status(400).send('Invalid input.');
    }

    const queryInsert = 'INSERT INTO notifications (Username, Notif_text, is_read, Reply, Created_at) VALUES (?, ?, ?, ?, NOW())';
    const replyValue = reply === "" ? null : reply;
    connection.execute(queryInsert, [username, notif_text, is_read, replyValue], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).send('An error occurred while submitting the notification.');
        }

        res.send('Notification submitted successfully!');
    });
});









router.get('/notifications', (req, res) => {
    const username = req.session.username; 
    if (!username) {
        return res.status(401).send({ message: 'User not logged in' });
    }
    const query = `
        SELECT Notif_id, Notif_text, Created_at, is_read, Reply
        FROM notifications
        WHERE Username = ?
        ORDER BY Created_at DESC
    `;

    connection.execute(query, [username], (err, results) => {
        if (err) {
            console.error('Error fetching notifications:', err);
            return res.status(500).send({ message: 'Database error occurred while fetching notifications.' });
        }
        const updateQuery = 'UPDATE notifications SET is_read = 1 WHERE Username = ?';
        connection.execute(updateQuery, [username], (updateErr) => {
            if (updateErr) {
                console.error('Error updating notifications as read:', updateErr);
            }
        });
        res.json({ notifications: results });
    });
});





router.post('/respond-to-consignment/:notifId', (req, res) => {
    const notifId = req.params.notifId;
    const { reply } = req.body;
    const username = req.session.username;

    if (!username) {
        return res.status(401).send({ message: 'User not logged in' });
    }
    const queryCheck = `
        SELECT Reply
        FROM notifications
        WHERE Notif_id = ? AND Username = ? AND Reply IS NULL
    `;

    connection.execute(queryCheck, [notifId, username], (err, results) => {
        if (err) {
            console.error('Error checking notification:', err);
            return res.status(500).send({ message: 'Database error occurred while checking the notification.' });
        }

        if (results.length === 0) {
            return res.status(400).send({ message: 'Invalid notification or already replied by seller.' });
        }
        const queryUpdate = `
            UPDATE notifications
            SET Reply = ?
            WHERE Notif_id = ? AND Username = ?
        `;

        connection.execute(queryUpdate, [reply, notifId, username], (updateErr) => {
            if (updateErr) {
                console.error('Error updating consignment response:', updateErr);
                return res.status(500).send({ message: 'Error updating consignment response.' });
            }
            res.json({ message: 'Response recorded successfully' });
        });
    });
});





router.get('/history', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.status(401).json({ message: 'User not logged in' });
    }

    const query = `
        SELECT Seller_id, Buyer_id, Medicine_name, Qty_bought
        FROM history
        WHERE Seller_id = ? OR Buyer_id = ?
        ORDER BY Sno DESC
    `;

    connection.execute(query, [username, username], (err, results) => {
        if (err) {
            console.error('Error fetching history:', err);
            return res.status(500).json({ message: 'Database error occurred while fetching history.' });
        }

        res.json({ history: results });
    });
});

module.exports = router;
