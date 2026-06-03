import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite local.');
  }
});

// Helper para executar queries com Promises (run)
export const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Helper para buscar múltiplos registros (all)
export const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Helper para buscar um único registro (get)
export const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Inicialização das tabelas
export const initDatabase = async () => {
  try {
    // Tabela Demands (Cache local)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS demands (
        externalId TEXT PRIMARY KEY,
        origin TEXT CHECK(origin IN ('Jira', 'Azure')),
        title TEXT NOT NULL,
        externalStatus TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela Annotations (Anotações/Histórico)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        externalId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (externalId) REFERENCES demands(externalId) ON DELETE CASCADE
      )
    `);

    // Tabela Tags
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tags (
        externalId TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (externalId, tag),
        FOREIGN KEY (externalId) REFERENCES demands(externalId) ON DELETE CASCADE
      )
    `);

    console.log('Tabelas do banco de dados inicializadas com sucesso.');
  } catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err);
  }
};

export default db;
