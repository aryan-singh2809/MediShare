const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const db = require('./medi_conn');
const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'medi_buypg.html'));
});

//* Haversine formula
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kms
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Fetching Lat and Lon of user
app.post('/search-medicine', (req, res) => {
  const searchTerm = req.body.medicine_name;
  if (!req.session.username) {
    return res.status(401).send('User not logged in.');
  }
  const username = req.session.username;
  const query = 'SELECT Latitude, Longitude FROM users WHERE Username = ?';
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error fetching user location from database.');
    }

    if (results.length === 0) {
      return res.status(404).send('User not found.');
    }
    const userLat = results[0].Latitude;
    const userLon = results[0].Longitude;

      const medicineQuery = `
      SELECT m.Id, m.Name, m.Username AS Medicine_Username, m.Price, m.Exp_date, m.Qty, 
            m.Latitude AS Medicine_Latitude, m.Longitude AS Medicine_Longitude
      FROM medicines m
      JOIN seller_account sa ON m.Username = sa.Username
      WHERE LOWER(m.Name) LIKE LOWER(?) AND m.Status = 'Verified'
      `;

    db.query(medicineQuery, [`%${searchTerm}%`], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      if (results.length === 0) {
        return res.json([]);
      }

      const filteredResults = results.filter(result => {
        const distance = haversine(userLat, userLon, result.Medicine_Latitude, result.Medicine_Longitude);
        return distance <= 15;
      });

      if (filteredResults.length === 0) {
        return res.json([]);
      }
      const formattedResults = filteredResults.map(result => {
        const expDate = new Date(result.Exp_date);
        result.Exp_date = expDate.toISOString().split('T')[0];

        const distance = haversine(userLat, userLon, result.Medicine_Latitude, result.Medicine_Longitude);
        const deliveryCharges = distance < 2 ? 'Free Delivery' : `${Math.floor(distance) * 2} Rs`;
        result.deliveryCharges = deliveryCharges;
        return result;
      });
      res.json(formattedResults);
    });
  });
});







// fetch buyer's details
app.get('/get-user-details', (req, res) => {
  const { username } = req.query;
  // console.log("Hello");
  if (!username) {
    return res.status(400).json({ message: 'Username is required' }); // Handle missing username
  }
  const sql = `SELECT Username, Email, Latitude, Longitude FROM Users WHERE Username = ?`;
  db.query(sql, [username], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user details', error: err });
    }
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  });
});


// Updating the transaction table
app.post('/update-transaction', (req, res) => {
  const { Medicine_id, Buyer_id, Qty, Total_amt, Trans_date, Status } = req.body;

  if (!Medicine_id || !Buyer_id || !Qty || !Total_amt || !Trans_date || !Status) {
    return res.status(400).json({ message: 'All fields (Medicine_id, Buyer_id, Qty, Total_amt, Trans_date, Status) are required' });
  }

  if (isNaN(Qty) || isNaN(Total_amt)) {
    return res.status(400).json({ message: 'Qty and Total_amt must be valid numbers' });
  }

  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error starting transaction', details: err });
    }

    const checkStockQuery = `SELECT Qty FROM Medicines WHERE id = ?`;
    db.query(checkStockQuery, [Medicine_id], (err, result) => {
      if (err) {
        return db.rollback(() => {
          return res.status(500).json({ error: 'Error checking stock', details: err });
        });
      }

      if (result.length === 0 || result[0].Qty < Qty) {
        return db.rollback(() => {
          return res.status(400).json({ message: 'Quantity entered is out of stock' });
        });
      }

      const insertTransactionQuery = `INSERT INTO Transactions (Medicine_id, Buyer_id, Qty, Total_amt, Trans_date, Status) VALUES (?, ?, ?, ?, ?, ?)`;
      db.query(insertTransactionQuery, [Medicine_id, Buyer_id, Qty, Total_amt, Trans_date, Status], (err, result) => {
        if (err) {
          return db.rollback(() => {
            return res.status(500).json({ error: 'Error updating transaction', details: err });
          });
        }

        const updateStockQuery = `UPDATE Medicines SET Qty = Qty - ? WHERE id = ?`;
        db.query(updateStockQuery, [Qty, Medicine_id], (err, result) => {
          if (err) {
            return db.rollback(() => {
              return res.status(500).json({ error: 'Error updating medicine quantity', details: err });
            });
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                return res.status(500).json({ error: 'Error committing transaction', details: err });
              });
            }
            res.status(200).json({
              message: 'Transaction updated successfully',
              transactionId: result.insertId,
              status: 'success'
            });
          });
        });
      });
    });
  });
});





// Generating Bill
app.post('/generate-bill', (req, res) => {
  const { transactionDetails, Buyer_id } = req.body;

  const getBuyerNameQuery = `SELECT Buyer_name FROM Users WHERE Buyer_id = ?`;
  db.query(getBuyerNameQuery, [Buyer_id], (err, buyerResult) => {
    if (err || buyerResult.length === 0) {
      return res.status(500).json({ error: 'Error fetching buyer name' });
    }

    const buyerName = buyerResult[0].Buyer_name;
    let totalBillAmount = 0;
    const billItems = transactionDetails.map(item => {
      let deliveryCharges = item.DeliveryCharges;
      if (deliveryCharges === "$Free Delivery" || isNaN(deliveryCharges)) {
        deliveryCharges = 0;
      } else {
        deliveryCharges = parseFloat(deliveryCharges);
      }
      const totalAmount = (item.Qty * item.Price) + item.DeliveryCharges;
      totalBillAmount += totalAmount;
      return {
        medicineName: item.MedicineName,
        qty: item.Qty,
        price: item.Price,
        deliveryCharges: item.DeliveryCharges,
        totalAmount: totalAmount,
      };
    });

    const billSummary = {
      buyerName,
      totalBillAmount,
      billItems
    };

    res.status(200).json(billSummary);
  });
});







