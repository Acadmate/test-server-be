import { Hono } from 'hono';
import { getAttendance } from '../controllers/attendance.controller';
import { TimeTable } from '../controllers/timetable.controller';
import { getCalendar } from '../controllers/calender.controller';
import { Order } from '../controllers/dayorder.controller';
import { verifyToken } from '../middleware/verifyToken.middleware';
import { Context } from 'hono';
import { getInfo } from '../controllers/info.controller';
import { DocumentsController } from '../controllers/documents.controller.ts';

const userRoutes = new Hono();

userRoutes.get('/attendance', verifyToken, async (c: Context) => {
  return await getAttendance(c);
});

userRoutes.get('/info', verifyToken, async (c: Context) => {
  return await getInfo(c);
});

userRoutes.get('/timetable', verifyToken, async (c: Context) => {
  const batchStr = c.req.query('batch');
  const batch = batchStr ? parseInt(batchStr, 10) : 1;
  if (isNaN(batch)) {
    return c.json({ error: 'Invalid batch number provided' }, 400);
  }
  return await TimeTable(c, batch);
});

userRoutes.get('/calendar', verifyToken, async (c: Context) => {
  return await getCalendar(c);
});

userRoutes.get('/order', verifyToken, async (c: Context) => {
  return await Order(c);
});

userRoutes.get("/documents", verifyToken, async (c: Context) => {
  return await DocumentsController.listRoot(c);
});

userRoutes.get("/documents/:path{.+}", verifyToken, async (c: Context) => {
  return await DocumentsController.listByPath(c);
});

export default userRoutes;
