// server.js
import express from "express";
import bodyParser from "body-parser";
import Stripe from "stripe";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// our server
const app = express();
// ✅ Allow your frontend (Vite) to call your backend
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    methods: ["GET", "POST"],
  })
);
app.use(bodyParser.json());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// -----------------------------
// Create a Stripe Customer
// -----------------------------
app.post("/create_customer", async (req, res) => {
  try {
    const { email, metadata } = req.body;
    const customer = await stripe.customers.create({ email, metadata });
    res.json({ customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ----
// Create a connected account for the kid: Stripe balance
// Make this your kid's email
// ---
app.post("/create_connected", async (req, res) => {
  try{
    const {email} = req.body; 
    // create an account for user with email
    const account = await stripe.accounts.create({
        type: "custom",
        country: "US",
        email: email,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        individual: {
          first_name: "Test",
          last_name: "User",
          dob: { day: 1, month: 1, year: 1990 },
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: "8.8.8.8", // any test IP
        },
    });
    res.json({account}); 
  } catch (err){
    console.error(err)
    res.status(500).json({ error: err.message });
  }
})

// -----------------------------
// Create a SetupIntent (save card for later)
// -----------------------------
app.post("/create_setup_intent", async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: "customerId required" });

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Attach a payment method to customer
// -----------------------------
app.post("/attach_payment_method", async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;
    if (!customerId || !paymentMethodId) return res.status(400).json({ error: "Missing parameters" });

    const customer = await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// -----------------------------
// Send money from a saved customer payment method to a connected account
// -----------------------------
app.post("/send_money", async (req, res) => {
  try {
    const { customerId, amount, currency = "usd", destinationAccountId} = req.body;

    if (!customerId ||!amount || !destinationAccountId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    console.log("retrieving customer....")
    const customer = await stripe.customers.retrieve(customerId);
    const paymentMethodId = customer.invoice_settings.default_payment_method;

    const cents = amount * 100; 

    console.log("doing payment...")
    // 1) Create PaymentIntent to charge customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents, 
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      transfer_data: {
        destination: destinationAccountId, // connected account
      },
    });

    // 2) Handle payment requiring action (3D Secure)
    console.log("handling action...")
    if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_source_action") {
      return res.json({ requiresAction: true, clientSecret: paymentIntent.client_secret });
    }
    // 3) Payment succeeded
    res.json({ success: true, paymentIntent });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.raw ? err.raw.message : err.message });
  }
});

// -----------------------------
// Start the server
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