app.post('/set-session-data', (req, res) => {
  const { Seller_id, Buyer_id, Medicine_name, Qty_bought } = req.body;

  req.session.Seller_id = Seller_id;
  req.session.Buyer_id = Buyer_id;
  req.session.Medicine_name = Medicine_name;
  req.session.Qty_bought = Qty_bought;
  // console.log('Session data:', req.session);
  res.json({ message: 'Session data stored successfully' });
});


app.get('/get-session-data', (req, res) => {
  if (!req.session.Seller_id || !req.session.Buyer_id || !req.session.Medicine_name || !req.session.Qty_bought) {
      return res.status(400).json({ error: 'Session data not found' });
  }

  res.json({
      Seller_id: req.session.Seller_id,
      Buyer_id: req.session.Buyer_id,
      Medicine_name: req.session.Medicine_name,
      Qty_bought: req.session.Qty_bought
  });
});



app.post('/update-history', (req, res) => {
  const { Seller_id, Buyer_id, Medicine_name, Qty_bought } = req.body;
  if (!Seller_id || !Buyer_id || !Medicine_name || !Qty_bought) {
      return res.status(400).json({ message: 'All fields (Seller_id, Buyer_id, Medicine_name, Qty_bought) are required' });
  }
  if (isNaN(Qty_bought)) {
      return res.status(400).json({ message: 'Qty_bought must be a valid number' });
  }
  const buyerQuery = `SELECT Email, Latitude, Longitude FROM Users WHERE Username = ?`;
  db.query(buyerQuery, [Buyer_id], (err, buyerResult) => {
      if (err) {
          console.error('Database error (retrieving buyer details):', err);
          return res.status(500).json({ error: 'Error retrieving buyer details', details: err });
      }

      if (buyerResult.length === 0) {
          return res.status(404).json({ error: 'Buyer not found' });
      }

      const buyerEmail = buyerResult[0].Email;
      const buyerLatitude = buyerResult[0].Latitude;
      const buyerLongitude = buyerResult[0].Longitude;
      const historyQuery = `
          INSERT INTO History (Seller_id, Buyer_id, Medicine_name, Qty_bought)
          VALUES (?, ?, ?, ?)
      `;
      db.query(historyQuery, [Seller_id, Buyer_id, Medicine_name, Qty_bought], (err, historyResult) => {
          if (err) {
              console.error('Database error (updating history):', err);
              return res.status(500).json({ error: 'Error updating history', details: err });
          }

          const sellerNotifText = `
              Hello! ${Seller_id}, ${Qty_bought} units of your ${Medicine_name} 
              have been purchased by ${Buyer_id}. This is the buyer's email: ${buyerEmail}, 
              and their location: ${buyerLatitude}, ${buyerLongitude}.
              You are requested to deliver this medicine to their address in 2-3 days 
              in order to receive the payment amount.
          `;
          const sellerNotifQuery = `
              INSERT INTO notifications (Username, Notif_text, is_read, Reply)
              VALUES (?, ?, 0, 1)
          `;
          db.query(sellerNotifQuery, [Seller_id, sellerNotifText], (err, sellerNotifResult) => {
              if (err) {
                  console.error('Database error (creating seller notification):', err);
                  return res.status(500).json({ error: 'Error creating seller notification', details: err });
              }

              const sellerQuery = `SELECT Email, Latitude, Longitude FROM Users WHERE Username = ?`;
              db.query(sellerQuery, [Seller_id], (err, sellerResult) => {
                  if (err) {
                      console.error('Database error (retrieving seller details):', err);
                      return res.status(500).json({ error: 'Error retrieving seller details', details: err });
                  }

                  if (sellerResult.length === 0) {
                      return res.status(404).json({ error: 'Seller not found' });
                  }

                  const sellerEmail = sellerResult[0].Email;
                  const sellerLatitude = sellerResult[0].Latitude;
                  const sellerLongitude = sellerResult[0].Longitude;

                  const buyerNotifText = `
                      Hello! ${Buyer_id}, thank you for making the purchase for ${Medicine_name}. 
                      The consignment will be delivered to you in 2-3 days. This is the location 
                      of the seller (${Seller_id}): ${sellerLatitude}, ${sellerLongitude}, and the seller's email address: ${sellerEmail}.
                      The same details of yours have been provided to the seller as well.
                      If the consignment doesn't get delivered within 2-3 days, please click on this button.
                  `;
                  const buyerNotifQuery = `
                      INSERT INTO notifications (Username, Notif_text)
                      VALUES (?, ?)
                  `;
                  db.query(buyerNotifQuery, [Buyer_id, buyerNotifText], (err, buyerNotifResult) => {
                      if (err) {
                          console.error('Database error (creating buyer notification):', err);
                          return res.status(500).json({ error: 'Error creating buyer notification', details: err });
                      }

                      res.json({
                          message: 'History updated successfully and notifications created.',
                          historyId: historyResult.insertId,
                          sellerNotificationId: sellerNotifResult.insertId,
                          buyerNotificationId: buyerNotifResult.insertId
                      });
                  });
              });
          });
      });
  });
});

module.exports = app;




