import * as cheerio from "cheerio";
import { Cheerio } from "cheerio";

interface ResponseData {
  timetable: any[];
}

const expectedHeaders = [
  "Course Code",
  "Course Title",
  "Credit",
  "Slot",
  "Room No.",
];

function decodeEncodedString(encodedString: string): string {
  return encodedString.replace(
    /\\x([0-9A-Fa-f]{2})/g,
    (match: string, p1: string) => String.fromCharCode(parseInt(p1, 16))
  );
}

function extractTextBetweenWords(
  text: string,
  startWord: string,
  endWord: string
) {
  const startIndex = text.indexOf(startWord);
  const endIndex = text.indexOf(endWord);

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    return text.substring(startIndex + startWord.length, endIndex).trim();
  } else {
    return null;
  }
}

export async function updateTimetable(cookies: string, batchNumber: number) {
  try {
    const timetableResponse = await fetch(
      `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24`,
      {
        headers: {
          Accept: "*/*",
          Cookie: cookies,
          Host: "academia.srmist.edu.in",
          Origin: "https://academia.srmist.edu.in",
          Referer: "https://academia.srmist.edu.in/",
        },
      }
    );

    if (timetableResponse.status === 200) {
      const decodedHTML = decodeEncodedString(await timetableResponse.text());
      const result = extractTextBetweenWords(
        decodedHTML,
        "</style>\n",
        "');function doaction(recType) { }</script>"
      );
      if (result) {
        const $ = cheerio.load(result);
        let response: ResponseData = { timetable: [] };

        const tables = $("table");

        let timetableTable: Cheerio<cheerio.Element> | undefined;
        tables.each((index, table) => {
          const headers = $(table)
            .find("tr")
            .first()
            .find("td, th")
            .map((i, el) => $(el).text().trim())
            .get();

          const isMatch = expectedHeaders.every((header) =>
            headers.includes(header)
          );

          if (isMatch) {
            timetableTable = $(table);
            return false;
          }
        });

        const timetableData: Array<{
          SNo: string;
          CourseCode: string;
          CourseTitle: string;
          Credit: string;
          RegnType: string;
          Category: string;
          CourseType: string;
          FacultyName: string;
          Slot: string;
          GCRCode: string;
          RoomNo: string;
          AcademicYear: string;
        }> = [];
        if (timetableTable) {
          timetableTable.find("tr").each((index, element) => {
            const row = $(element)
              .find("td")
              .map((i, el) => $(el).text().trim())
              .get();
            if (row.length) {
              timetableData.push({
                SNo: row[0] || "",
                CourseCode: row[1] || "",
                CourseTitle: row[2] || "",
                Credit: row[3] || "",
                RegnType: row[4] || "",
                Category: row[5] || "",
                CourseType: row[6] || "",
                FacultyName: row[7] || "",
                Slot: row[8] || "",
                GCRCode: row[9] || "",
                RoomNo: row[10] || "",
                AcademicYear: row[11] || "",
              });
            }
          });

          response.timetable = timetableData;
        } else {
          console.log("Timetable not found");
        }
        return response;
      } else {
        return;
      }
    } else {
      return;
    }
  } catch (error) {
    console.error(error);
    return;
  }
}
