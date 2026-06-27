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
    const cookWorldUsers = client.db("cook-world-users");
    const recipeLikesCollection = db.collection("recipeLikes");
    const recipeFavoritesCollection = db.collection("recipeFavorites");

    const allRecipeCollection = db.collection("allRecipe");
    const usersCollection = cookWorldUsers.collection("user");

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
      const recipe = req.body;
      const email = recipe.authorEmail;

      // User find
      const user = await usersCollection.findOne({ email });

      // Recipe count
      const recipeCount = await allRecipeCollection.countDocuments({
        authorEmail: email,
      });

      // Free user limit
      if (!user?.isPremium && recipeCount >= 2) {
        return res.status(403).send({
          message:
            "You have reached the free limit. Upgrade to Premium to add unlimited recipes.",
        });
      }

      // Insert recipe
      const result = await allRecipeCollection.insertOne(recipe);

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

    
    // Toggle Like
    app.post("/recipes/:id/like", async (req, res) => {
      const { id } = req.params;
      const { userEmail } = req.body;

      const existingLike = await recipeLikesCollection.findOne({
        recipeId: new ObjectId(id),
        userEmail,
      });

      // Unlike
      if (existingLike) {
        await recipeLikesCollection.deleteOne({
          _id: existingLike._id,
        });

        await allRecipeCollection.updateOne(
          {
            _id: new ObjectId(id),
            likesCount: { $gt: 0 }, // Prevent negative count
          },
          {
            $inc: {
              likesCount: -1,
            },
          },
        );

        const updatedRecipe = await allRecipeCollection.findOne({
          _id: new ObjectId(id),
        });

        return res.send({
          liked: false,
          likesCount: updatedRecipe.likesCount,
        });
      }

      // Like
      await recipeLikesCollection.insertOne({
        recipeId: new ObjectId(id),
        userEmail,
        createdAt: new Date(),
      });

      await allRecipeCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $inc: {
            likesCount: 1,
          },
        },
      );

      const updatedRecipe = await allRecipeCollection.findOne({
        _id: new ObjectId(id),
      });

      return res.send({
        liked: true,
        likesCount: updatedRecipe.likesCount,
      });
    });

    // Like Status
    app.get("/recipes/:id/like-status", async (req, res) => {
      const { id } = req.params;
      const { userEmail } = req.query;

      const like = await recipeLikesCollection.findOne({
        recipeId: new ObjectId(id),
        userEmail,
      });

      res.send({
        liked: !!like,
      });
    });

    // Toggle Favorite
    app.post("/recipes/:id/favorite", async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail } = req.body;

        const existingFavorite = await recipeFavoritesCollection.findOne({
          recipeId: new ObjectId(id),
          userEmail,
        });

        // Remove Favorite
        if (existingFavorite) {
          await recipeFavoritesCollection.deleteOne({
            _id: existingFavorite._id,
          });

          await allRecipeCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $inc: {
                favoriteCount: -1,
              },
            },
          );

          const updatedRecipe = await allRecipeCollection.findOne({
            _id: new ObjectId(id),
          });

          return res.send({
            isFavorite: false,
            favoriteCount: updatedRecipe.favoriteCount,
          });
        }

        // Add Favorite
        await recipeFavoritesCollection.insertOne({
          recipeId: new ObjectId(id),
          userEmail,
          createdAt: new Date(),
        });

        await allRecipeCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: {
              favoriteCount: 1,
            },
          },
        );

        const updatedRecipe = await allRecipeCollection.findOne({
          _id: new ObjectId(id),
        });

        return res.send({
          isFavorite: true,
          favoriteCount: updatedRecipe.favoriteCount,
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Something went wrong",
        });
      }
    });

    // Favorite Status
    app.get("/recipes/:id/favorite-status", async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail } = req.query;

        const favorite = await recipeFavoritesCollection.findOne({
          recipeId: new ObjectId(id),
          userEmail,
        });

        res.send({
          isFavorite: !!favorite,
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Something went wrong",
        });
      }
    });
  } catch (e) {
    console.log(e);
  }
}

run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
