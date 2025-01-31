const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const axios = require('axios');
const express = require('express')
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const app = express();
const cors = require("cors");
require("dotenv").config()
const jwt = require('jsonwebtoken');

const stripe=require('stripe')(process.env.SECRECT_KEY_STRIPE)
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAIL_GUN_API_KEY,
});
const port = process.env.PORT || 5001;


app.use(cors({

  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://bistro-boss-86203.web.app', 'https://bistro-boss-86203.firebaseapp.com'], 
}
));


app.use(express.json())

app.use(express.urlencoded())



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
    // await client.connect();
    const MenuCollection = client.db('bistroDb').collection('menu')
    const reviewCollection = client.db('bistroDb').collection('reviews')
    const CartCollection = client.db('bistroDb').collection('carts')
    const userCollection = client.db('bistroDb').collection('users')
    const PaymentCollection = client.db('bistroDb').collection('payment')



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





//ssl payment



app.post("/creat-ssl-payment", async (req, res) => {
  const payment = req.body;
  console.log("paymentinfo", payment);

  if (!payment.price || !payment.email) {
    return res.status(400).json({ error: "Price and email are required" });
  }

  const trxId = new ObjectId().toString();
  payment.transactionId= trxId;
  const initiate = {
    store_id: "bistr679b281161c47",
    store_passwd: "bistr679b281161c47@ssl",
    total_amount: payment.price,
    currency: 'BDT',
    tran_id: trxId, // use unique tran_id for each API call
    success_url: 'https://bistro-boss-server-nine-jade.vercel.app/success-payment',
    fail_url: 'http://localhost:5173/fail',
    cancel_url: 'http://localhost:5173/cancel',
    ipn_url: 'https://bistro-boss-server-nine-jade.vercel.app/ipn-success-payment',
    cus_name: 'Customer Name',
    cus_email: payment.email,
    cus_add1: 'Dhaka',
    cus_add2: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    cus_fax: '01711111111',
    ship_name: 'Customer Name',
    ship_add1: 'Dhaka',
    ship_add2: 'Dhaka',
    ship_city: 'Dhaka',
    ship_state: 'Dhaka',
    ship_postcode: 1000,
    ship_country: 'Bangladesh',
    shipping_method: 'Courier',
    product_name: 'Computer.',
    product_category: 'Electronic',
    product_profile: 'general',
  };

  try {
    const iniResponse = await axios({
      url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
      method: "POST",
      data: initiate,
      headers: {
        "Content-type": "application/x-www-form-urlencoded"
      }
    });

    const savedata = await PaymentCollection.insertOne(payment)
    const gatewayUrl = iniResponse?.data?.GatewayPageURL;
    console.log(gatewayUrl);
    res.send({gatewayUrl})
  
    // console.log(iniResponse.data, "iniResponse");
  
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Payment initiation failed." });
  }
});

app.post("/success-payment", async (req, res) => {
  //sucess data
   const paymentSucess = req.body;
  //  console.log("sucess", paymentSucess);
  //validation
   const {data} = await axios.get(`https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSucess.val_id}&store_id=bistr679b281161c47&store_passwd=bistr679b281161c47@ssl&format=json`)
  
   if(data.status !== "VALID"){
   return res.send({message: 'Invalid Payment'})
   }
   //update the payment
   const update = await PaymentCollection.updateOne({transactionId:data.tran_id},{
    $set:{
      status:"success"
    },
   })
   const payment = await PaymentCollection.findOne({transactionId:data.tran_id})
   const query = {
    _id: {
      $in:payment.cartIds.map((id)=>new ObjectId(id))
    }
   }
   const deleteResult = await CartCollection.deleteMany(query)
   res.redirect('https://bistro-boss-86203.web.app/success')
   console.log(update);
})










app.get('/users', verifyToken, async(req,res)=>{

  const result =await userCollection.find().toArray()
  res.send(result)
})

