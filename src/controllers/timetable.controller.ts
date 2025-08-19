import { Context } from 'hono';
import generateTimetable from '../utils/generateTimetable';
import { ErrorType } from '../types/types';

export async function TimeTable(c: Context, batch: number) {
  try {
    const cookies = c.get('academiaCookies')
    
    if (!cookies || typeof cookies !== 'string') {
      return c.json({ 
        error: 'Authentication cookies not found in request context',
        type: ErrorType.AUTHENTICATION
      }, 400)
    }

    const result = await generateTimetable(cookies, batch)
    
    if (!result) {
      return c.json({ 
        success: false, 
        message: 'Failed to generate timetable' 
      });
    }
    
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ error: 'Server error while processing timetable request' });
  }
}