
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer TEXT,
        items TEXT,
        total REAL,
        date TEXT
    )`);
});

app.post('/api/invoice', (req, res) => {
    const { customer, items, total, date } = req.body;
    db.run(`INSERT INTO invoices (customer, items, total, date) VALUES (?, ?, ?, ?)`,
        [customer, JSON.stringify(items), total, date],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        });
});

app.get('/api/invoices', (req, res) => {
    db.all(`SELECT * FROM invoices`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const PDFDocument = require('pdfkit');

app.get('/api/invoice/:id/pdf', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM invoices WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).send('Invoice not found');

        const doc = new PDFDocument();
        res.setHeader('Content-disposition', 'inline; filename=invoice.pdf');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(18).text('Invoice', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Customer: ${row.customer}`);
        doc.text(`Date: ${row.date}`);
        doc.moveDown();
        doc.text(`Items:`);
        JSON.parse(row.items).forEach((item, i) => {
            doc.text(`  ${i + 1}. ${item.name} - $${item.price}`);
        });
        doc.moveDown();
        doc.fontSize(14).text(`Total: $${row.total}`, { align: 'right' });

        doc.end();
    });
});
