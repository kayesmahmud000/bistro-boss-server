require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt= require('jsonwebtoken')
const port = process.env.PORT || 5000
const app = express()
const stripe= require('stripe')(process.env.SPRITE_SECRET_KEY)

//

//

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId, Admin } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.crgmj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const menuCollection =client.db("BistroDB").collection("menuCollection")
    const cartCollection =client.db("BistroDB").collection("cartCollection")
    const userCollection =client.db("BistroDB").collection("users")
    const paymentCollection =client.db("BistroDB").collection("payments")


    // middleware
    const verifyToken= (req, res, next)=>{
      console.log("token", req.headers)

      if(!req.headers.authorization){
        return res.status(403).send({massage: "unauthorized access"})
      }
      const token =req.headers.authorization.split(' ')[1]

      jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded)=> {
        // err
        if(err){
          return res.status(401).send({massage: "forbidden access"})
        }
        // decoded undefined
        req.decoded = decoded
        next()
      });
     
    }

    const verifyAdmin=async (req, res, next)=>{
      const email = req.decoded.email
      const query= {email: email}
      const user= await userCollection.findOne(query)
      const isAdmin =user?.role ==="admin"
      if(!isAdmin){
        return res.status(403).send({massage:"forbidden access"})
      }
      next()
    }

    // jwt api

    app.post("/jwt", async(req, res)=>{
      const user= req.body
      const token =jwt.sign( user, process.env.SECRET_TOKEN, {expiresIn:"5h"})
      res.send({token})
    })
    app.get("/users", verifyToken, verifyAdmin,  async(req, res)=>{
      
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get("/users/admin/:email", verifyToken, async(req, res)=>{
      const email= req.params.email
      console.log(email)
      console.log(req.decoded.email)
      if(email !== req.decoded.email){
        return res.status(403).send({massage : "unauthorized access"})
      }
      const query ={email: email}
      console.log("email", query)

      const user =await userCollection.findOne(query)
      console.log("user",user)
      let admin= false
       if(user){
        admin = user?.role ==="admin"
      }
      console.log("admin", admin)
      res.send({admin})
    })
    app.post("/users", async(req, res)=>{
      const user= req.body
      const query = {email: user.email}
      const existingUser= await userCollection.findOne(query)
      if(existingUser){
        return res.send({massage : "user already exist" , insertedId: null})
      }
      const result =await userCollection.insertOne(user)
      res.send(result)
    })

    app.delete("/users/:id", verifyToken, verifyAdmin, async(req, res)=>{
      const id= req.params.id
      const query= {_id: new ObjectId(id)} 
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async(req, res)=>{
      const id= req.params.id
      const filter= { _id: new ObjectId(id)}
      const updateDoc= {
        $set: {
          role : 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    
    // menu api
    app.get("/menu", async(req, res)=>{
        const result= await menuCollection.find().toArray()
        res.send(result) 
    })
    app.get('/menu/:id', async(req, res)=>{
      const id= req.params.id
      const query= {_id: new ObjectId(id)}
      const result= await menuCollection.findOne(query)
      res.send(result)
    })
    app.post("/menu", verifyToken, verifyAdmin, async(req, res)=>{

      const menuItem= req.body
      const result= await menuCollection.insertOne(menuItem)
      res.send(result)

    })
    app.patch('/menu/:id', async(req, res)=>{
      const id= req.params.id
      const newItem= req.body
      const filter= {_id: new ObjectId(id)}
      const updateItem={
        $set:{
          name: newItem.name, 
          category:newItem.category,
          price: newItem.price,
          recipe:newItem.recipe
        }
      }
      const result= await menuCollection.updateOne(filter, updateItem)
      res.send(result)
    })

   
    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id= req.params.id
      console.log("Menu id", id)
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
       res.send(result)
    })
    // app.get('/menuItem' , async(req, res)=>{
    //   const email=req.query
    //   console.log(email)
    // })

    app.get("/carts", async(req, res)=>{
      const email =req.query?.email
      const query ={email: email}
      const result= await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post("/carts", async(req , res)=>{
      const cart= req.body
      const result = await cartCollection.insertOne(cart)
      res.send(result)
    })
    app.delete("/carts/:id", async(req, res)=>{
      const id =req.params.id
      const query ={_id : new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    app.post("/create-payment-intent", async(req, res)=>{
      const {price}= req.body
      const amount = parseInt(price* 100)
      const paymentIntent= await  stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:['card']
      })
      res.send({
        client_secret: paymentIntent.client_secret
      })
    })
    app.get("/paymentHistory/:email", verifyToken, async(req, res)=>{
      const query= {email : req.params.email}
      if(req.params.email !== req.decoded.email){

        return res.status(403).send({massage:" forbidden access"})
      }
      const result= await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post("/payment", async(req, res)=>{
      const payment= req.body
      const result= await paymentCollection.insertOne(payment)
      console.log("payment", payment)
      const query = {_id:{
        $in: payment.cartId.map(id =>new ObjectId(id))
      }}
      const deleteResult= await cartCollection.deleteMany(query)

      res.send( {result, deleteResult })
    }) 

    app.get("/admin-stats",verifyToken, verifyAdmin, async(req, res)=>{

      const user= await userCollection.estimatedDocumentCount()
      const menuItem= await menuCollection.estimatedDocumentCount()
      const orders= await paymentCollection.estimatedDocumentCount()
      // const payment= await paymentCollection.find().toArray()
      //  const revenue= payment.reduce((total, item)=>total + item.price,0)

      const result= await paymentCollection.aggregate([
        {
          $group:{
            _id: null,
            totalRevenue: {
              $sum: "$price"
            }
          }
        }
      ]).toArray()

      const revenue= result.length>0 ? result[0].totalRevenue :0
      res.send({user, menuItem,orders, revenue})
    })

    // order stat api 

    app.get("/order-stats", verifyToken, verifyAdmin, async(req, res)=>{
      const result= await paymentCollection.aggregate([
       {
        $unwind: '$menuId'
       },
       {
        $lookup: {
          from :"menuCollection",
          localField :"menuId",
          foreignField: '_id',
          as: "menuItems"
        }
       },
       {
        $unwind: "$menuItems"
       },
       {
        $group :{
          _id: "$menuItems.category",
          quantity: {
            $sum:1
          },
          revenue: {
            $sum: "$menuItems.price"
          }
        }
       },
       {
        $project:{
          _id: 0,
          category: "$_id",
          quantity: "$quantity",
          revenue: "$revenue"

        }
       }
      ]).toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req , res)=>{
    res.send("Bistro Boss is Busy Now")
})

app.listen(port, ()=>{
    console.log(`Bistro boss is running on port ${port}`)
})