// Try alternative cheerio import for Cloudflare Workers
import { load } from "cheerio";

function decodeHTMLEntities(text: string): string {
  const entityMap: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&hellip;": "…",
    "&mdash;": "—",
    "&ndash;": "–",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&bull;": "•",
    "&deg;": "°",
  };

  return (
    text
      .replace(/&[a-zA-Z]+;/g, (entity) => entityMap[entity] || entity)
      // Then handle numeric entities (decimal)
      .replace(/&#(\d+);/g, (match, dec) => {
        const num = parseInt(dec, 10);
        if (num >= 32 && num <= 126) {
          // Printable ASCII range
          return String.fromCharCode(num);
        }
        return match;
      })
      // Handle hex entities
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        const num = parseInt(hex, 16);
        if (num >= 32 && num <= 126) {
          // Printable ASCII range
          return String.fromCharCode(num);
        }
        return match;
      })
  );
}

const CAL_URL =
  "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Academic_Planner_2025_26_ODD";

export async function updateCalendar(cookies: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(CAL_URL, {
      method: "GET",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Cookie: cookies,
        Host: "academia.srmist.edu.in",
        Origin: "https://academia.srmist.edu.in",
        Referer: "https://academia.srmist.edu.in/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle different HTTP status codes
    switch (response.status) {
      case 200:
        break;
      case 401:
      case 403:
        return {
          success: false,
          error: "Authentication failed - please login again",
          statusCode: response.status,
        };
      case 404:
        return {
          success: false,
          error: "Calendar page not found - service may be unavailable",
          statusCode: 404,
        };
      case 429:
        return {
          success: false,
          error: "Too many requests - please try again later",
          statusCode: 429,
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          success: false,
          error: "Academia server is temporarily unavailable",
          statusCode: response.status,
        };
      default:
        return {
          success: false,
          error: `Unexpected server response: ${response.status}`,
          statusCode: response.status,
        };
    }

    const responseText = await response.text();

    // Check for login redirect
    if (responseText.includes("login") && responseText.includes("password")) {
      return {
        success: false,
        error: "Session expired - please login again",
        statusCode: 401,
      };
    }

    // Decode the HTML content using our custom decoder
    const decodedHTML = decodeHTMLEntities(responseText);

    const $ = load(decodedHTML);

    // Find the calendar table using the specific selector from working code
    const $calendarTable = $('table[bgcolor="#FAFCFE"]');

    if ($calendarTable.length === 0) {
      // Fallback: look for tables with calendar-like content
      const tables = $("table");
      let foundTable = false;

      tables.each((index, table) => {
        const $table = $(table);
        const tableText = $table.text();

        // Look for table containing calendar data
        if (
          tableText.includes("July") ||
          tableText.includes("August") ||
          tableText.includes("September") ||
          tableText.includes("October") ||
          tableText.includes("November") ||
          tableText.includes("December")
        ) {
          foundTable = true;
          return false;
        }
      });

      if (!foundTable) {
        return {
          success: false,
          error: "Calendar table not found in response",
        };
      }
    }

    // Parse the calendar table using the working code's approach
    const structuredData: string[][] = [];

    $calendarTable.find("tr").each((_rowIndex, row) => {
      const rowCells: string[] = [];
      $(row)
        .find("td")
        .each((_colIndex, cell) => {
          rowCells.push($(cell).text().trim());
        });
      if (rowCells.length > 0) {
        structuredData.push(rowCells);
      }
    });

    if (structuredData.length === 0) {
      return {
        success: false,
        error: "No calendar data found in table",
      };
    }

    // Initialize calendar using the working code's logic
    const numberOfMonths = 12;
    const year = 2025;
    const finalCalendar: Record<string, any[]> = {};

    for (let i = 6; i < numberOfMonths; i++) {
      const monthName = new Date(year, i).toLocaleString("default", {
        month: "long",
      });
      finalCalendar[monthName] = [];
    }

    // Parse data using the working code's exact logic
    structuredData.forEach((row) => {
      for (let i = 6; i < numberOfMonths; i++) {
        const baseIndex = (i - 6) * 5; // Working code uses 5 columns per month
        if (baseIndex + 4 >= row.length) {
          break;
        }

        const date = row[baseIndex] || "";
        const day = row[baseIndex + 1] || "";
        const event = row[baseIndex + 2] || "";
        const dayOrder = row[baseIndex + 3] || "";

        if (!date.trim()) {
          continue;
        }

        const monthName = new Date(year, i).toLocaleString("default", {
          month: "long",
        });

        finalCalendar[monthName].push({
          Date: date,
          Day: day,
          DayOrder: dayOrder,
          Event: event,
        });
      }
    });

    return {
      success: true,
      data: finalCalendar,
    };
  } catch (err) {
    console.error("Error fetching calendar data:", err);

    // Handle AbortError specifically
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: "Request timed out - please try again",
      };
    }

    return {
      success: false,
      error: `Failed to fetch calendar data: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    };
  }
}
