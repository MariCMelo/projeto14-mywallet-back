import cors from "cors"
import express from "express"
import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import Joi from "joi"
import bcrypt from "bcrypt"
import emailValidator from 'email-validator'

const app = express()

// Configs
app.use(cors())
app.use(express.json())
dotenv.config()

const schemaRegister = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().required(),
    password: Joi.string().required(),
    confirmPassword: Joi.string().required(),
})


// Conexão DB
const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
    mongoClient.connect()
    console.log("MongoDB conectado!")
} catch (err) {
    console.log(err.message)
}

const db = mongoClient.db()

// Schemas

// Endpoints

app.post('/cadastro', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
  
    if (!name || !email || !password || !confirmPassword) {
      return res.status(422).send('Todos os campos são obrigatórios!');
    }
  
    if (!emailValidator.validate(email)) {
      return res.status(422).send('E-mail inválido!');
    }
  
    if (password.length < 3) {
      return res.status(422).send('A senha deve possuir no mínimo três caracteres!');
    }
  
    if (password !== confirmPassword) {
      return res.status(422).send('A senha e a confirmação de senha devem ser iguais!');
    }
  
    try {
      const existingUser = await db.collection('user').findOne({ email });
  
      if (existingUser) {
        return res.status(409).send('Já existe um usuário com este e-mail cadastrado!');
      }
  
      const hashedPassword = bcrypt.hashSync(password, 10);
  
      await db.collection('user').insertOne({ name, email, password: hashedPassword });
  
      return res.sendStatus(201);
    } catch (err) {
      console.error('Erro ao cadastrar usuário:', err);
      return res.status(500).send(err.message);
    }
  });

// app.get("/home", async (req, res) => {

//     try {


//     } catch (err) {

//     }
// });


// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))