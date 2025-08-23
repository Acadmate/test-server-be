import * as cheerio from 'cheerio';
import { TimeTableEntry } from '../types/types';

function decodeEncodedString(encodedString: string): string {
  return encodedString.replace(
    /\\x([0-9A-Fa-f]{2})/g,
    (_, p1: string) => String.fromCharCode(parseInt(p1, 16)),
  );
}

function extractTextBetweenWords(
  text: string,
  startWord: string,
  endWord: string,
): string | null {
  const startIndex = text.indexOf(startWord);
  const endIndex = text.indexOf(endWord);
  
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    return text.substring(startIndex + startWord.length, endIndex).trim();
  }
  
  return null;
}

export const updateUnifiedtt = async (
  cookies: string,
  batchNumber: number,
): Promise<TimeTableEntry[] | undefined> => {
  try {
    if (!batchNumber || !cookies) {
      throw new Error('Batch number and authentication cookies are required');
    }
    if (isNaN(batchNumber) || batchNumber < 1 || batchNumber > 2) {
      throw new Error('Invalid batch number. Batch must be either 1 or 2');
    }

    // Determine which URL to use based on batch number
    const unifiedTimeTableUrl = batchNumber === 1
      ? 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Unified_Time_Table_2025_Batch_1'
      : 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Unified_Time_Table_2025_batch_2';

    // Make the request to get the unified timetable
    const response = await fetch(unifiedTimeTableUrl, {
      headers: {
        Accept: '*/*',
        Cookie: cookies,
        Host: 'academia.srmist.edu.in',
        Origin: 'https://academia.srmist.edu.in',
        Referer: 'https://academia.srmist.edu.in/',
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch unified timetable: ${response.status}`);
    }

    // Decode the HTML response
    const decodedHTML = decodeEncodedString(await response.text());
    const extractedHTML = extractTextBetweenWords(
      decodedHTML,
      '</style>\n',
      "');function doaction(recType) { }</script>",
    );

    if (!extractedHTML) {
      throw new Error('Failed to extract timetable data from response');
    }

    // Load the HTML into cheerio
    const $ = cheerio.load(extractedHTML);
    const timeTableEntries: TimeTableEntry[] = [];

    // Look for table rows that contain day information
    $('tr').each((_, element) => {
      const cells = $(element).find('td');
      
      if (cells.length > 0) {
        const dayCell = $(cells[0]).text().trim();
        
        // Skip if this isn't a day row
        if (!dayCell.startsWith('Day')) {
          return;
        }
        
        // Extract period information
        const periods: { period: string; timeSlot: string }[] = [];
        
        // Get header row for time slots
        const headerRow = $('tr').first();
        
        cells.each((i, cell) => {
          if (i > 0) { // Skip the first cell (day column)
            const period = $(cell).text().trim();
            // Get corresponding time slot from the header row
            const timeSlot = $(headerRow).find('td').eq(i).text().trim();
            
            if (period) {
              periods.push({ period, timeSlot });
            }
          }
        });
        
        // Add this day's schedule to the results
        if (periods.length > 0) {
          timeTableEntries.push({ day: dayCell, periods });
        }
      }
    });

    if (timeTableEntries.length === 0) {
      throw new Error('Failed to extract any timetable entries');
    }
    return timeTableEntries;
  } catch (error) {
    console.error('Failed to update unified timetable:', error);
    throw error;
  }
};