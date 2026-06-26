const express = require("express");
const app = express();

const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

dotenv.config();

const uri = process.env.MONGODB_URI;
const port = process.env.PORT;

const client = new MongoClient(uri);

app.get("/", (req, res) => {
  res.send("Hello Developers!");
});

async function run() {
  try {
    const db = client.db("cook-world-data");
    const allRecipeCollection = db.collection("allRecipe");

    // get all recipe data
    app.get("/recipes", async (req, res) => {
      const result = await allRecipeCollection.find().toArray();
      res.send(result);
    });

    // get recipe with id
    app.get("/recipes/:id", async (req, res) => {
      const id = req.params.id;
      const result = await allRecipeCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // post recipe
    app.post("/recipes", async (req, res) => {
      const result = await allRecipeCollection.insertOne(req.body);
      res.send(result);
    });

    // get my-recipe
    app.get("/my-recipes", async (req, res) => {
      const email = req.query.email;

      const result = await allRecipeCollection
        .find({ authorEmail: email })
        .toArray();

      res.send(result);
    });

    // delete my-recipe
    app.delete("/recipes/:id", async (req, res) => {
      const id = req.params;
      const result = await allRecipeCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    //update my-recipe
    app.patch("/recipes/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      const result = await allRecipeCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updateData,
        },
      );

      res.send(result);
    });
  } catch (e) {
    console.log(e);
  }
}

run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
