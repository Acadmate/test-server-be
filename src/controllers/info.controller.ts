import { ErrorType } from '../types/types';
import { Context } from 'hono';
import { fetchInfoData } from '../utils/fetchInfo';

export async function getInfo(
  c: Context,
): Promise<any> {
  try {
    const cookies = c.get('academiaCookies')
    
    if (!cookies || typeof cookies !== 'string') {
      return c.json({ 
        error: 'Authentication cookies not found in request context',
        type: ErrorType.AUTHENTICATION
      }, 400)
    }

    const result = await fetchInfoData(cookies)
    
    if (!result) {
      return c.json({ 
        success: false, 
        message: 'Failed to fetch attendance data' 
      });
    }
    
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in attendance controller:', error.message);
    return c.json({ 
      success: false, 
      message: 'Internal Server Error',
      error: error.message 
    });
  }
}