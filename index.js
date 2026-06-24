
const express = require('express');
const app = express();

const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient } = require('mongodb');

app.use(cors());
app.use(express.json());

dotenv.config();

const uri = process.env.MONGODB_URI;
const port = process.env.PORT;

const client = new MongoClient(uri)

app.get('/', (req, res) => {
  res.send('Hello Developers!');
});


async function run(){
try{}
catch(e){
    console.log(e)
}
}

run().catch(console.log(e));


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});