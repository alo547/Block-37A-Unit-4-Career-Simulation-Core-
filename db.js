require("dotenv").config()
const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL || 'postgres://aaronlopez@localhost/unit4_career_simulation');
const uuid = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const createTables = async () => {
  await client.query(`
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS items;
    DROP TABLE IF EXISTS users;
`);
  const SQL = `
    DROP TABLE IF EXISTS comments;
      DROP TABLE IF EXISTS reviews;
      DROP TABLE IF EXISTS items;
      DROP TABLE IF EXISTS users;

      CREATE TABLE users(
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
      CREATE TABLE items(
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL,
        description TEXT
      );
      CREATE TABLE reviews(
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        items_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
        rating INT CHECK (rating >= 1 AND rating <=5) NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE comments(
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        review_id UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
);
    `;
  await client.query(SQL);
};

const seedData = async () => {
  try {
    // Drop and recreate tables
    await createTables();

    // Seed Users
    const users = await Promise.all([
      createUser({ username: 'alice', password: 'password123' }),
      createUser({ username: 'bob', password: 'password123' }),
      createUser({ username: 'charlie', password: 'password123' }),
    ]);

    // Seed Items
    const items = await Promise.all([
      createItem({ name: 'Widget A', description: 'A basic widget for daily tasks.' }),
      createItem({ name: 'Gadget B', description: 'A powerful gadget with multiple uses.' }),
    ]);

    // Seed Reviews
    const SQL_INSERT_REVIEW = `
      INSERT INTO reviews(user_id, items_id, rating, text)
      VALUES($1, $2, $3, $4)
      RETURNING *;
    `;

    const reviews = [];

    const review1 = await client.query(SQL_INSERT_REVIEW, [
      users[0].id,
      items[0].id,
      5,
      'This widget is fantastic!'
    ]);
    reviews.push(review1.rows[0]);

    const review2 = await client.query(SQL_INSERT_REVIEW, [
      users[1].id,
      items[1].id,
      4,
      'Gadget B is pretty good, but has some flaws.'
    ]);
    reviews.push(review2.rows[0]);

    const SQL_INSERT_COMMENT = `
      INSERT INTO comments(user_id, review_id, text)
      VALUES($1, $2, $3)
      RETURNING *;
    `;

    await client.query(SQL_INSERT_COMMENT, [
      users[2].id,
      reviews[0].id,
      'I agree, Widget A is great!'
    ]);

    await client.query(SQL_INSERT_COMMENT, [
      users[0].id,
      reviews[1].id,
      'What flaws did you find?'
    ]);

    console.log('Seed data inserted successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
};

const createUser = async ({ username, password }) => {
  try {
    console.log(username)
    console.log(password)
    const hashedPassword = await bcrypt.hash(password, 10);
    const SQL = `
      INSERT INTO users (username, password)
      VALUES ($1, $2)
      RETURNING username, id;
    `;
    const values = [username, hashedPassword];
    const { rows } = await client.query(SQL, values);
    const user = rows[0];
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET);

    return { user, token, id: user.id };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

const createItem = async ({ name, description }) => {
  const SQL = `
      INSERT INTO items(name, description) VALUES($1, $2) RETURNING *;
    `;
  const response = await client.query(SQL, [name, description]);
  return response.rows[0];
};

const fetchItems = async () => {
  const SQL = `
      SELECT * FROM items;
    `;
  const response = await client.query(SQL);
  console.log(response)
  return response.rows[0];
};

module.exports = {
  client, createTables, createItem, fetchItems, createUser, seedData
}

// make sure all routes are there. do i have delete and login?