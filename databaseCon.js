const mysql = require("mysql");
const config = require("config");
const fs = require("fs");
const util = require("util");

let dbConfig = {
  connectionLimit: config.connectionLimit,
  host: config.host,
  user: config.user,
  password: config.password,
  port: config.port,
  debug: config.debug,
  waitForConnections: true,
  multipleStatements: true,
  acquireTimeout:1000000
};

const pool = mysql.createPool(dbConfig);

module.exports.checkConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
          reject("Database connection was closed.");
        }
        if (err.code === "ER_CON_COUNT_ERROR") {
          reject("Database has too many connections.");
        }
        if (err.code === "ECONNREFUSED") {
          reject("Database connection was refused.");
        }
        reject(err);
      }
      if (connection) {
        connection.release();
        resolve();
      }
      return;
    });
  });
};

module.exports.pool = util.promisify(pool.query).bind(pool);
