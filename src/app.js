import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import Joi from "joi";
import bcrypt from "bcrypt";
import emailValidator from 'email-validator';
import { v4 as uuid } from 'uuid';

const app = express();

// Configurations
app.use(cors());
app.use(express.json());
dotenv.config();

const schemaRegister = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().required(),
  password: Joi.string().required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().strict()
});

// Database Connection
const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
  mongoClient.connect();
  console.log("MongoDB connected!");
} catch (err) {
  console.log(err.message);
}

const db = mongoClient.db();

// Schemas

// Endpoints

app.post('/cadastro', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return res.status(422).send('All fields are required!');
  }

  if (!emailValidator.validate(email)) {
    return res.status(422).send('Invalid email!');
  }

  if (password.length < 3) {
    return res.status(422).send('Password must have at least three characters!');
  }

  try {
    const existingUser = await db.collection('user').findOne({ email });

    if (existingUser) {
      return res.status(409).send('A user with this email already exists!');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    await db.collection('user').insertOne({ name, email, password: hashedPassword });

    return res.sendStatus(201);
  } catch (err) {
    console.error('Error registering user:', err);
    return res.status(500).send(err.message);
  }
});

app.post('/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).send('All fields are required!');
  }

  if (!emailValidator.validate(email)) {
    return res.status(422).send('Invalid email!');
  }

  try {
    const user = await db.collection("user").findOne({ email });
    if (!user) {
      return res.status(404).send("User not registered");
    }

    const correctPassword = bcrypt.compareSync(password, user.password);
    if (!correctPassword) {
      return res.status(401).send("Incorrect password");
    }

    const token = uuid();
    await db.collection("session").insertOne({ token, idUser: user._id });

    res.send({ token });

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/', async (req, res) => {
  const { authorization } = req.headers;
  const token = authorization?.replace("Bearer ", "");

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const session = await db.collection("session").findOne({ token });
    if (!session) {
      return res.sendStatus(401);
    }

    const user = await db.collection("user").findOne({ _id: session.idUser });
    if (!user) {
      return res.sendStatus(401);
    }

    const { password, ...userInfo } = user; // Exclude the "password" field from the response

    res.send(userInfo);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/nova-transacao/:tipo', async (req, res) => {
  const { authorization } = req.headers;
  const token = authorization?.replace("Bearer ", "");

  if (!token) {
    return res.sendStatus(401);
  }

  const { tipo } = req.params;
  const { description, value } = req.body;

  if (!description || !value) {
    return res.status(422).send('All fields are required!');
  }

  if (typeof value !== 'number' || value <= 0) {
    return res.status(422).send('Invalid value!');
  }

  try {
    const session = await db.collection("session").findOne({ token });
    if (!session) {
      return res.sendStatus(401);
    }

    // Code to add the transaction to the database
    await db.collection("transaction").insertOne({ tipo, description, value, userId: session.idUser });

    res.sendStatus(201); // Response indicating success (status code 201 - Created)
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/home", async (req, res) => {
  const { authorization } = req.headers;
  const token = authorization?.replace("Bearer ", "");

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const session = await db.collection("session").findOne({ token });
    if (!session) {
      return res.sendStatus(401);
    }

    const user = await db.collection("user").findOne({ _id: session.idUser });
    if (!user) {
      return res.sendStatus(401);
    }

    const transactions = await db.collection("transaction")
      .find({ userId: session.idUser })
      .sort({ date: -1 }) // Sort by date in descending order (most recent first)
      .toArray();

    const balance = calculateBalance(transactions);

    res.send({
      name: user.name,
      transactions: transactions.map(transaction => ({
        description: transaction.description,
        value: transaction.value,
        tipo: transaction.tipo,
        date: transaction.date
      })),
      balance: balance
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

function calculateBalance(transactions) {
  let balance = 0;

  for (const transaction of transactions) {
    if (transaction.tipo === "input") {
      balance += transaction.value;
    } else if (transaction.tipo === "output") {
      balance -= transaction.value;
    }
  }

  return balance;
}

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));