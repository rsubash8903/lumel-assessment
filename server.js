const fs = require("fs");
const compression = require("compression");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const primaryRoute = require("./salesNode/routes/primary_route");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", "*");
  next();
});

const server = require("http").createServer(app);
app.use(bodyParser.urlencoded({ limit: "500mb", extended: true }));
app.use(bodyParser.json({ limit: "500mb", extended: true }));
app.use(compression());
const db = require("./databaseCon");

db.checkConnection().then(
  () => {
    app.use("/api/primaryRoute", primaryRoute);

    let port = process.env.PORT || 3434;

    app.listen(port, () => {
      console.log(`Sales Node is Listening in the port ${port}`);
    });
  },

  (err) => {
    console.log("Error In Sales Node");
    console.log(err);
  }
);
