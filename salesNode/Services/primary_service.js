const mysql = require("mysql");
const moment = require("moment");
const pool = require("../../databaseCon").pool;
const fs = require("fs");
const csv = require("csvtojson");
const path = require("path");
const db = "lumel-backend-assessment";
const _ = require("underscore");

module.exports.uploadSalesDataIntoTables = async (req, res) => {
  try {
    csv()
      .fromStream(readableStream)
      .subscribe(function (jsonObj) {
        return new Promise(function (resolve, reject) {
          asyncStoreToDb(json, function () {
            resolve();
          });
        });
      });
    let filePath = path.join(
      "C:",
      "Users",
      "rsubash",
      "Downloads",
      "Lumel-Backend-Assessment",
      "Sample Data.csv"
    );
    let jsonArray = await csv().fromFile(filePath);

    if (!(jsonArray && jsonArray.length > 0)) {
      return res.status(200).json({
        err: true,
        msg: "The excel file has no data",
        errCode: "DATERR001",
      });
    }

    //Insert The data into a Staging Table

    let missing_columns = ``;
    let orginal_keys = [
      "Order ID",
      "Product ID",
      "Customer ID",
      "Product Name",
      "Category",
      "Region",
      "Date of Sale",
      "Quantity Sold",
      "Unit Price",
      "Discount",
      "Shipping Cost",
      "Payment Method",
      "Customer Name",
      "Customer Email",
      "Customer Address",
    ];
    //Find the missing columns in the excel and return the error
    for (let items of orginal_keys) {
      let exists =
        jsonArray.filter(function (o) {
          return o.hasOwnProperty(items.trim());
        }).length > 0;

      if (!exists) {
        missing_columns += `${items} `;
      }
    }
    if (missing_columns != "") {
      return res.status(500).json({
        err: true,
        msg: `The follwing columns ${missing_columns} are not found in the uploaded excel file`,
        errCode: "DATERR002",
      });
    }
    //Find the empty data in the excel and show the error
    for (let items of jsonArray) {
      for (let keyData of orginal_keys) {
        if (
          _.isEmpty(items[keyData]) ||
          items[keyData] == null ||
          items[keyData] == undefined ||
          items[keyData].trim() == ""
        ) {
          return res.status(500).json({
            err: true,
            msg: `The follwing key ${keyData} has no data or the value is empty`,
            errCode: "DATERR003",
          });
        }
      }
    }
    //Get the master data of category, region, customer
    let category_data = await pool(
      `SELECT id, LOWER(product_category_name) AS product_category_name FROM ??.m_product_category WHERE is_active = 1`,
      [db]
    );
    let region_data = await pool(
      `SELECT id, LOWER(product_region_name) AS product_region_name   FROM ??.m_product_region WHERE is_active = 1`,
      [db]
    );
    let payment_data = await pool(
      `SELECT id, LOWER(payment_method_name) AS payment_method_name FROM ??.m_payment_method WHERE is_active = 1`,
      [db]
    );
    let customer_data = await pool(
      `SELECT id, LOWER(customer_email) AS customer_email FROM ??.m_customer WHERE is_active = 1 AND ? >= start_date AND ? <= end_date`,
      [db, moment().format("YYYY-MM-DD"), moment().format("YYYY-MM-DD")]
    );
    for (let items of jsonArray) {
      items.error = "";
      let cat_check = _.filter(category_data, {
        product_category_name: items["Category"].toLowerCase(),
      });
      let reg_check = _.filter(region_data, {
        product_category_name: items["Region"].toLowerCase(),
      });
      let pay_check = _.filter(payment_data, {
        product_category_name: items["Payment Method"].toLowerCase(),
      });
      let cust_check = _.filter(customer_data, {
        product_category_name: items["Customer Email"].toLowerCase(),
      });

      if (cat_check.length == 0) {
        items.error += "The Product Category Data Not Found In The Master Data";
      } else if (reg_check.length == 0) {
        items.error += "The Product Region Data Not Found In The Master Data";
      } else if (pay_check.length == 0) {
        items.error += "The Product Payment Data Not Found In The Master Data";
      } else if (cust_check.length == 0) {
        items.error += "The Product Customer Data Not Found In The Master Data";
      }
    }
    //Insert the data into the staging table
    let staging_table_data = [];
    for (let items of jsonArray) {
      staging_table_data.push([
        items["Order ID"],
        items["Product ID"],
        items["Customer ID"],
        items["Product Name"],
        items["Category"],
        items["Region"],
        items["Date of Sale"],
        items["Quantity Sold"],
        items["Unit Price"],
        items["Discount"],
        items["Shipping Cost"],
        items["Payment Method"],
        items["Customer Name"],
        items["Customer Email"],
        items["Customer Address"],
        items.error ? 1 : 0,
        1,
        moment().format("YYYY-MM-DD"),
      ]);
    }

    if (staging_table_data && staging_table_data.length > 0) {
      let insert_data = await pool(
        `INSERT INTO ??.t_sales_staging_data (order_id, product_id, customer_id, product_name, category, region, date_of_sale, quantity_sold, unit_price, discount, shipping_cost, payment_method, customer_name, customer_email, customer_address, is_error, is_active, created_on) VALUES (?)`,
        [db, staging_table_data]
      );
      if (insert_data && insert_data.affectedRows > 0) {
        return res.status(200).json({
          err: false,
          msg: "Sales Data Inserted Into The Staging Table",
        });
      }
    } else {
      return res.status(200).json({
        err: true,
        msg: "The excel file has no data",
        errCode: "DATERR004",
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      errorCode: "INSSRV001",
      msg: "Internal Server Error While Updating the data to database",
      additionalErrMg: err,
    });
  }
};
/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @returns Response to return the total revenue
 */
module.exports.getTotalRevenue = async (req, res) => {
  try {
    let start_date = req.body.start_date ? req.body.start_date : null;
    let end_date = req.body.end_date ? req.body.end_date : null;
    if(start_date == null || end_date == null){
      return res.status(500).json({
        err: true,
        msg: "Payload data not passed",
        errCode: "PAY001"
      });
    }
    start_date = moment(start_date).format("YYYY-MM-DD");
    end_date = moment(end_date).format("YYYY-MM-DD");
    let total_revenue = await pool(
      `SELECT SUM((quantity_sold * unit_price)* ((100-discount)/100)) AS total_revenue FROM ??.t_sales_staging_data WHERE is_active = 1 AND date_of_sale BETWEEN ? AND ?`,
      [db, start_date, end_date]
    );
    if (total_revenue && total_revenue.length > 0) {
      return res.status(200).json({
        err: false,
        msg: `Total Revenue is ${total_revenue[0]?.total_revenue}`,
      });
    } else {
      return res.status(500).json({
        err: true,
        msg: `Total revenue could not be calculated as data not found`,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      errorCode: "INSSRV002",
      msg: "Internal Server Error While Calculating Total Revenue",
      additionalErrMg: err,
    });
  }
};
/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @returns Response to return the total revenue of a product
 */
module.exports.getTotalRevenueByProduct = async (req, res) => {
  try {
    let start_date = req.body.start_date ? req.body.start_date : null;
    let end_date = req.body.end_date ? req.body.end_date : null;
    if(start_date == null || end_date == null){
      return res.status(500).json({
        err: true,
        msg: "Payload data not passed",
        errCode: "PAY001"
      });
    }
    start_date = moment(start_date).format("YYYY-MM-DD");
    end_date = moment(end_date).format("YYYY-MM-DD");
    let total_revenue = await pool(
      `SELECT SUM((quantity_sold * unit_price)* ((100-discount)/100)) AS total_revenue FROM ??.t_sales_staging_data WHERE is_active = 1 AND date_of_sale BETWEEN ? AND ? GROUP BY product_name`,
      [db, start_date, end_date]
    );
    if (total_revenue && total_revenue.length > 0) {
      return res.status(200).json({
        err: false,
        msg: `Total Revenue is ${total_revenue[0]?.total_revenue}`,
      });
    } else {
      return res.status(500).json({
        err: true,
        msg: `Total revenue could not be calculated as data not found`,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      errorCode: "INSSRV002",
      msg: "Internal Server Error While Calculating Total Revenue",
      additionalErrMg: err,
    });
  }
};
/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @returns Response to return the total revenue by category
 */
module.exports.getTotalRevenueByCategory = async (req, res) => {
  try {
    let start_date = req.body.start_date ? req.body.start_date : null;
    let end_date = req.body.end_date ? req.body.end_date : null;
    if(start_date == null || end_date == null){
      return res.status(500).json({
        err: true,
        msg: "Payload data not passed",
        errCode: "PAY001"
      });
    }
    start_date = moment(start_date).format("YYYY-MM-DD");
    end_date = moment(end_date).format("YYYY-MM-DD");
    let total_revenue = await pool(
      `SELECT SUM((quantity_sold * unit_price)* ((100-discount)/100)) AS total_revenue FROM ??.t_sales_staging_data WHERE is_active = 1 AND date_of_sale BETWEEN ? AND ? GROUP BY category`,
      [db, start_date, end_date]
    );
    if (total_revenue && total_revenue.length > 0) {
      return res.status(200).json({
        err: false,
        msg: `Total Revenue is ${total_revenue[0]?.total_revenue}`,
      });
    } else {
      return res.status(500).json({
        err: true,
        msg: `Total revenue could not be calculated as data not found`,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      errorCode: "INSSRV002",
      msg: "Internal Server Error While Calculating Total Revenue",
      additionalErrMg: err,
    });
  }
};
/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @returns Response to return the total revenue by region
 */
module.exports.getTotalRevenueByRegion = async (req, res) => {
  try {
    let start_date = req.body.start_date ? req.body.start_date : null;
    let end_date = req.body.end_date ? req.body.end_date : null;
    if(start_date == null || end_date == null){
      return res.status(500).json({
        err: true,
        msg: "Payload data not passed",
        errCode: "PAY001"
      });
    }
    start_date = moment(start_date).format("YYYY-MM-DD");
    end_date = moment(end_date).format("YYYY-MM-DD");
    let total_revenue = await pool(
      `SELECT SUM((quantity_sold * unit_price)* ((100-discount)/100)) AS total_revenue FROM ??.t_sales_staging_data WHERE is_active = 1 AND date_of_sale BETWEEN ? AND ? GROUP BY region`,
      [db, start_date, end_date]
    );
    if (total_revenue && total_revenue.length > 0) {
      return res.status(200).json({
        err: false,
        msg: `Total Revenue is ${total_revenue[0]?.total_revenue}`,
      });
    } else {
      return res.status(500).json({
        err: true,
        msg: `Total revenue could not be calculated as data not found`,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      errorCode: "INSSRV002",
      msg: "Internal Server Error While Calculating Total Revenue",
      additionalErrMg: err,
    });
  }
};
