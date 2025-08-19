import { Hono } from 'hono';
import { Context } from 'hono'; 
import { auth, checkAuth } from '../controllers/auth.controller';
import { SignOut } from '../controllers/Signout.controller';
import { verifyToken } from '../middleware/verifyToken.middleware';

const authRoutes = new Hono();

authRoutes.post('/login', async (c: Context) => {
  return await auth(c);
});
authRoutes.post('/signout', async (c: Context) => {
  return await SignOut(c);
});
authRoutes.get('/checkAuth', verifyToken, async (c: Context) => {
  return await checkAuth(c);
});

export default authRoutes;
