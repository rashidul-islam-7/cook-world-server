const express = require("express");
const app = express();

const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

app.use(cors());
app.use(express.json());

dotenv.config();

const uri = process.env.MONGODB_URI;
const port = process.env.PORT || 5000;

const client = new MongoClient(uri);

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyJWT = async (req, res, next) => {
  console.log("Headers:"); // Debugging line

  const authHeader = req.headers.Authorization || req.headers.authorization;
  console.log("Authorization Header:", authHeader); // Debugging line
  const token = authHeader && authHeader.split(" ")[1];
  console.log("Extracted Token:", token); // Debugging line
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Forbidden access" });
  }
};

app.get("/", (req, res) => {
  res.send("Hello Developers!");
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("cook-world-data");
    const cookWorldUsers = client.db("cook-world-users");

    const recipeLikesCollection = db.collection("recipeLikes");
    const recipeFavoritesCollection = db.collection("recipeFavorites");
    const recipePurchasesCollection = db.collection("recipePurchases");
    const subscriptionsCollection = db.collection("subscriptions");
    const purchasedRecipesCollection = db.collection("purchasedRecipes");
    const reportsCollection = db.collection("reportsRecipes");
    const allRecipeCollection = db.collection("allRecipe");
    const usersCollection = cookWorldUsers.collection("user");
    const featuredRecipesCollection = db.collection("featuredRecipes");

    // get all recipe data
    app.get("/recipes", async (req, res) => {
      try {
        const result = await allRecipeCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // get recipe with id
    app.get("/recipes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID format" });

        const result = await allRecipeCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // post/add recipe
    app.post("/post-recipes", verifyJWT, async (req, res) => {
      try {
        const recipe = req.body;
        const email = recipe.authorEmail;

        const user = await usersCollection.findOne({ email });
        const recipeCount = await allRecipeCollection.countDocuments({
          authorEmail: email,
        });

        if (!user?.isPremium && recipeCount >= 2) {
          return res.status(403).send({
            message:
              "You have reached the free limit. Upgrade to Premium to add unlimited recipes.",
          });
        }

        const result = await allRecipeCollection.insertOne(recipe);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // get my-recipe
    app.get("/my-recipes", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        const result = await allRecipeCollection
          .find({ authorEmail: email })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // delete my-recipe
    app.delete("/recipes/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params; // Fixed bug here
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID format" });

        const result = await allRecipeCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // update/edit my-recipe
    app.patch("/recipes/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID format" });

        const result = await allRecipeCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // Toggle Like
    app.post("/recipes/:id/like", async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail } = req.body;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID format" });

        const existingLike = await recipeLikesCollection.findOne({
          recipeId: new ObjectId(id),
          userEmail,
        });

        if (existingLike) {
          await recipeLikesCollection.deleteOne({ _id: existingLike._id });
          await allRecipeCollection.updateOne(
            { _id: new ObjectId(id), likesCount: { $gt: 0 } },
            { $inc: { likesCount: -1 } },
          );

          const updatedRecipe = await allRecipeCollection.findOne({
            _id: new ObjectId(id),
          });
          return res.send({
            liked: false,
            likesCount: updatedRecipe.likesCount || 0,
          });
        }

        await recipeLikesCollection.insertOne({
          recipeId: new ObjectId(id),
          userEmail,
          createdAt: new Date(),
        });

        await allRecipeCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { likesCount: 1 } },
        );

        const updatedRecipe = await allRecipeCollection.findOne({
          _id: new ObjectId(id),
        });
        return res.send({
          liked: true,
          likesCount: updatedRecipe.likesCount || 0,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // Like Status
    app.get("/recipes/:id/like-status", async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail } = req.query;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID format" });

        const like = await recipeLikesCollection.findOne({
          recipeId: new ObjectId(id),
          userEmail,
        });
        res.send({ liked: !!like });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    //  Toggle Favorite
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
            {
              _id: new ObjectId(id),
              favoriteCount: { $gt: 0 },
            },
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

    // my-favorite
    app.get("/my-favorites", verifyJWT, async (req, res) => {
      const { userEmail } = req.query;

      const favorites = await recipeFavoritesCollection
        .find({ userEmail })
        .toArray();

      const recipeIds = favorites.map((item) => item.recipeId);

      const recipes = await allRecipeCollection
        .find({
          _id: { $in: recipeIds },
        })
        .toArray();

      res.send(recipes);
    });

    // purchases recipe
    app.get("/my-purchases", verifyJWT, async (req, res) => {
      try {
        const { userEmail } = req.query;
        const purchases = await recipePurchasesCollection
          .find({ userEmail })
          .toArray();
        if (purchases.length === 0) return res.send([]);

        const recipeIds = purchases.map((item) => item.recipeId);
        const recipes = await allRecipeCollection
          .find({ _id: { $in: recipeIds } })
          .toArray();
        res.send(recipes);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // user premium api
    app.post("/subscription", async (req, res) => {
      try {
        const { sessionId, userId, priceId } = req.body;
        if (!sessionId || !userId || !priceId) {
          return res
            .status(400)
            .send({ success: false, message: "Missing required fields" });
        }
        if (!ObjectId.isValid(userId))
          return res.status(400).send({ message: "Invalid User ID" });

        const isExist = await subscriptionsCollection.findOne({ sessionId });
        if (isExist) {
          return res
            .status(200)
            .send({ success: true, message: "Subscription already exists" });
        }

        const result = await subscriptionsCollection.insertOne({
          sessionId,
          userId,
          priceId,
          createdAt: new Date(),
        });

        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { isPremium: true } },
        );

        res.status(201).send({
          success: true,
          message: "Subscription added successfully",
          insertedId: result.insertedId,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // purchase recipe api
    app.post("/purchase-recipe-payment", async (req, res) => {
      try {
        const {
          sessionId,
          userId,
          recipeId,
          recipeName,
          authorName,
          recipeImage,
          price,
        } = req.body;
        if (!sessionId || !userId || !recipeId) {
          return res
            .status(400)
            .send({ success: false, message: "Missing required fields" });
        }

        const isExist = await purchasedRecipesCollection.findOne({ sessionId });
        if (isExist) {
          return res.status(200).send({
            success: true,
            message: "Recipe purchase already recorded",
          });
        }

        const result = await purchasedRecipesCollection.insertOne({
          sessionId,
          userId,
          recipeId,
          recipeName,
          authorName,
          recipeImage,
          price: Number(price),
          createdAt: new Date(),
        });

        res.status(201).send({
          success: true,
          message: "Recipe purchased successfully",
          insertedId: result.insertedId,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // get purchased recipe api
    app.get("/purchased-recipes/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const result = await purchasedRecipesCollection
          .find({ userId })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // admin dashboard overview api
    app.get("/admin/dashboard", verifyJWT, async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalRecipes = await allRecipeCollection.countDocuments();
        const totalPremiumMembers = await usersCollection.countDocuments({
          isPremium: true,
        });
        const totalReports = await reportsCollection.countDocuments();

        res.send({
          totalUsers,
          totalRecipes,
          totalPremiumMembers,
          totalReports,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // admin users list api
    app.get("/admin/users", verifyJWT, async (req, res) => {
      try {
        const users = await usersCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // user block api
    app.patch("/admin/users/block/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID" });

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isBlocked: true } },
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // user unblock api
    app.patch("/admin/users/unblock/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID" });

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isBlocked: false } },
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // manage recipe for admin api
    app.get("/admin/recipes", verifyJWT, async (req, res) => {
      try {
        const recipes = await allRecipeCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(recipes);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // delete recipe for admin api
    app.delete("/admin/recipes/:id", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID" });

        const result = await allRecipeCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({
          success: result.deletedCount > 0,
          message:
            result.deletedCount > 0
              ? "Recipe deleted successfully"
              : "Recipe not found",
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // recipe feature add and delete toggle
    app.patch("/recipes/:id/feature", verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;

        const featured = await featuredRecipesCollection.findOne({
          recipeId: id,
        });

        if (featured) {
          await featuredRecipesCollection.deleteOne({ recipeId: id });
          return res.send({
            success: true,
            featured: false,
            message: "Recipe removed from featured",
          });
        }

        if (!ObjectId.isValid(id))
          return res.status(400).send({ message: "Invalid ID" });
        const recipe = await allRecipeCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!recipe) {
          return res
            .status(404)
            .send({ success: false, message: "Recipe not found" });
        }

        await featuredRecipesCollection.insertOne({
          recipeId: id,
          ...recipe,
          featuredAt: new Date(),
        });

        res.send({
          success: true,
          featured: true,
          message: "Recipe added to featured",
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // get feature recipes
    app.get("/featured-recipes", async (req, res) => {
      try {
        const recipes = await featuredRecipesCollection
          .find()
          .sort({ featuredAt: -1 })
          .toArray();
        res.send(recipes);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });
  } catch (e) {
    console.log("Database connection error:", e);
  }
}

run();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
