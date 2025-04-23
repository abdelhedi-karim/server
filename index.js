const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');
const streamifier = require('streamifier');

// Create a new Express application
const app = express();

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON bodies
app.use(bodyParser.json());
// PostgreSQL connection setup


// PostgreSQL connection setup
const pool = new Pool({
    user: 'bet_owner',
    host: 'ep-summer-bar-a5df4uvy.us-east-2.aws.neon.tech',
    database: 'depanini',
    password: '4IR9VtcSeCiw', // Make sure this is a string
    port: 5432,
    ssl: {
        rejectUnauthorized: false, // Only for local testing with self-signed certificate
    }
});

// Handle connection errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

  // Enable pgcrypto extension at application startup
(async () => {
    try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
        console.log('pgcrypto extension enabled.');
    } catch (error) {
        console.error('Error enabling pgcrypto extension:', error);
    }
})();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');


// Configure Cloudinary with your credentials
cloudinary.config({
    cloud_name: 'dqmhtibfm',
    api_key: '886762692163818',
    api_secret: 'ZjcNiz60tB4zSs_ED_Dafs07FFk',
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads', // Folder where images will be stored in Cloudinary
        allowedFormats: ['jpg', 'png', 'jpeg'],
    },
});

const upload = multer({ storage });


app.get('/', (req, res) => {
    res.send('Hello, World! Your server is up and running.');
  });


  app.post('/biens', upload.array('images'), async (req, res) => {
    try {
      const { type_bien, localisation, prix, description, mode, user_id } = req.body;
      const imageUrls = req.files.map(file => file.path); // This is already a JS array of strings
  
      const result = await pool.query(
        `INSERT INTO biens (type_bien, localisation, prix, description, mode, user_id, images)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [type_bien, localisation, prix, description, mode, user_id, imageUrls] // pass array directly
      );
  
      res.status(201).json({ success: true, bien: result.rows[0] });
    } catch (error) {
      console.error('Error inserting bien:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });
  


app.get('/biens', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM biens');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch biens' });
    }
});

app.get('/biens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM biens WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bien not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch bien' });
    }
});

app.put('/biens/:id', upload.array('images', 10), async (req, res) => {
    try {
        const { id } = req.params;
        const { type_bien, localisation, prix, description, mode } = req.body;
        const images = req.files.map(file => file.path);

        const result = await pool.query(
            `UPDATE biens
             SET type_bien = $1,
                 localisation = $2,
                 prix = $3,
                 description = $4,
                 images = $5,
                 mode = $6
             WHERE id = $7
             RETURNING *`,
            [type_bien, localisation, prix, description, JSON.stringify(images), mode, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bien not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update bien' });
    }
});


app.delete('/biens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM biens WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bien not found' });
        }

        res.json({ message: 'Bien deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete bien' });
    }
});





// API endpoint to create a new user
app.post('/api/users', async (req, res) => {
    const { login, password, num } = req.body;

    // Basic input validation
    if (!login || !password || !num) {
        return res.status(400).json({ error: 'Missing required fields: login, password, and num are required.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO users (login, password, num) VALUES ($1, crypt($2, gen_salt(\'bf\')), $3) RETURNING *',
            [login, password, num]
        );

        // Respond with the created user data
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Handle unique constraint violation
            res.status(409).json({ error: 'A user with this login already exists.' });
        } else {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'An error occurred while creating the user. Please try again.' });
        }
    }
});




app.post('/api/authenticate', async (req, res) => {
    const { login, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT login FROM users WHERE login = $1 AND password = crypt($2, password)',
            [login, password]
        );
        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.status(200).json(user); // Return the user details
        } else {
            res.status(401).json({ error: 'Invalid login or password' });
        }
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});





// API endpoint to get all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.get('/api/users/:login', async (req, res) => {
    const { login } = req.params; // Get the login from request parameters
    try {
        const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.delete('/api/users/:login', async (req, res) => {
    const { login } = req.params; // Get the login from the request parameters
    
    try {
        const result = await pool.query('DELETE FROM users WHERE login = $1 RETURNING *', [login]);

        // Check if the user was deleted (if no rows were returned)
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // If successful, return a success message
        res.status(200).json({ message: 'User deleted successfully', deletedUser: result.rows[0] });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/comments', async (req, res) => {
    const { usercommante, user, comntaire } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO commantaire (usercommante, "user", comntaire)
            VALUES ($1, $2, $3)
            RETURNING *;
        `, [usercommante, user, comntaire]);

        res.status(201).json({ message: 'Comment added successfully', comment: result.rows[0] });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/comments', async (req, res) => {
    try {
        // Query to select all comments from the commantaire table
        const result = await pool.query('SELECT * FROM commantaire');
        
        // Send the result as a JSON response
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Route to handle user updates (img, spécialité, region, and num)
app.put('/api/user', upload.single('img'), async (req, res) => {
    const { login, region, specialite, num } = req.body;
    const img = req.file ? req.file.path : null; // Get the Cloudinary URL for the uploaded image

    console.log('Request Body:', { login, region, specialite, num, img });

    // Validate input
    if (!login) {
        return res.status(400).json({ error: 'Login is required.' });
    }

    try {
        // Update query (only update fields if they are provided)
        const result = await pool.query(
            `UPDATE users 
            SET 
                region = COALESCE($1, region), 
                specialite = COALESCE($2, specialite), 
                img = COALESCE($3, img), 
                num = COALESCE($4, num)
            WHERE login = $5
            RETURNING *`,
            [region || null, specialite || null, img ? JSON.stringify({ url: img }) : null, num || null, login]
        );

        // Check if the user exists
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.put('/api/user/admin', async (req, res) => { 
    const { login } = req.body;

    // Validate input
    if (!login) {
        return res.status(400).json({ error: 'Login is required.' });
    }

    try {
        // Update query to change admin from false to true
        const result = await pool.query(
            `UPDATE users 
            SET admin = true 
            WHERE login = $1 AND admin = false
            RETURNING *`,
            [login]
        );

        // Check if the user exists and if admin was actually updated
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found or already an admin.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/story', upload.single('img'), async (req, res) => {
    const { username } = req.body;
    const img = req.file ? req.file.path : null;

    console.log('Request Body:', { username, img });

    // Validate input
    if (!username || !img) {
        return res.status(400).json({ error: 'Username and Image are required.' });
    }

    try {
        // Insert query using the new column name 'username'
        const result = await pool.query(
            `INSERT INTO story (username, img) VALUES ($1, $2) RETURNING *`,
            [username, JSON.stringify({ url: img })]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




  app.get('/api/stories', async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM story ORDER BY username ASC`);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  app.delete('/api/story', async (req, res) => {
    const { imgUrl } = req.body;
  
    if (!imgUrl) {
      return res.status(400).json({ error: 'Image URL is required.' });
    }
  
    try {
      // Ensure imgUrl is properly quoted and handled
      const result = await pool.query(
        `DELETE FROM story WHERE img->>'url' = $1 RETURNING *`,
        [imgUrl]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Story not found.' });
      }
  
      res.status(200).json({ message: 'Story deleted successfully.' });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
   

// Create a new reservation
app.post('/reservations', async (req, res) => {
    try {
        const { location, name, phone, date, servicenow, region, service } = req.body;
        const newReservation = await pool.query(
            `INSERT INTO reservations (location, name, phone, date, servicenow, region, service)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [location, name, phone, date, servicenow, region, service]
        );
        res.json(newReservation.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get all reservations
app.get('/reservations', async (req, res) => {
    try {
        const allReservations = await pool.query('SELECT * FROM reservations');
        res.json(allReservations.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get a reservation by ID
app.get('/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const reservation = await pool.query('SELECT * FROM reservations WHERE id = $1', [id]);
        if (reservation.rows.length === 0) {
            return res.status(404).send('Reservation not found');
        }
        res.json(reservation.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Update a reservation
app.put('/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { location, name, phone, date, servicenow, region, service } = req.body;
        await pool.query(
            `UPDATE reservations SET location = $1, name = $2, phone = $3, date = $4, servicenow = $5, region = $6, service = $7 WHERE id = $8`,
            [location, name, phone, date, servicenow, region, service, id]
        );
        res.json('Reservation updated successfully');
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Delete a reservation
app.delete('/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM reservations WHERE id = $1', [id]);
        res.json('Reservation deleted successfully');
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});   


// Route to handle product creation
app.post('/api/produits', upload.single('img'), async (req, res) => {
    const { name, prix, description } = req.body;
    const img = req.file ? req.file.path : null;

    // Log request details for debugging
    console.log('Request Body:', { name, prix, description, img , username });

    // Validate input
    if (!name || !prix || !description || !img || !username) {
        return res.status(400).json({ error: 'All fields are required including the image.' });
    }

    try {
        // Insert query into the 'produits' table
        const result = await pool.query(
            `INSERT INTO produits (name, prix, description, img, username) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, prix, description, JSON.stringify({ url: img })]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});  

 

// Get all products
app.get('/api/produits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produits');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get one product by name and price
app.get('/api/produits/:name/:prix', async (req, res) => {
    const { name, prix } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM produits WHERE name = $1 AND prix = $2',
            [name, prix]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update a product by name and price (PUT)
app.put('/api/produits/:name/:prix', upload.single('img'), async (req, res) => {
    const { name, prix } = req.params;
    const { newName, newPrix, newDescription } = req.body;
    const img = req.file ? req.file.path : null;

    try {
        const result = await pool.query(
            'UPDATE produits SET name = $1, prix = $2, description = $3, img = $4 WHERE name = $5 AND prix = $6 RETURNING *',
            [newName || name, newPrix || prix, newDescription || '', JSON.stringify({ url: img }) || null, name, prix]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete a product by name and price (DELETE)
app.delete('/api/produits/:name/:prix', async (req, res) => {
    const { name, prix } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM produits WHERE name = $1 AND prix = $2 RETURNING *',
            [name, prix]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product deleted successfully', deletedProduct: result.rows[0] });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Add a new carte
app.post('/carte', async (req, res) => {
    try {
        const { name, prix, num, products, mail, adress, theuser } = req.body;

        // Insert new carte into the database
        const newCarte = await pool.query(
            `INSERT INTO public.carte (name, prix, num, products, mail, adress, theuser)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *;`,
            [name, prix, num, products, mail, adress, theuser]
        );

        // Send the inserted row back as the response
        res.json(newCarte.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}); 

// Route to handle offer creation
app.post('/api/offers', upload.single('img'), async (req, res) => {
    const { name, price, description, client } = req.body; // Destructure the incoming request body
    const img = req.file ? req.file.path : null; // Get image path if uploaded

    // Log request details for debugging
    console.log('Request Body:', { name, price, description, client, img });

    // Validate input
    if (!name || !price || !description || !client || !img) {
        return res.status(400).json({ error: 'All fields are required, including the image.' });
    }

    try {
        // Insert query into the 'offers' table
        const result = await pool.query(
            `INSERT INTO offers (name, price, description, img, clinet) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, price, description, JSON.stringify({ url: img }), client]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to get all offers
app.get('/api/offers', async (req, res) => {
    try {
      // Query to fetch all offers from the database
      const result = await pool.query('SELECT * FROM offers');
      
      // Send the fetched offers as a response
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching offers:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
 
  // Route to handle contact form submission
app.post('/api/contact', async (req, res) => {
    const { name, phone, mail, message } = req.body;
  
    // Validate input
    if (!name || !phone || !mail || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
  
    try {
      // Insert query into the 'contact' table
      const result = await pool.query(
        `INSERT INTO public.contact (name, phone, mail, message)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, phone, mail, message]
      );
  
      res.status(201).json({ success: 'Contact added successfully!', contact: result.rows[0] });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }); 
 // Route to handle adding a new reservation offer
app.post('/api/resoffers', async (req, res) => {
    const { resuser, nameoffre, price, desoffre, numuser } = req.body;
  
    // Validate input
    if (!resuser || !nameoffre || !price || !desoffre || !numuser) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
  
    try {
      // Insert query into the 'resoffer' table
      const result = await pool.query(
        `INSERT INTO resoffer (resuser, nameoffre, price, desoffre, numuser) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [resuser, nameoffre, price, desoffre, numuser]
      );
  
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error adding reservation offer:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// Create a new message
app.post('/api/messages', async (req, res) => {
    const { user1, user2, text } = req.body;

    try {
        const createdAt = new Date().toISOString(); // Use current date/time
        const result = await pool.query(
            'INSERT INTO msg (user1, user2, creatat, text) VALUES ($1, $2, $3, $4) RETURNING *',
            [user1, user2, createdAt, text]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all messages
app.get('/api/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM msg ORDER BY creatat DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get a specific message (by user1 and user2)
app.get('/api/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;

    try {
        const result = await pool.query('SELECT * FROM msg WHERE user1 = $1 AND user2 = $2 ORDER BY creatat DESC', [user1, user2]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete a message (by user1 and user2)
app.delete('/api/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;

    try {
        const result = await pool.query('DELETE FROM msg WHERE user1 = $1 AND user2 = $2 RETURNING *', [user1, user2]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update a message (you may want to update the text)
app.put('/api/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    const { text } = req.body;

    try {
        const result = await pool.query(
            'UPDATE msg SET text = $1 WHERE user1 = $2 AND user2 = $3 RETURNING *',
            [text, user1, user2]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
  // 📌 CREATE - Add a new product
app.post('/products', upload.single('img'), async (req, res) => {
    const { prix, description, gender, taille, color } = req.body;
    const imgUrl = req.file ? req.file.path : null;

    try {
        const result = await pool.query(
            `INSERT INTO public.akproduit (prix, description, gender, taille, color, img)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [prix, description, gender, taille, color, imgUrl]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 📌 READ - Get all products
app.get('/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.akproduit');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 📌 READ - Get a single product by ID
app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM public.akproduit WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 📌 UPDATE - Update a product
app.put('/products/:id', upload.single('img'), async (req, res) => {
    const { id } = req.params;
    const { prix, description, gender, taille, color } = req.body;
    const imgUrl = req.file ? req.file.path : null;

    try {
        const result = await pool.query(
            `UPDATE public.akproduit 
             SET prix = $1, description = $2, gender = $3, taille = $4, color = $5, img = $6
             WHERE id = $7 RETURNING *`,
            [prix, description, gender, taille, color, imgUrl, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 📌 DELETE - Delete a product
app.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM public.akproduit WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});
// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
