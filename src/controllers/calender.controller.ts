import { Context } from 'hono';
import { updateCalendar } from '../utils/updateCalendar';
import { ErrorType } from '../types/types';

export async function getCalendar(c: Context): Promise<any> {
  try {
    const cookies = c.get('academiaCookies')

    if (!cookies || typeof cookies !== 'string') {
      return c.json({ 
        error: 'Authentication cookies not found in request context',
        type: ErrorType.AUTHENTICATION
      }, 400)
    }

    const result = await updateCalendar(cookies);

    if (!result.success) {
      return c.json({ 
        success: false, 
        message: result.error || 'Failed to fetch calendar data' 
      });
    }

    return c.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Error fetching calendar data:', error.message);
    return c.json({ 
      success: false, 
      message: 'Internal Server Error',
      error: error.message 
    });
  }
}
