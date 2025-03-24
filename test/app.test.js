// Filename: routes.test.js

const request = require('supertest');
const app = require('../app');
const app = require('../index');
const client = require('../db/client');

beforeAll(async () => {
});

afterAll(async () => {
  await client.end();
});

describe('POST /api/items', () => {
  it('creates a new item', async () => {
    const response = await request(app)
      .post('/api/items')
      .send({ name: 'Test Item', description: 'Test Description' });

    expect(response.statusCode).toBe(200);
    expect(response.body.name).toBe('Test Item');
  });
});

describe('GET /api/items/:itemId', () => {
  it('returns an item if found', async () => {
    const create = await request(app)
      .post('/api/items')
      .send({ name: 'Fetch Item', description: 'Fetch Description' });

    const itemId = create.body.id;
    const response = await request(app).get(`/api/items/${itemId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(itemId);
  });

  it('returns 404 if item not found', async () => {
    const response = await request(app).get('/api/items/99999');

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Item not found');
  });
});

describe('POST /api/users', () => {
  it('creates a new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ username: 'aaron', password: 'password1' });

    expect(response.statusCode).toBe(200);
    expect(response.body.username).toBe('testuser');
  });
});

describe('POST /api/login', () => {
  it('logs in a valid user', async () => {
    await request(app)
      .post('/api/users')
      .send({ username: 'aaron', password: 'password1' });

    const response = await request(app)
      .post('/api/login')
      .send({ username: 'aaron', password: 'password1' });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ username: 'wronguser', password: 'wrongpass' });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
  });
});

describe('GET /api/items', () => {
  it('returns all items', async () => {
    const response = await request(app).get('/api/items');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('GET /api/reviews/:reviewId/comments', () => {
  it('returns comments for a review', async () => {
    const reviewId = 1;
    const response = await request(app).get(`/api/reviews/${reviewId}/comments`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('POST /api/items/:itemId/reviews', () => {
  it('creates a review for an item', async () => {
    const itemRes = await request(app)
      .post('/api/items')
      .send({ name: 'Review Item', description: 'For review' });
    const itemId = itemRes.body.id;

    const response = await request(app)
      .post(`/api/items/${itemId}/reviews`)
      .send({ user_id: 1, rating: 5, text: 'Great!' });

    expect(response.statusCode).toBe(201);
    expect(response.body.rating).toBe(5);
  });
});

describe('DELETE /api/reviews/:reviewId', () => {
  it('deletes a review', async () => {
    const itemRes = await request(app)
      .post('/api/items')
      .send({ name: 'Delete Review Item', description: 'To be reviewed' });

    const reviewRes = await request(app)
      .post(`/api/items/${itemRes.body.id}/reviews`)
      .send({ user_id: 1, rating: 3, text: 'Decent' });

    const reviewId = reviewRes.body.id;
    const response = await request(app).delete(`/api/reviews/${reviewId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Review deleted');
  });
});