app.get('/users/adminuser/:email', verifyToken,  async (req, res) => {
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
app.patch('/users/admin/:id', verifyToken,verifyToken,  async (req, res) => {
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


app.delete('/users/:id', verifyToken,verifyToken, async(req,res)=>{
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


app.delete('/menu/user/delete/:id', verifyToken, verifyToken, async (req, res) =>{
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

app.patch('/menu/update/:id',verifyToken,verifyAdmin, async (req, res)=>{
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
app.post('/reviews', async (req, res) => {
  const { name, details, rating } = req.body;

  if (!name || !details || !rating) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {
      const reviewData = { name, details, rating };

      const result = await reviewCollection.insertOne(reviewData);

      if (result.insertedId) {
          res.status(201).json({ message: 'Review added successfully' });
      } else {
          res.status(500).json({ message: 'Failed to add review' });
      }
  } catch (error) {
      console.error('Error adding review:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});



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


//payment-endpoint
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { price } = req.body;
    const amount = parseInt(price * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ client_secret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).send({ error: 'Failed to create payment intent' });
  }
});


app.post('/payments', async(req,res)=>{
  const payment = req.body;
   const Paymentresult=await PaymentCollection.insertOne(payment)

   //carefully delete the each item from the cart

   const query = {_id:{
    $in:payment.cartIds.map(id=>new ObjectId(id))
   }}
   const deletResult = await CartCollection.deleteMany(query)
   //send user a payment email
//    mg.messages.create(process.env.MAIL_GUN_SEND_DOMAIN, {
//     from: 'Mailgun Sandbos <postmaster@sandboxc76b36ab349048eca858128ff493cf3e.mailgun.org>',
//     to: ['ismotaradipty81@gmail.com'],
//     subject: 'Bistro Boss confirmation of ordering',
//     text: 'Testing Mailgun.js!',
//     html:`
//     <div>
//     <h2>Thank You for the ordering.</h2>
//     <h4>Your Transaction Id:<strong>${payment.transactionId}</strong></h4>
//     <p>We would like to get your feedbaxk about the food.</p>
//     </div>
//     `
// })
// .then((response) => {
//     console.log('Email sent successfully:', response);
// })
// .catch((error) => {
//     console.error('Error sending email:', error);
// });
   res.send({Paymentresult, deletResult});


})

app.get('/payments/:email', verifyToken, async (req, res) => {
  const email = req.params.email;

  // Verify if the email matches the decoded token
  if (email !== req.decoded.email) {
      return res.status(403).send({ message: 'Forbidden access' });
  }

  // Query the database for payments
  const query = { email: email };
  const result = await PaymentCollection.find(query).toArray();

  res.send(result);
});


//stats or analyties

app.get('/admin-stats', verifyToken,verifyAdmin, async(req,res)=>{
  const  user = await userCollection.estimatedDocumentCount();
  const menuItem = await  MenuCollection.estimatedDocumentCount();
  const order = await PaymentCollection.estimatedDocumentCount();
const result = await PaymentCollection.aggregate([
  {
    $group:{
      _id: null,
      totalRevenue:{
        $sum: '$price'
      }
    }
  }
]).toArray()
const Revenue = result.length>0 ?result[0].totalRevenue:0;

  res.send({
    user,
    menuItem,
    order,
    Revenue 
  })
})




// using agregate pipeline 



app.get('/order-stats', async (req, res) => {
  const result = await PaymentCollection.aggregate([
    {
      $unwind: '$menuItemIds',
    },
    {
      $addFields: {
        menuItemIds: { $toObjectId: '$menuItemIds' }, // Convert menuItemIds to ObjectId
      },
    },
    {
      $lookup: {
        from: 'menu',
        localField: 'menuItemIds',
        foreignField: '_id',
        as: 'menuItems',
      },
    },
    {
      $unwind: '$menuItems',
    },
    {
      $group: {
        _id: '$menuItems.category',
        quantity: {
          $sum: 1,
        },
        revenue: {$sum:'$menuItems.price'}
      },

    },
    {
      $project:{
        _id: 0,
        category: '$_id',
        quantity:'$quantity',
        revenue: '$revenue'
      }
    }
  ]).toArray();

  res.send(result);
});





















    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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