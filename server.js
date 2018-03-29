var key = require("./key");
var stripe = require("stripe")(key);
var restify = require("restify");

function charge(req, res) {
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
                return;
              }
              console.log("Invoiced " + customer.email + " " + donationAmount);
              subscribeCustomer(
                customer,
                subscriptionPlan,
                30,
                (err, subscription) => {
                  if (err) {
                    console.log("Error subscribing " + customer.email, err);
                    res.writeHead(400);
                    res.end("Error subscribing");
                    return;
                  }

                  console.log("Subscribed " + customer.email + " to " + plan);
                  res.writeHead(200);
                  res.end();
                }
              );
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
        } else {
          console.log("Charged " + charge.receipt_email + " " + donationAmount);
          res.writeHead(200);
          res.end();
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

function subscribeCustomer(customer, plan, trialDays, cb) {
  const trial_end = parseInt(
    new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).getTime() / 1000
  );
  stripe.subscriptions.create(
    {
      customer: customer.id,
      items: [
        {
          plan
        }
      ],
      trial_end
    },
    cb
  );
}

// Legacy donate page
function donate(req, res) {
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
        } else {
          console.log(charge.email + " " + donationAmount);
          res.writeHead(200);
          res.end();
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
        } else {
          console.log(customer.email + " " + donationAmount);
          res.writeHead(200);
          res.end();
        }
      }
    );
  }
}

var server = restify.createServer();

server.use(restify.bodyParser());

server.post("/charge", charge);
server.post("/donate", donate);

server.listen(9090, function() {
  console.log("listening at %s", server.url);
});
