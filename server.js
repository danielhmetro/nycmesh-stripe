var key = require("./key");
var stripe = require("stripe")(key);
var restify = require("restify");

function charge(req, res, next) {
  if (!req.params || !req.params.stripeToken) return;

  // should really sanitize input
  var stripeToken = req.params.stripeToken;
  var donationAmount = req.params.donationAmount;
  var subscriptionPlan = req.params.subscriptionPlan;

  // If subscription selected, invoice customer
  // then add them to plan with 30 day trial
  if (subscriptionPlan) {
    stripe.customers.create(
      {
        source: stripeToken.id,
        description: "NYC Mesh Donation",
        email: stripeToken.email
      },
      function(err, customer) {
        if (err) {
          console.log("Error creating customer: ", err);
          res.writeHead(400);
          res.end("Error creating customer");
          next();
        } else {
          console.log("Created customer: " + customer.email);
          stripe.invoiceItems.create(
            {
              amount: donationAmount,
              currency: "usd",
              customer: customer.id,
              description: "Installation"
            },
            function(err, invoiceItem) {
              if (err) {
                console.log("Error invoicing customer: ", err);
                res.writeHead(400);
                res.end("Error invoicing customer");
                next();
              } else {
                console.log(`Invoiced ${customer.email} ${donationAmount}`);
                subscribeCustomer(customer, subscriptionPlan, 30, res, next);
              }
            }
          );
        }
      }
    );
  } else {
    // Otherwise just make the one time charge
    // one-time donation
    stripe.charges.create(
      {
        amount: donationAmount,
        currency: "usd",
        source: stripeToken.id,
        description: "NYC Mesh Donation"
      },
      function(err, charge) {
        if (err) {
          console.log("Error charging card: ", err);
          res.writeHead(400);
          res.end("Error charging card");
          next();
        } else {
          console.log("Charged " + charge.receipt_email + " " + donationAmount);
          res.writeHead(200);
          res.end();
          next();
        }
      }
    );
  }
}

function createCharge(stripeToken, amount, cb) {
  const charge = {
    amount: donationAmount,
    currency: "usd",
    source: stripeToken.id,
    description: "NYC Mesh Donation"
  };
  stripe.charges.create(charge, cb);
}

function createSubscription(stripeToken, subscriptionPlan, cb) {
  const customer = {
    source: stripeToken.id,
    plan: subscriptionPlan,
    description: "NYC Mesh Donation",
    email: stripeToken.email
  };
  stripe.customers.create(customer, cb);
}

function subscribeCustomer(customer, plan, trialDays, res, next) {
  const daysMiliseconds = trialDays * 24 * 60 * 60 * 1000;
  const endDate = new Date(Date.now() + daysMiliseconds).getTime();
  const trial_end = parseInt(endDate / 1000);
  const subscription = {
    customer: customer.id,
    items: [
      {
        plan
      }
    ],
    trial_end
  };
  stripe.subscriptions.create(subscription, (err, subscription) => {
    if (err) {
      console.log(`Error subscribing ${customer.email} to ${plan}`, err);
      res.writeHead(400);
      res.end("Error subscribing");
      next();
    } else {
      console.log(`Subscribed ${customer.email} to ${plan}`);
      res.writeHead(200);
      res.end();
      next();
    }
  });
}

// Legacy donate page
function donate(req, res, next) {
  if (!req.params || !req.params.stripeToken) return;

  // should really sanitize input
  var stripeToken = req.params.stripeToken;
  var donationAmount = req.params.donationAmount;

  // one-time donation
  if (parseInt(donationAmount)) {
    stripe.charges.create(
      {
        amount: donationAmount,
        currency: "usd",
        source: stripeToken.id,
        description: "NYC Mesh Donation",
        receipt_email: stripeToken.email
      },
      function(err, charge) {
        if (err) {
          console.log("Error charging card: ", err);
          res.writeHead(400);
          res.end();
          next();
        } else {
          console.log(charge.email + " " + donationAmount);
          res.writeHead(200);
          res.end();
          next();
        }
      }
    );
  } else if (
    donationAmount == "twenty-monthly" ||
    donationAmount == "fifty-monthly" ||
    donationAmount == "hundred-monthly"
  ) {
    // subscription
    var plan = req.params.plan;
    stripe.customers.create(
      {
        source: stripeToken.id,
        plan: donationAmount,
        description: "NYC Mesh Donation",
        email: stripeToken.email
      },
      function(err, customer) {
        if (err) {
          console.log("Error creating subscription: ", err);
          res.writeHead(400);
          res.end();
          next();
        } else {
          console.log(customer.email + " " + donationAmount);
          res.writeHead(200);
          res.end();
          next();
        }
      }
    );
  }
}

var server = restify.createServer();

server.use(restify.bodyParser());
server.use(function crossOrigin(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://nycmesh.net");
  return next();
});

server.post("/charge", charge);
server.post("/donate", donate);

server.listen(9090, function() {
  console.log("listening at %s", server.url);
});
