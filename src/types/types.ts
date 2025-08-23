export interface AuthProps {
    username: string;
    password: string;
}

export interface LookupResponse {
    message: string;
    lookup?: {
        identifier: string;
        digest: string;
    };
}

export interface PasswordResponse {
    message: string;
    status?: string;
}

export interface AuthResult {
    token: string;
    email: string;
    success: true;
    message: string;
}

export interface RefreshResult {
    token: string;
    email: string;
    success: true;
    message: string;
    expiresIn: number;
}

export interface ErrorResponse {
    error: string;
    details?: string;
    success: false;
}

export interface AttendanceRecord {
    'Course Code': string;
    'Course Title': string;
    'Category': string;
    'Faculty Name': string;
    'Slot': string;
    'Room No': string;
    'Hours Conducted': string;
    'Hours Absent': string;
    'Attn %': string;
}

export interface TestScore {
    [testName: string]: number[];
}

export interface MarksRecord {
    'Course Code': string;
    'Course Type': string;
    'Test Performance': TestScore;
}

export interface UserDetail {
    [key: string]: string;
}

export interface AttendanceData {
    user: UserDetail[];
    attendance: AttendanceRecord[];
    marks: MarksRecord[];
}

export interface FetchResult {
    success: boolean;
    data?: AttendanceData;
    error?: string;
    statusCode?: number;
}

export interface JWTPayload {
    userId?: string;
    academiaCookies: string;
    exp?: number;
    iat?: number;
}

export type CustomContext = {
    academiaCookies: string
}

export enum ErrorType {
    AUTHENTICATION = 'AUTHENTICATION_ERROR',
    NETWORK = 'NETWORK_ERROR',
    PARSING = 'PARSING_ERROR',
    TIMEOUT = 'TIMEOUT_ERROR',
    VALIDATION = 'VALIDATION_ERROR',
    SERVER = 'SERVER_ERROR'
}

export interface ApiError {
    type: ErrorType;
    message: string;
    statusCode: number;
    details?: any;
}

export interface UserInfo {
    registrationNumber: string
    name: string
    batch: number
    mobile: number
    program: string
    department: string
    semester: number
}

export interface Advisor {
    name: string
    role: string
    email: string
    phone: string
}

export interface InfoResponse {
    user: UserInfo
    advisors: Advisor[]
}

export interface Course {
    Slot: string;
    CourseCode: string;
    CourseTitle: string;
    FacultyName: string;
    RoomNo: string;
}

export interface Period {
    period: string;
    timeSlot: string;
    course?: Course | null;
}

export interface DaySchedule {
    day: string;
    periods: Period[];
}

// For unified timetable scraping and database model
export type TimeTableEntry = Omit<DaySchedule, 'periods'> & {
    periods: Array<{
        period: string;
        timeSlot: string;
    }>;
};

// For parsing user's raw data
export interface UserTimetableData {
    timetable: Course[];
}
