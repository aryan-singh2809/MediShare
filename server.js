const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;
const chartRoutes = require('./chartt');
const locationApp = require('./location');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'medi_homepg.html'));
});
app.use('/chart', chartRoutes);
app.use('/', locationApp);
const mediAppRouter = require('./medi_app');
app.use('/', mediAppRouter);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
