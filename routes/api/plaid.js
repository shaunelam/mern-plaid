const express = require("express");
const plaid = require("plaid");
const router = express.Router();
const passport = require("passport");
const moment = require("moment");
const mongoose = require("mongoose");
// Load Account and User models
const Account = require("../../models/Account");
const User = require("../../models/User");
const PLAID_CLIENT_ID = "5e139d2206c4240013566ba3";
const PLAID_SECRET = "91c5ce1f56967eef0dd95724e790f1";
const PLAID_PUBLIC_KEY = "c75e4218b284142757613e635013a2";
const client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments.sandbox,
  { version: "2018-05-22" }
);
var PUBLIC_TOKEN = null;
var ACCESS_TOKEN = null;
var ITEM_ID = null;
// Routes will go here

router.post(
    "/accounts/add",
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
      PUBLIC_TOKEN = req.body.public_token;
  const userId = req.user.id;
  const institution = req.body.metadata.institution;
      const { name, institution_id } = institution;
  if (PUBLIC_TOKEN) {
        client
          .exchangePublicToken(PUBLIC_TOKEN)
          .then(exchangeResponse => {
            ACCESS_TOKEN = exchangeResponse.access_token;
            ITEM_ID = exchangeResponse.item_id;
  // Check if account already exists for specific user
            Account.findOne({
              userId: req.user.id,
              institutionId: institution_id
            })
              .then(account => {
                if (account) {
                  console.log("Account already exists");
                } else {
                  const newAccount = new Account({
                    userId: userId,
                    accessToken: ACCESS_TOKEN,
                    itemId: ITEM_ID,
                    institutionId: institution_id,
                    institutionName: name
                  });
  newAccount.save().then(account => res.json(account));
                }
              })
              .catch(err => console.log(err)); // Mongo Error
          })
          .catch(err => console.log(err)); // Plaid Error
      }
    }
  );

  router.delete(
    "/accounts/:id",
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        Account.findById(req.params.id).then(account => {
            // Delete account
            account.remove().then(() => res.json({ success: true }));
        });
    }
);

router.get(
    "/accounts",
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
      Account.find({ userId: req.user.id })
        .then(accounts => res.json(accounts))
        .catch(err => console.log(err));
    }
  );

  router.post(
    "/accounts/transactions",
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
      const now = moment();
      const today = now.format("YYYY-MM-DD");
      const thirtyDaysAgo = now.subtract(30, "days").format("YYYY-MM-DD"); // Change this if you want more transactions
  let transactions = [];
  const accounts = req.body;
  if (accounts) {
        accounts.forEach(function(account) {
          ACCESS_TOKEN = account.accessToken;
          const institutionName = account.institutionName;
  client
            .getTransactions(ACCESS_TOKEN, thirtyDaysAgo, today)
            .then(response => {
              transactions.push({
                accountName: institutionName,
                transactions: response.transactions
              });
  // Don't send back response till all transactions have been added
  if (transactions.length === accounts.length) {
                res.json(transactions);
              }
            })
            .catch(err => console.log(err));
        });
      }
    }
  );
module.exports = router;