require("dotenv").config()
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { client, createTables, createItem, fetchItems, createUser, seedData } = require('./db');

const express = require('express');

const app = express();
app.use(express.json());

const isLoggedIn = async (req, res, next) => {
    try {
        req.user = await findUserWithToken(req.headers.authorization);
        next();
    }
    catch (ex) {
        next(ex);
    }
};

app.post('/api/items', async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const newItem = await createItem({ name, description });
        res.send(newItem);
    } catch (ex) {
        console.error(ex)
        res.status(401).send({ error: ex });
    }
});

app.post('/api/users', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const newUser = await createUser({ username, password });
        res.send(newUser);
    } catch (ex) {
        console.error(ex)
        res.status(401).send({ error: ex });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials ' });
        }
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/items', async (req, res, next) => {
    try {
        const allItems = await fetchItems()
        res.send(allItems);
    }
    catch (ex) {
        console.error(ex)
        next(ex);
    }
});

app.get('/api/reviews/:reviewId/comments', async (req, res, next) => {
    try {
        const { reviewId } = req.params;

        const result = await client.query(
            'SELECT * FROM comments WHERE review_id = $1 ORDER BY created_at DESC',
            [reviewId]
        );

        res.send(result.rows);
    } catch (ex) {
        console.error(ex);
        next(ex);
    }
});


app.post('/api/items/:itemId/reviews', async (req, res) => {
    try {
        const { user_id, rating, text } = req.body;
        const { itemId } = req.params;

        if (!user_id || !itemId || !rating || !text) {
            return res.status(400).json({ error: 'missing required fields' });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'rating must be between 1 and 5' });
        }

        const result = await client.query(
            `INSERT INTO reviews ( user_id, items_id, rating, text )
            VALUES ( $1, $2, $3, $4 )
            RETURNING *`,
            [user_id, itemId, rating, text]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.constraint === 'unique_user_reviews') {
        }
        console.error(error);
        res.status(500).json({ error: 'server error ' });
    }
});
// module.exports = app;

app.post('/api/items/:itemId/reviews/:reviewsId/comments', isLoggedIn, async (req, res) => {
    try {
        const { user_id, text } = req.body;
        const { reviewId } = req.params;

        if (!user_id || !reviewId || !text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text cannot be empty' });
        }

        const result = await client.query(
            `INSERT INTO comments (user_id, review_id, text)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [user_id, reviewId, text]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/reviews/:reviewId', async (req, res) => {
    try {
        const { reviewId } = req.params;

        const result = await client.query('DELETE FROM reviews WHERE id = $1 RETURNING *', [reviewId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json({ message: 'Review deleted', review: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// make sure deleting a review, deletes its comments

const init = async () => {
    const port = process.env.PORT || 3000;
    await client.connect();
    console.log('connected to database');

    await createTables();
    console.log('tables created');

    await seedData();
    console.log('seed data inserted');


    app.listen(port, () => console.log(`listening on port ${port}`));
};


init();