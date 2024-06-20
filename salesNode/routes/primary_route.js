const express = require("express");
const router = express.Router();

// Controller
const service_primary = require("../Services/primary_service");

/**
 * POST /uploadSalesDataIntoTables
 * To upload the sales data into the tables
 * @author R Subash
 * @version 1.0
 */
router.post(
  "/uploadSalesDataIntoTables",
  service_primary.uploadSalesDataIntoTables
);
/**
 * GET /getTotalRevenue
 * To get the total revenue
 * @author R Subash
 * @version 1.0
 */
router.get(
    "/getTotalRevenue",
    service_primary.getTotalRevenue
);
/**
 * GET /getTotalRevenueBy Product
 * To get the total revenue
 * @author R Subash
 * @version 1.0
 */
router.get(
    "/getTotalRevenueByProduct",
    service_primary.getTotalRevenueByProduct
);
/**
 * GET /getTotalRevenueByCategory
 * To get the total revenue
 * @author R Subash
 * @version 1.0
 */
router.get(
    "/getTotalRevenueByCategory",
    service_primary.getTotalRevenueByCategory
);
/**
 * GET /getTotalRevenueByRegion
 * To get the total revenue
 * @author R Subash
 * @version 1.0
 */
router.get(
    "/getTotalRevenueByRegion",
    service_primary.getTotalRevenueByRegion
);
