// database.js - Manager pentru baza de date
const mysql = require('mysql2/promise');

class DatabaseManager {
    constructor() {
        this.connection = null;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'admin',
            database: process.env.DB_NAME || 'navarre_florarie',
            charset: 'utf8mb4'
        };
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(this.config);
            console.log('✅ Conectat la baza de date MySQL');
        } catch (error) {
            console.error('❌ Eroare la conectarea la baza de date:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 Deconectat de la baza de date');
        }
    }

 async getProduse(filtru = {}) {
  let query = 'SELECT * FROM produse_complete WHERE activ = TRUE';
  const params = [];

  if (filtru.titlu) {
    query += ' AND LOWER(titlu) LIKE ?';
    params.push(`%${filtru.titlu.toLowerCase()}%`);
  }

  if (filtru.pret_maxim) {
    query += ' AND pret <= ?';
    params.push(filtru.pret_maxim);
  }

  if (filtru.categorie) {
    query += ' AND categorie = ?';
    params.push(filtru.categorie);
  }

  if (filtru.flori && filtru.flori.length) {
    const florile = filtru.flori.map(() => 'FIND_IN_SET(?, LOWER(flori)) > 0').join(' OR ');
    query += ` AND (${florile})`;
    params.push(...filtru.flori.map(f => f.toLowerCase()));
  }

  if (filtru.sarbatori && filtru.sarbatori.length) {
    const sarb = filtru.sarbatori.map(() => 'FIND_IN_SET(?, LOWER(sarbatori)) > 0').join(' OR ');
    query += ` AND (${sarb})`;
    params.push(...filtru.sarbatori.map(s => s.toLowerCase()));
  }

  // opțional: interpretare simplă pt. disponibilitate
  if (filtru.disponibilitate) {
    const isMorning = filtru.disponibilitate === 'dimineata';
    query += ' AND timp_disponibil LIKE ?';
    params.push(isMorning ? '0%:%' : '1%:%');
  }

  query += ' ORDER BY data_adaugare DESC LIMIT 100';

  try {
    const [rows] = await this.connection.execute(query, params);
    return rows.map(this.processProdusRow);
  } catch (error) {
    console.error('Eroare în getProduse():', error);
    throw error;
  }
}

    async getProdusByID(id) {
  const query = `SELECT * FROM produse_complete WHERE id = ? AND activ = TRUE`;
  try {
    const [rows] = await this.connection.execute(query, [id]);
    if (rows.length === 0) return null;
    return this.processProdusRow(rows[0]);
  } catch (error) {
    console.error("❌ Eroare getProdusByID:", error);
    throw error;
  }
}

async isProdusDisponibil(id) {
    const produs = await this.getProdusByID(id);
    if (!produs || !produs.timp_disponibil) return true;

    const acum = new Date();
    const oraCurenta = acum.getHours() + acum.getMinutes() / 60;

    const [start, end] = produs.timp_disponibil.split("-").map(str => {
        const [h, m] = str.split(":").map(Number);
        return h + m / 60;
    });

    return start <= oraCurenta && oraCurenta <= end;
}

    processProdusRow(row) {
        return {
            ...row,
            flori: row.flori ? row.flori.split(',').map(s => s.trim()) : [],
            sarbatori: row.sarbatori ? row.sarbatori.split(',').map(s => s.trim()) : [],
            aranjamente: row.aranjamente ? row.aranjamente.split(',').map(s => s.trim()) : [],
            pret: parseFloat(row.pret),
            stoc: parseInt(row.stoc)
        };
    }
}

module.exports = DatabaseManager;
