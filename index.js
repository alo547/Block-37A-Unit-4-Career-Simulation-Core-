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

app.get('/api/items/:itemId', async (req, res, next) => {
    try {
        const { itemId } = req.params;

        const result = await client.query(
            'SELECT * FROM items WHERE id = $1',
            [itemId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.send(result.rows[0]);
    } catch (ex) {
        console.error(ex);
        next(ex);
    }
});

// POST /api/auth/register
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

app.get('/api/auth/me', isLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await client.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
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

app.delete('/api/users/:userId/comments/:commentId', isLoggedIn, async (req, res) => {
    try {
        const { userId, commentId } = req.params;

        if (parseInt(userId) !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await client.query(
            'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING *',
            [commentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        res.json({ message: 'Comment deleted', comment: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/reviews/me', isLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await client.query(
            'SELECT * FROM reviews WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/comments/me', isLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await client.query(
            'SELECT * FROM comments WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/users/:userId/comments/:commentId', isLoggedIn, async (req, res) => {
    try {
        const { userId, commentId } = req.params;
        const { text } = req.body;

        if (parseInt(userId) !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const result = await client.query(
            `UPDATE comments SET text = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [text, commentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        res.json({ message: 'Comment updated', comment: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/items/:itemId/reviews/:reviewId', async (req, res) => {
    try {
        const { itemId, reviewId } = req.params;
        const result = await client.query(
            'SELECT * FROM reviews WHERE id = $1 AND items_id = $2',
            [reviewId, itemId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/users/:userId/reviews/:reviewId', async (req, res) => {
    try {
        const { userId, reviewId } = req.params;
        const { rating, text } = req.body;

        if (!rating || !text) {
            return res.status(400).json({ error: 'Rating and text are required' });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const reviewCheck = await client.query(
            'SELECT * FROM reviews WHERE id = $1 AND user_id = $2',
            [reviewId, userId]
        );

        if (reviewCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found or does not belong to the user' });
        }

        const result = await client.query(
            `UPDATE reviews
             SET rating = $1, text = $2, updated_at = NOW()
             WHERE id = $3 AND user_id = $4
             RETURNING *`,
            [rating, text, reviewId, userId]
        );

        res.json({ message: 'Review updated', review: result.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

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