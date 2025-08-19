import {
  DaySchedule,
  UserTimetableData,
  TimeTableEntry as WeeklySchedule,
} from "../types/types";
import { updateTimetable } from "./updateTimetable";
import { updateUnifiedtt } from "./updateUnifiedtt";

interface Course {
  Slot: string;
  CourseCode: string;
  CourseTitle: string;
  FacultyName: string;
  RoomNo: string;
}

export default async function generateTimetable(
  cookies: string,
  batchNumber: number
): Promise<DaySchedule[]> {
  try {
    const timetableData = await updateTimetable(cookies, batchNumber);
    const unifiedTimetable = await updateUnifiedtt(cookies, batchNumber);

    if (!timetableData) {
      throw new Error("Timetable data not found");
    }

    if (!unifiedTimetable) {
      throw new Error("Unified timetable data not found");
    }

    const slotMap: { [key: string]: Course } = {};

    // Skip the first entry which is likely the header row (if it exists)
    const coursesToProcess =
      timetableData.timetable.length > 1
        ? timetableData.timetable.slice(1)
        : timetableData.timetable;

    for (const entry of coursesToProcess) {
      // Ensure the entry has all required fields
      if (!entry.Slot || !entry.CourseCode || !entry.CourseTitle) {
        continue; // Skip invalid entries
      }

      const course: Course = {
        Slot: entry.Slot,
        CourseCode: entry.CourseCode,
        CourseTitle: entry.CourseTitle,
        FacultyName: entry.FacultyName || "",
        RoomNo: entry.RoomNo || "",
      };

      // Normalize the slot format by removing spaces and standardizing separators
      const normalizedSlot = entry.Slot.toUpperCase()
        .replace(/\s+/g, "")
        .replace(/\/+/g, "/");

      // Handle slots with multiple parts (e.g., "A1-A2", "C1/C2")
      const slotParts = normalizedSlot.split(/[-/+]/).filter((p: string) => p);

      for (const part of slotParts) {
        // Store the course by its base slot
        slotMap[part] = course;

        // Also store with X suffix for lab slots that might be referenced this way
        slotMap[`${part}/X`] = course;
        slotMap[`${part}+X`] = course;
        slotMap[`${part}-X`] = course;
      }
    }

    // Generate the timetable for each day
    const generatedTimetable: DaySchedule[] = unifiedTimetable.map(
      (daySchedule) => ({
        day: daySchedule.day,
        periods: daySchedule.periods.map((period) => {
          // Skip invalid periods
          if (!period || !period.period) {
            return { period: "", timeSlot: "", course: null };
          }

          // Normalize the period format
          const normalizedPeriod = period.period
            .toUpperCase()
            .replace(/\s+/g, "")
            .replace(/\/+/g, "/");

          // Try multiple variations of the period code to find a match
          const basePeriod = normalizedPeriod.split(/[/+-]/)[0];
          const xVariations = [
            `${basePeriod}/X`,
            `${basePeriod}+X`,
            `${basePeriod}-X`,
          ];

          // Clean up the time slot format
          const timeSlot = period.timeSlot
            ? period.timeSlot.replace(/\t/g, " ").trim()
            : "";

          // Find the course for this period
          const course =
            slotMap[normalizedPeriod] ||
            slotMap[basePeriod] ||
            xVariations.reduce<Course | null>(
              (found, variant) => found || slotMap[variant],
              null
            );
          return {
            period: period.period,
            timeSlot,
            course,
          };
        }),
      })
    );

    // Store the generated timetable in the user document
    // await User.findByIdAndUpdate(
    //   userId,
    //   { $set: { timetable: generatedTimetable } },
    //   { new: true, runValidators: true }
    // );

    return generatedTimetable;
  } catch (error) {
    console.error(`Error generating timetable:`, error);
    throw error;
  }
}
