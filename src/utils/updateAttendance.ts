import { FetchResult, TestScore } from "../types/types";
import { AttendanceData } from "../types/types";
import { decodeEncodedString } from "./common";
import { extractTextBetweenWords } from "./common";
import * as cheerio from "cheerio";
import { AttendanceRecord, MarksRecord } from "../types/types";

function parseTestPerformance(performance: string): TestScore {
  const tests: TestScore = {};
  // Look for patterns like "CAT1/50.00/60.00" or similar test score formats
  const performancePattern = /([A-Za-z0-9-]+)\/(\d+\.\d{2})(\d+\.\d+)/g;
  let match;

  while ((match = performancePattern.exec(performance)) !== null) {
    const testName = match[1];
    const scores = [parseFloat(match[2]), parseFloat(match[3])];
    tests[testName] = scores;
  }

  return tests;
}

function parseAttendanceHTML(htmlData: string): AttendanceData | undefined {
  try {
    if (!htmlData || typeof htmlData !== "string") {
      throw new Error("Invalid HTML data provided");
    }

    const decodedHTML = decodeEncodedString(htmlData);
    const result = extractTextBetweenWords(
      decodedHTML,
      "</style>\n",
      "');function doaction(recType) { }</script>"
    );

    if (!result) {
      // Try alternative extraction patterns
      const alternativeResult = extractTextBetweenWords(
        decodedHTML,
        '<div class="cntdDiv">',
        "</div></div></body>"
      );

      if (!alternativeResult) {
        throw new Error("Could not extract content from HTML");
      }
    }

    const contentToParse = result || decodedHTML;
    const $ = cheerio.load(contentToParse);

    const attendanceData: AttendanceData = {
      user: [],
      attendance: [],
      marks: [],
    };

    const userSelectors = [
      "div.cntdDiv > div > table:nth-child(2) > tbody > tr",
      'table:contains("Registration Number") tbody tr',
      ".student-info tr",
    ];

    for (const selector of userSelectors) {
      const rows = $(selector);
      if (rows.length > 0) {
        rows.each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const key = $(cells[0]).text().trim();
            const value = $(cells[1]).text().trim();
            if (key && value) {
              attendanceData.user.push({ [key]: value });
            }
          }
        });
        break;
      }
    }

    // Parse attendance information with multiple selector fallbacks
    const attendanceSelectors = [
      "div.cntdDiv > div > table:nth-child(4) > tbody > tr",
      'table:contains("Attendance %") tbody tr',
      ".attendance-table tbody tr",
    ];

    const attendanceHeadings = [
      "Course Code",
      "Course Title",
      "Category",
      "Faculty Name",
      "Slot",
      "Room No",
      "Hours Conducted",
      "Hours Absent",
      "Attn %",
    ];

    for (const selector of attendanceSelectors) {
      const rows = $(selector).slice(1); // Skip header
      if (rows.length > 0) {
        rows.each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= attendanceHeadings.length) {
            const courseData: Partial<AttendanceRecord> = {};

            cells.each((index, cell) => {
              if (index < attendanceHeadings.length) {
                const heading = attendanceHeadings[
                  index
                ] as keyof AttendanceRecord;
                const value = $(cell).text().trim();
                courseData[heading] = value;
              }
            });

            // Validate required fields
            if (courseData["Course Code"] && courseData["Course Title"]) {
              attendanceData.attendance.push(courseData as AttendanceRecord);
            }
          }
        });
        break;
      }
    }

    // Parse marks information with fallbacks
    const marksSelectors = [
      "div.cntdDiv > div > table:nth-child(7) > tbody > tr",
      'table:contains("Test Performance") tbody tr',
      ".marks-table tbody tr",
    ];

    for (const selector of marksSelectors) {
      const rows = $(selector).slice(1); // Skip header
      if (rows.length > 0) {
        rows.each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 3) {
            const courseCode = $(cells[0]).text().trim();
            const courseType = $(cells[1]).text().trim();
            const performanceText = $(cells[2]).text().trim();

            if (courseCode && courseType) {
              const marksData: MarksRecord = {
                "Course Code": courseCode,
                "Course Type": courseType,
                "Test Performance": parseTestPerformance(performanceText),
              };
              attendanceData.marks.push(marksData);
            }
          }
        });
        break;
      }
    }

    if (
      attendanceData.user.length === 0 &&
      attendanceData.attendance.length === 0
    ) {
      throw new Error("No valid data found in HTML content");
    }

    return attendanceData;
  } catch (error: any) {
    console.error("HTML parsing error:", error.message);
    return undefined;
  }
}

export async function fetchAttendanceData(
  cookies: string
): Promise<FetchResult> {
  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance`,
        {
          method: "GET",
          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            Cookie: cookies,
            Host: "academia.srmist.edu.in",
            Origin: "https://academia.srmist.edu.in",
            Referer: `https://academia.srmist.edu.in/`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

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
            error: "Attendance page not found - service may be unavailable",
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
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }
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

      if (!responseText || responseText.length < 100) {
        return {
          success: false,
          error: "Empty or invalid response from academia portal",
          statusCode: 502,
        };
      }

      // Check for login page redirect
      if (responseText.includes("login") && responseText.includes("password")) {
        return {
          success: false,
          error: "Session expired - please login again",
          statusCode: 401,
        };
      }

      const parsedData = parseAttendanceHTML(responseText);

      if (!parsedData) {
        return {
          success: false,
          error:
            "Unable to parse attendance data - page format may have changed",
          statusCode: 502,
        };
      }

      return { success: true, data: parsedData, statusCode: 200 };
    } catch (error: any) {
      lastError = error;

      if (error.name === "AbortError") {
        return {
          success: false,
          error: "Request timed out - please try again",
          statusCode: 408,
        };
      }

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return {
          success: false,
          error:
            "Network connection failed - please check your internet connection",
          statusCode: 503,
        };
      }

      // For other errors, retry if not the last attempt
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts: ${
      lastError?.message || "Unknown error"
    }`,
    statusCode: 500,
  };
}
