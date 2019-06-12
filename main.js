const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mysql = require("mysql2");
const fs = require("fs");

let mainWindow;
let pool;

function createWindow() {
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 480,
    width: 780,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true
    }
    // resizable: false
  });
  mainWindow.setMenuBarVisibility(false);

  fs.readFile("config.txt", (err, data) => {
    if (!err) {
      config = JSON.parse(data);
      mainWindow.loadFile("index.html").then(() => {
        mainWindow.webContents.send("database:config", config);
      });
    } else {
      mainWindow.loadFile("index.html");
      console.log(err);
    }
  });

  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", function() {
    mainWindow = null;
  });
}

app.on("ready", createWindow);
app.on("window-all-closed", function() {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function() {
  if (mainWindow === null) createWindow();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on(
  "database:connect",
  (event, { host, user, password, database, port }) => {
    pool = mysql.createPool({
      host: host,
      user: user,
      password: password,
      database: database,
      port: port
    });

    config = {
      host: host,
      user: user,
      password: password,
      database: database,
      port: port
    };

    fs.writeFile("config.txt", JSON.stringify(config), err => {
      if (err) console.log(err);
    });

    pool
      .promise()
      .execute("SHOW TABLES")
      .then(res => {
        let tables = res[0];
        mainWindow.loadFile("tables.html").then(() => {
          mainWindow.webContents.send("database:tables", tables);
        });
      })
      .catch(error => {
        mainWindow.webContents.send("database:error", error);
      });
  }
);

ipcMain.on("database:query", (event, payload) => {
  pool
    .promise()
    .execute("SELECT * FROM " + payload)
    .then(res => {
      mainWindow.webContents.send("database:results", res[0]);
    });
});

ipcMain.on("database:sql", (event, payload) => {
  sql = payload;
  pool
    .promise()
    .execute(payload)
    .then(res => {
      if (sql.split(" ")[0].toLowerCase() == "select")
        mainWindow.webContents.send("database:results", res[0]);
      mainWindow.webContents.send("database:success", "Query successful");
    })
    .catch(error => {
      mainWindow.webContents.send("database:error", error);
    });
});

ipcMain.on("database:disconnect", event => {
  pool = null;
  mainWindow.loadFile("index.html");
});
