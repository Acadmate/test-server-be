import { Context } from 'hono';
import { updateCalendar } from '../utils/updateCalendar';
import { ErrorType } from '../types/types';

function decodeEncodedString(encodedString: string): string {
  return encodedString.replace(
    /\\x([0-9A-Fa-f]{2})/g,
    (_, p1: string) => String.fromCharCode(parseInt(p1, 16))
  );
}

function extractDayOrder(text: string): number {
  const match = text.match(/Day Order:\s*([0-5]|No Day Order)/i);

  if (!match) return 0;

  const value = match[1].trim();
  return value === 'No Day Order' ? 0 : parseInt(value);
}

export async function Order(c: Context) {
  try {
    const cookies = c.get('academiaCookies')
    
    if (!cookies || typeof cookies !== 'string') {
      return c.json({ 
        error: 'Authentication cookies not found in request context',
        type: ErrorType.AUTHENTICATION
      }, 400)
    }

    let dayOrder: number | null = null;

    // 1. Try fetching from main WELCOME page
    try {
      const orderResp = await fetch(
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/WELCOME',
        {
          headers: {
            Accept: '*/*',
            Cookie: cookies,
            Host: 'academia.srmist.edu.in',
            Referer: 'https://academia.srmist.edu.in/',
          },
        }
      );

      if (orderResp.status === 200) {
        const decodedHTML = decodeEncodedString(await orderResp.text());
        dayOrder = extractDayOrder(decodedHTML);
      }
    } catch (err) {
      console.warn('Failed to fetch from WELCOME page, will try calendar as fallback.');
    }

    // 2. If still not found, fallback to calendar
    if (dayOrder === null) {
      const calendarData = await updateCalendar(cookies);
      const today = new Date();

      const monthName = today.toLocaleString('en-US', { month: 'long' });
      const date = today.getDate().toString();

      const todayEntry = calendarData?.[monthName]?.find((entry: any) => entry.Date === date);

      if (todayEntry) {
        const rawOrder = todayEntry.DayOrder;
        if (rawOrder && rawOrder !== '-') {
          dayOrder = parseInt(rawOrder);
        }
      }
    }

    // 3. Final response
    if (dayOrder !== null && !isNaN(dayOrder)) {
      return c.json({ dayOrder });
    } else {
      return c.json({ error: 'Day Order not found from WELCOME or calendar' });
    }

  } catch (error) {
    console.error('Error fetching Day Order:', error);
    return c.json({ error: 'Internal server error while fetching Day Order' });
  }
}
