const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.5skci.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();

    const userCollection = client.db("manufacturer_db").collection("users");
    const productCollection = client
      .db("manufacturer_db")
      .collection("products");

    const orderCollection = client.db("manufacturer_db").collection("order");
    const paymentCollection = client
      .db("manufacturer_db")
      .collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    //USER ADMIN ROUT
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/product", async (req, res) => {
      const products = await productCollection.find().toArray();
      res.send(products);
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: ObjectId(id) };
      const product = await productCollection.findOne(query);
      res.send(product);
    });

    app.post("/product", verifyJWT, verifyAdmin, async (req, res) => {
      const product = req.body;

      const result = await productCollection.insertOne(product);
      // res.send({ success: "Product Upload Successfully" });
      // } else {
      res.send({ success: "Authorize" });
      // }
    });

    app.delete("/product/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.id;
      // const filter = { email: email };
      const query = { _id: ObjectId(id) };

      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/order", async (req, res) => {
      const order = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await orderCollection.insertOne(order);
      console.log("sending email");
      // sendAppointmentEmail(booking);
      return res.send({ success: true, result });
    });

    app.patch("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payments = req.body;
      console.log(id, payments);
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payments.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payments);
      const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedOrder);
    });

    app.get("/order", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const decodedEmail = req.decoded.email;
      // console.log(decodedEmail);

      if (email === decodedEmail) {
        const query = { user: email };
        const order = await orderCollection.find(query).toArray();
        // console.log(order);

        return res.send(order);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });
    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(email);
      // const decodedEmail = req.decoded.email;
      // console.log(decodedEmail);

      // if (email === decodedEmail) {
      const query = { _id: ObjectId(id) };
      const orderone = await orderCollection.findOne(query);
      console.log(orderone);

      res.send(orderone);
      // } else {
      // return res.status(403).send({ message: "forbidden access" });
      // }
    });

    app.put("/order/:id", async (req, res) => {
      const order = req.body;
      // console.log(order);
      const query = {
        productid: order.productid,
        product: order.product,
        username: order.ussrname,
        email: order.user,
        quantity: order.quantity,
        price: order.price,
      };
      const exists = await orderCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, order: exists });
      }
      const result = await orderCollection.insertOne(order.order);

      return res.send({ success: true, result });
    });
  } finally {
    //await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
