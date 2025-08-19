import { ErrorType } from "../types/types";
import { Context } from "hono";
import { fetchAttendanceData } from "../utils/updateAttendance";

export async function getAttendance(c: Context): Promise<any> {
  try {
    console.log("getAttendance");
    const cookies = c.get("academiaCookies");
    console.log(cookies);

    if (!cookies || typeof cookies !== "string") {
      return c.json(
        {
          error: "Authentication cookies not found in request context",
          type: ErrorType.AUTHENTICATION,
        },
        400
      );
    }

    const result = await fetchAttendanceData(cookies);

    if (!result.success) {
      return c.json({
        success: false,
        message: result.error || "Failed to fetch attendance data",
      });
    }

    return c.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error("Error in attendance controller:", error.message);
    return c.json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
}
