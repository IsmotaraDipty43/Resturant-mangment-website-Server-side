const express = require('express')
const app = express();
const cors = require("cors");
require("dotenv").config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;


app.use(cors({

  origin: ['http://localhost:5173', 'https://bistro-boss-86203.web.app', 'https://bistro-boss-86203.firebaseapp.com'], 
}
));


app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xsfs6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();
    const MenuCollection = client.db('bistroDb').collection('menu')
    const reviewCollection = client.db('bistroDb').collection('reviews')
    const CartCollection = client.db('bistroDb').collection('carts')
    const userCollection = client.db('bistroDb').collection('users')



    app.post('/jwt', async (req, res) => {
      const user = req.body; 
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });
    

const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  // Check if the Authorization header exists
  if (!authorization) {
    return res.status(401).send({ message: 'Authorization header missing' });
  }

  // Extract the token from the Authorization header
  const token = authorization.split(' ')[1];

  // If token is missing after split
  if (!token) {
    return res.status(401).send({ message: 'Token missing' });
  }

  // Verify the token with JWT
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: 'Invalid or expired token' });
    }

    // Attach the decoded information to the request object
    req.decoded = decoded;
    next(); // Proceed to the next middleware or route handler
  });
};

const verifyAdmin = async(req,res,next)=>{
  const email = req.decoded.email;
  const query ={email : email}
  const user  = await userCollection.findOne(query)
  const isAdmin = user?.role === 'Admin';
  if(!isAdmin){
    return res.status(403).send({message: 'forbiden axxess'})
  }
  next()
}
















app.get('/users', verifyToken, verifyAdmin,  async(req,res)=>{

  const result =await userCollection.find().toArray()
  res.send(result)
})

app.get('/users/adminuser/:email', verifyToken, verifyAdmin, async (req, res) => {
  const email = req.params.email;

       

  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Unauthorized error' });
  }

  const query = { email: email };
  const user = await userCollection.findOne(query);
    let admin = false;
       if(user){
        admin = user?.role === 'Admin'
       }
  res.send({ admin });
});









// Promote user to admin
app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;

  const filter = { _id: new ObjectId(id) };
  const update = {
    $set: {
      role: 'Admin',
    },
  };

  const result = await userCollection.updateOne(filter, update);
  res.send(result);
});


app.delete('/users/:id', verifyToken, verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await userCollection.deleteOne(query)
  res.send(result)
})

app.post('/users', async(req,res)=>{
  const userData=req.body;
  const query = {email: userData.email}
  const existingUser = await userCollection.findOne(query)
  if(existingUser){
    return res.send({message:'user already existed', insertedId: null})
  }
  const result = await userCollection.insertOne(userData)
  res.send(result);
})

app.get('/menu',async(req,res)=>{
    const result=await MenuCollection.find().toArray()
    res.send(result)
})
app.post('/menu',verifyToken, verifyAdmin, async(req,res)=>{
  const menuItem = req.body;
  const result = await MenuCollection.insertOne(menuItem)
  res.send(result)
})


app.delete('/menu/user/delete/:id', verifyToken, verifyAdmin, async (req, res) =>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await MenuCollection.deleteOne(query)
  res.send(result)
})

app.get('/menu/:id',async (req,res) =>{
  const id = req.params.id;
  const query ={ _id : new ObjectId(id)}
  const result =  await MenuCollection.findOne(query)
  res.send(result)
})

app.patch('/menu/update/:id', async (req, res)=>{
  const item = req.body;
  const id = req.params.id;
  const filter = { _id: new ObjectId(id)}
  const updatedDoc={
    $set: {
      name: item.name,
      category: item.category,
      recipe: item.recipe,
      price: item.price,
      image: item.image
    }
  }
  const result  = await MenuCollection.updateOne(filter, updatedDoc)
  res.send(result)


})









app.get('/review',async(req,res)=>{
  const result=await reviewCollection.find().toArray()
  res.send(result)
})


app.post('/carts', async(req,res)=>{
  const cartItem = req.body; 

  const result = await CartCollection.insertOne(cartItem)
  res.send(result)
})


app.get('/carts', async(req,res)=>{
  const email = req.query.email;
  const query = {email:email}
const result = await CartCollection.find(query).toArray()
res.send(result)
})

app.delete('/carts/:id', async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await CartCollection.deleteOne(query)
  res.send(result)
})



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




















app.get('/', (req,res)=>{
    res.send('bistro-boss-sitting')
})
app.listen(port, ()=>{
    console.log(`bistro-boss is setting in the ${port}`);
})