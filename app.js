const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

// Body-parser middleware
app.use(bodyParser.json());

// Oturumları saklamak için bir nesne
const clients = {};
const sessions = {}; // Oturum durumlarını saklamak için bir nesne

// Yeni bir WhatsApp istemcisi oluşturma
const createClient = (id) => {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: id }) // Her cihaz için benzersiz bir kimlik doğrulama dizini
    });

    sessions[id] = { status: 'QR kod taranmayı bekliyor' }; // Başlangıç durumu

    client.on('qr', (qr) => {
        console.log(`Oturum: ${id} için QR kodu:`);
        qrcode.generate(qr, { small: true });
        sessions[id].status = 'QR kod taranmayı bekliyor'; // QR kod durumu
    });

    client.on('ready', () => {
        console.log(`Oturum: ${id} hazır!`);
        sessions[id].status = 'Bağlı'; // Bağlantı başarılı
    });

    client.on('authenticated', () => {
        console.log(`Oturum: ${id} kimlik doğrulandı.`);
        sessions[id].status = 'Kimlik doğrulandı'; // Kimlik doğrulama durumu
    });

    client.on('disconnected', () => {
        console.log(`Oturum: ${id} bağlantısı kesildi.`);
        sessions[id].status = 'Bağlantı kesildi'; // Bağlantı koptu
        delete clients[id];
    });

    client.initialize();
    return client;
};

// Yeni cihaz eklemek için endpoint
app.post('/create-session', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Oturum ID gerekli!' });
    }

    if (clients[id]) {
        return res.status(400).json({ error: 'Bu ID ile zaten bir oturum başlatılmış.' });
    }

    clients[id] = createClient(id); // Yeni cihazı başlat
    res.status(200).json({ success: true, message: `Oturum: ${id} başlatıldı.` });
});

// Cihazları listelemek için endpoint
app.get('/devices', (req, res) => {
    const devices = Object.keys(sessions).map((id) => ({
        id,
        status: sessions[id].status,
    }));
    res.status(200).json({ devices });
});

// Mesaj göndermek için endpoint
app.post('/send-message', async (req, res) => {
    const { id, phone, message } = req.body;

    if (!id || !phone || !message) {
        return res.status(400).json({ error: 'ID, telefon numarası ve mesaj gerekli!' });
    }

    const client = clients[id];

    if (!client) {
        return res.status(400).json({ error: 'Bu ID ile çalışan bir oturum bulunamadı.' });
    }

    try {
        const phoneNumber = `${phone}@c.us`;
        await client.sendMessage(phoneNumber, message);
        res.status(200).json({ success: true, message: 'Mesaj başarıyla gönderildi.' });
    } catch (err) {
        console.error('Mesaj gönderilirken hata oluştu:', err);
        res.status(500).json({ error: 'Mesaj gönderilemedi.' });
    }
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
});