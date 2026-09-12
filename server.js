// ============================================================
// TABIBK | Medical Appointment Booking System
// server.js | Stable PostgreSQL Version
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const WILAYAS_FILE = path.join(
    __dirname,
    "wilayas.json"
);

const WILAYAS_DATA = JSON.parse(
    fs.readFileSync(
        WILAYAS_FILE,
        "utf8"
    )
);
// ============================================================
// CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 10000;

const DATABASE_FILE = path.join(
    __dirname,
    "database.json"
);

const ADMIN_KEY =
    process.env.ADMIN_KEY ||
    "TABIBK_ADMIN_2026";

const DOCTOR_SESSION_DAYS = 7;

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// ============================================================
// POSTGRESQL
// ============================================================

let databaseCache = null;
let databaseReady = false;
let databaseInitPromise = null;

let pgPool = null;

let databaseSaveQueue = Promise.resolve();

if (process.env.DATABASE_URL) {

    const {
        Pool
    } = require("pg");

    pgPool = new Pool({

        connectionString:
            process.env.DATABASE_URL,

        ssl: {
            rejectUnauthorized: false
        },

        max: 5,

        idleTimeoutMillis: 30000,

        connectionTimeoutMillis: 10000
    });

    pgPool.on(
        "error",
        error => {
            console.error(
                "PostgreSQL pool error:",
                error
            );
        }
    );

} else {

    console.error(
        "DATABASE_URL is not configured."
    );
}
// ============================================================
// EMPTY DATABASE
// ============================================================

function createEmptyDatabase() {

    return {

        wilayas: [

            {
                id: 1,

                name: "ورڨلة",

                municipalities: [

                    "ورڨلة",
                    "الرويسات",
                    "عين البيضاء",
                    "سيدي خويلد",
                    "حاسي بن عبد الله",
                    "حاسي مسعود",
                    "البرمة",
                    "انقوسة",
                    "الحجيرة",
                    "الطيبات",
                    "تقرت"

                ]
            }

        ],

        doctors: [],

        appointments: [],

        notifications: []

    };
}

// ============================================================
// NORMALIZE DATABASE
// ============================================================

function normalizeDatabase(database) {

    if (
        !database ||
        typeof database !== "object"
    ) {
        database =
            createEmptyDatabase();
    }

    if (
        !Array.isArray(
            database.wilayas
        )
    ) {
        database.wilayas = [];
    }

    if (
        !Array.isArray(
            database.doctors
        )
    ) {
        database.doctors = [];
    }

    if (
        !Array.isArray(
            database.appointments
        )
    ) {
        database.appointments = [];
    }

    if (
        !Array.isArray(
            database.notifications
        )
    ) {
        database.notifications = [];
    }

    // --------------------------------------------------------
    // Wilayas
    // --------------------------------------------------------

    database.wilayas =
        database.wilayas.map(
            (wilaya, index) => {

                return {

                    id:
                        Number(wilaya.id) ||
                        index + 1,

                    name:
                        String(
                            wilaya.name || ""
                        ),

                    municipalities:
                        Array.isArray(
                            wilaya.municipalities
                        )
                            ? wilaya.municipalities.map(
                                municipality =>
                                    String(
                                        municipality
                                    )
                            )
                            : []

                };

            }
        );

    // --------------------------------------------------------
    // Doctors
    // --------------------------------------------------------

    database.doctors =
        database.doctors.map(
            (doctor, index) => {

                const workingHours =
                    doctor.workingHours &&
                    typeof doctor.workingHours === "object"
                        ? doctor.workingHours
                        : {};

                const vacation =
                    doctor.vacation &&
                    typeof doctor.vacation === "object"
                        ? doctor.vacation
                        : {};

                return {

                    ...doctor,

                    id:
                        Number(doctor.id) ||
                        index + 1,

                    name:
                        String(
                            doctor.name || ""
                        ),

                    specialty:
                        String(
                            doctor.specialty || ""
                        ),

                    wilaya:
                        String(
                            doctor.wilaya || ""
                        ),

                    municipality:
                        String(
                            doctor.municipality || ""
                        ),

                    phone:
                        String(
                            doctor.phone || ""
                        ),

                    whatsapp:
                        String(
                            doctor.whatsapp ||
                            doctor.phone ||
                            ""
                        ),

                    duration:
                        Number(
                            doctor.duration
                        ) || 15,

                    active:
                        doctor.active !== false,

                    online:
                        doctor.online === true,

                    workingHours: {

                        enabled:
                            workingHours.enabled !== false,

                        days:
                            Array.isArray(
                                workingHours.days
                            )
                                ? workingHours.days
                                : [0, 1, 2, 3, 4],

                        open:
                            workingHours.open ||
                            "08:00",

                        close:
                            workingHours.close ||
                            "17:00"

                    },

                    vacation: {

                        enabled:
                            vacation.enabled === true,

                        startDate:
                            vacation.startDate || "",

                        endDate:
                            vacation.endDate || ""

                    }

                };

            }
        );

    // --------------------------------------------------------
    // Appointments
    // --------------------------------------------------------

    database.appointments =
        database.appointments.map(
            (appointment, index) => {

                return {

                    ...appointment,

                    id:
                        Number(
                            appointment.id
                        ) || index + 1,

                    doctorId:
                        Number(
                            appointment.doctorId
                        ) || 0,

                    patientName:
                        String(
                            appointment.patientName || ""
                        ),

                    patientPhone:
                        String(
                            appointment.patientPhone || ""
                        ),

                    patientAge:
                        appointment.patientAge !== undefined
                            ? appointment.patientAge
                            : "",

                    patientGender:
                        appointment.patientGender || "",

                    reason:
                        appointment.reason || "",

                    notes:
                        appointment.notes || "",

                    date:
                        appointment.date || "",

                    time:
                        appointment.time || "",

                    bookingNumber:
                        appointment.bookingNumber || "",

                    queueNumber:
                        Number(
                            appointment.queueNumber
                        ) || 0,

                    status:
                        appointment.status ||
                        "pending"

                };

            }
        );

    // --------------------------------------------------------
    // Notifications
    // --------------------------------------------------------

    database.notifications =
        database.notifications.map(
            (notification, index) => {

                return {

                    ...notification,

                    id:
                        Number(
                            notification.id
                        ) || index + 1,

                    doctorId:
                        notification.doctorId === null ||
                        notification.doctorId === undefined
                            ? null
                            : Number(
                                notification.doctorId
                            ),

                    appointmentId:
                        notification.appointmentId === null ||
                        notification.appointmentId === undefined
                            ? null
                            : Number(
                                notification.appointmentId
                            ),

                    patientPhone:
                        notification.patientPhone ||
                        "",

                    bookingNumber:
                        notification.bookingNumber ||
                        "",

                    title:
                        notification.title ||
                        "إشعار",

                    message:
                        notification.message ||
                        "",

                    type:
                        notification.type ||
                        "general",

                    read:
                        notification.read === true,

                    createdAt:
                        notification.createdAt ||
                        new Date().toISOString()

                };

            }
        );

    return database;
}

// ============================================================
// LEGACY JSON DATABASE
// ============================================================

function readLegacyDatabase() {

    try {

        if (
            !fs.existsSync(
                DATABASE_FILE
            )
        ) {
            return null;
        }

        const raw =
            fs.readFileSync(
                DATABASE_FILE,
                "utf8"
            );

        return normalizeDatabase(
            JSON.parse(raw)
        );

    } catch (error) {

        console.error(
            "Legacy database read error:",
            error
        );

        return null;
    }
}

// ============================================================
// READ DATABASE
// ============================================================

function readDatabase() {

    if (!databaseCache) {

        databaseCache =
            readLegacyDatabase() ||
            createEmptyDatabase();

        databaseCache =
            normalizeDatabase(
                databaseCache
            );
    }

    return databaseCache;
}

// ============================================================
// SAVE DATABASE
// Safe serialized PostgreSQL writes
// ============================================================

function saveDatabase(database) {

    databaseCache =
        normalizeDatabase(database);

    if (
        !pgPool ||
        !databaseReady
    ) {
        return databaseSaveQueue;
    }

    const snapshot =
        JSON.parse(
            JSON.stringify(
                databaseCache
            )
        );

    databaseSaveQueue =
        databaseSaveQueue
            .catch(() => {})
            .then(
                () =>
                    pgPool.query(
                        `
                        INSERT INTO tabibk_data
                        (
                            id,
                            data,
                            updated_at
                        )
                        VALUES
                        (
                            1,
                            $1::jsonb,
                            NOW()
                        )
                        ON CONFLICT(id)
                        DO UPDATE SET
                            data = EXCLUDED.data,
                            updated_at = NOW()
                        `,
                        [
                            JSON.stringify(
                                snapshot
                            )
                        ]
                    )
            )
            .catch(error => {

                console.error(
                    "PostgreSQL save error:",
                    error
                );

                return false;
            });

    return databaseSaveQueue;
}

// ============================================================
// INITIALIZE DATABASE
// ============================================================

async function initializeDatabase() {

    if (databaseInitPromise) {
        return databaseInitPromise;
    }

    databaseInitPromise =
        (async () => {

            if (!pgPool) {

                throw new Error(
                    "DATABASE_URL is required."
                );
            }

            await pgPool.query(
                "SELECT 1"
            );

            await pgPool.query(
                `
                CREATE TABLE IF NOT EXISTS
                tabibk_data
                (
                    id INTEGER PRIMARY KEY,
                    data JSONB NOT NULL,
                    updated_at
                        TIMESTAMPTZ
                        NOT NULL
                        DEFAULT NOW()
                )
                `
            );

            const result =
                await pgPool.query(
                    `
                    SELECT data
                    FROM tabibk_data
                    WHERE id = 1
                    `
                );

            if (
                result.rows.length > 0
            ) {

                databaseCache =
                    normalizeDatabase(
                        result.rows[0].data
                    );

                console.log(
                    "TABIBK database loaded from PostgreSQL."
                );

            } else {

                const legacyDatabase =
                    readLegacyDatabase() ||
                    createEmptyDatabase();

                databaseCache =
                    normalizeDatabase(
                        legacyDatabase
                    );

                await pgPool.query(
                    `
                    INSERT INTO tabibk_data
                    (
                        id,
                        data,
                        updated_at
                    )
                    VALUES
                    (
                        1,
                        $1::jsonb,
                        NOW()
                    )
                    `,
                    [
                        JSON.stringify(
                            databaseCache
                        )
                    ]
                );

                console.log(
                    "TABIBK database initialized in PostgreSQL."
                );
            }

            databaseReady = true;

            return databaseCache;

        })();

    return databaseInitPromise;
}

// ============================================================
// HELPERS
// ============================================================

function generateBookingNumber() {

    const date =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Africa/Algiers"
            }
        ).format(
            new Date()
        )
        .replace(/-/g, "");

    const random =
        Math.floor(
            100000 +
            Math.random() * 900000
        );

    return `TBK-${date}-${random}`;
}

// ------------------------------------------------------------

function generateId(array) {

    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {
        return 1;
    }

    return (
        Math.max(
            ...array.map(
                item =>
                    Number(item.id) || 0
            )
        ) + 1
    );
}

// ------------------------------------------------------------

function cleanDoctor(doctor) {

    if (!doctor) {
        return null;
    }

    const result =
        JSON.parse(
            JSON.stringify(
                doctor
            )
        );

    delete result.password;
    delete result.loginPassword;

    return result;
}

// ------------------------------------------------------------

function cleanDoctors(doctors) {

    return doctors.map(
        cleanDoctor
    );
}

// ------------------------------------------------------------

function getDoctorPassword(doctor) {

    return (
        doctor.password ||
        doctor.loginPassword ||
        "123456"
    );
}

// ------------------------------------------------------------

function normalizePhone(phone) {

    let value =
        String(
            phone || ""
        )
        .trim()
        .replace(
            /[\s\-().]/g,
            ""
        );

    if (
        value.startsWith("00")
    ) {
        value =
            "+" +
            value.slice(2);
    }

    return value;
}

// ------------------------------------------------------------

function createNotification(
    database,
    data
) {

    const notification = {

        id:
            generateId(
                database.notifications
            ),

        doctorId:
            data.doctorId === undefined
                ? null
                : data.doctorId,

        appointmentId:
            data.appointmentId === undefined
                ? null
                : data.appointmentId,

        patientPhone:
            normalizePhone(
                data.patientPhone || ""
            ),

        bookingNumber:
            data.bookingNumber || "",

        type:
            data.type || "general",

        title:
            data.title || "إشعار",

        message:
            data.message || "",

        read: false,

        createdAt:
            new Date().toISOString()

    };

    database.notifications.push(
        notification
    );

    return notification;
}

// ------------------------------------------------------------

function createDoctorToken() {

    return crypto
        .randomBytes(48)
        .toString("hex");
}

// ------------------------------------------------------------

function getTokenFromRequest(req) {

    const authorization =
        req.headers.authorization || "";

    if (
        !authorization.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    return authorization
        .slice(7)
        .trim();
}

// ============================================================
// DOCTOR SESSIONS
// ============================================================

const doctorSessions =
    new Map();

// ============================================================
// ADMIN AUTH
// ============================================================

function checkAdminKey(
    req,
    res,
    next
) {

    const headerKey =
        req.headers["x-admin-key"];

    const bearerKey =
        getTokenFromRequest(req);

    const providedKey =
        headerKey ||
        bearerKey;

    if (
        !providedKey ||
        providedKey !== ADMIN_KEY
    ) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "مفتاح الإدارة غير صحيح"
            });
    }

    next();
}

// ============================================================
// DOCTOR AUTH
// ============================================================

function checkDoctorAuth(
    req,
    res,
    next
) {

    const token =
        getTokenFromRequest(req);

    if (!token) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "غير مصرح"
            });
    }

    const session =
        doctorSessions.get(
            token
        );

    if (!session) {

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "انتهت الجلسة"
            });
    }

    if (
        Date.now() >
        session.expiresAt
    ) {

        doctorSessions.delete(
            token
        );

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "انتهت الجلسة"
            });
    }

    const database =
        readDatabase();

    const doctor =
        database.doctors.find(
            item =>
                Number(item.id) ===
                Number(session.doctorId)
        );

    if (!doctor) {

        doctorSessions.delete(
            token
        );

        return res
            .status(401)
            .json({
                success: false,
                message:
                    "الطبيب غير موجود"
            });
    }

    if (
        doctor.active === false
    ) {

        return res
            .status(403)
            .json({
                success: false,
                message:
                    "حساب الطبيب غير مفعل"
            });
    }

    req.doctor = doctor;
    req.token = token;

    next();
}

// ============================================================
// HOME
// ============================================================

app.get(
    "/",
    (req, res) => {

        const indexFile =
            path.join(
                __dirname,
                "public",
                "index.html"
            );

        if (
            fs.existsSync(indexFile)
        ) {

            return res.sendFile(
                indexFile
            );
        }

        res.json({
            success: true,
            app: "TABIBK",
            message:
                "سيرفر طبيبك يعمل بنجاح 🩺",
            version: "1.0.0",
            status: "online"
        });
    }
);

// ============================================================
// PUBLIC - WILAYAS
// ============================================================

app.get(
    "/api/wilayas",
    (req, res) => {

        const wilayas =
            WILAYAS_DATA.map(
                wilaya => ({
                    id: wilaya.code,
                    name: wilaya.name,
                    municipalities:
                        (wilaya.communes || []).map(
                            commune =>
                                typeof commune === "string"
                                    ? commune
                                    : commune.name
                        )
                })
            );

        res.json({
            success: true,
            count: wilayas.length,
            wilayas
        });

    }
);

// ============================================================
// PUBLIC - MUNICIPALITIES BY WILAYA
// ============================================================

app.get(
    "/api/wilayas/:id/municipalities",
    (req, res) => {

        const wilayaId =
            String(req.params.id).trim();

        const wilaya =
            WILAYAS_DATA.find(
                item =>
                    String(item.code).trim() ===
                    wilayaId
            );

        if(!wilaya){

            return res.status(404).json({
                success: false,
                message: "الولاية غير موجودة"
            });

        }

        const municipalities =
            (wilaya.communes || []).map(
                commune =>
                    typeof commune === "string"
                        ? commune
                        : commune.name
            );

        res.json({
            success: true,
            wilaya: {
                id: wilaya.code,
                name: wilaya.name
            },
            count: municipalities.length,
            municipalities
        });

    }
);

// ============================================================
// PUBLIC - ALL DOCTORS
// ============================================================

app.get(
    "/api/doctors",
    (req, res) => {

        const database =
            readDatabase();

        const doctors =
            database.doctors
                .filter(
                    doctor =>
                        doctor.active !== false
                )
                .map(
                    doctor =>
                        cleanDoctor(
                            doctor
                        )
                );

        res.json({
            success: true,
            count: doctors.length,
            doctors
        });

    }
);

// ============================================================
// PUBLIC - SINGLE DOCTOR
// ============================================================

app.get(
    "/api/doctors/:id",
    (req, res) => {

        const database =
            readDatabase();

        const doctor =
            database.doctors.find(
                item =>
                    Number(item.id) ===
                    Number(req.params.id) &&
                    item.active !== false
            );

        if (!doctor) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الطبيب غير موجود"
                });
        }

        res.json({
            success: true,
            doctor:
                cleanDoctor(
                    doctor
                )
        });
    }
);

// ============================================================
// DOCTOR LOGIN
// ============================================================

app.post(
    "/api/doctor/login",
    (req, res) => {

        try {

            const {
                phone,
                password
            } = req.body;

            if (
                !phone ||
                !password
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "رقم الهاتف وكلمة المرور مطلوبان"
                    });
            }

            const database =
                readDatabase();

            const normalizedPhone =
                normalizePhone(
                    phone
                );

            const doctor =
                database.doctors.find(
                    item => {

                        const doctorPhone =
                            normalizePhone(
                                item.phone
                            );

                        const doctorWhatsapp =
                            normalizePhone(
                                item.whatsapp
                            );

                        return (
                            doctorPhone ===
                                normalizedPhone ||
                            doctorWhatsapp ===
                                normalizedPhone
                        );
                    }
                );

            if (!doctor) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "بيانات الدخول غير صحيحة"
                    });
            }

            if (
                doctor.active === false
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "حساب الطبيب غير مفعل"
                    });
            }

            const doctorPassword =
                getDoctorPassword(
                    doctor
                );

            if (
                String(
                    password
                ) !==
                String(
                    doctorPassword
                )
            ) {

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "بيانات الدخول غير صحيحة"
                    });
            }

            const token =
                createDoctorToken();

            const expiresAt =
                Date.now() +
                (
                    DOCTOR_SESSION_DAYS *
                    24 *
                    60 *
                    60 *
                    1000
                );

            doctorSessions.set(
                token,
                {
                    doctorId:
                        doctor.id,
                    expiresAt
                }
            );

            doctor.lastLoginAt =
                new Date().toISOString();

            doctor.online = true;

            saveDatabase(
                database
            );

            res.json({

                success: true,

                token,

                expiresAt,

                doctor:
                    cleanDoctor(
                        doctor
                    )

            });

        } catch (error) {

            console.error(
                "Doctor login error:",
                error
            );

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        "حدث خطأ أثناء تسجيل الدخول"
                });
        }
    }
);

// ============================================================
// DOCTOR LOGOUT
// ============================================================

app.post(
    "/api/doctor/logout",
    checkDoctorAuth,
    (req, res) => {

        doctorSessions.delete(
            req.token
        );

        const database =
            readDatabase();

        const doctor =
            database.doctors.find(
                item =>
                    Number(item.id) ===
                    Number(req.doctor.id)
            );

        if (doctor) {

            doctor.online = false;

            doctor.lastLogoutAt =
                new Date().toISOString();

            saveDatabase(
                database
            );
        }

        res.json({
            success: true,
            message:
                "تم تسجيل الخروج بنجاح"
        });
    }
);

// ============================================================
// DOCTOR ME
// ============================================================

app.get(
    "/api/doctor/me",
    checkDoctorAuth,
    (req, res) => {

        res.json({
            success: true,
            doctor:
                cleanDoctor(
                    req.doctor
                )
        });
    }
);

// ============================================================
// WORKING HOURS - GET
// ============================================================

app.get(
    "/api/doctor/working-hours",
    checkDoctorAuth,
    (req, res) => {

        const doctor =
            req.doctor;

        res.json({

            success: true,

            workingHours:
                doctor.workingHours || {

                    enabled: true,

                    days: [
                        0,
                        1,
                        2,
                        3,
                        4
                    ],

                    open: "08:00",

                    close: "17:00"

                }

        });
    }
);

// ============================================================
// WORKING HOURS - UPDATE
// ============================================================

app.put(
    "/api/doctor/working-hours",
    checkDoctorAuth,
    (req, res) => {

        const {
            enabled,
            days,
            open,
            close
        } = req.body;

        if (
            typeof enabled !==
            "boolean"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "حالة أوقات العمل غير صحيحة"
                });
        }

        if (
            !Array.isArray(days) ||
            days.some(
                day =>
                    !Number.isInteger(
                        Number(day)
                    ) ||
                    Number(day) < 0 ||
                    Number(day) > 6
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "أيام العمل غير صحيحة"
                });
        }

        const timeRegex =
            /^([01]\d|2[0-3]):([0-5]\d)$/;

        if (
            !timeRegex.test(
                String(open || "")
            ) ||
            !timeRegex.test(
                String(close || "")
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "وقت العمل غير صحيح"
                });
        }

        if (
            String(open) >=
            String(close)
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "وقت الإغلاق يجب أن يكون بعد وقت الفتح"
                });
        }

        const database =
            readDatabase();

        const doctor =
            database.doctors.find(
                item =>
                    Number(item.id) ===
                    Number(req.doctor.id)
            );

        doctor.workingHours = {

            enabled,

            days:
                days.map(
                    Number
                ),

            open:
                String(open),

            close:
                String(close)

        };

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم حفظ أوقات العمل",

            workingHours:
                doctor.workingHours

        });
    }
);

// ============================================================
// VACATION - GET
// ============================================================

app.get(
    "/api/doctor/vacation",
    checkDoctorAuth,
    (req, res) => {

        res.json({

            success: true,

            vacation:
                req.doctor.vacation || {

                    enabled: false,

                    startDate: "",

                    endDate: ""

                }

        });
    }
);

// ============================================================
// VACATION - UPDATE
// ============================================================

app.put(
    "/api/doctor/vacation",
    checkDoctorAuth,
    (req, res) => {

        const {
            enabled,
            startDate,
            endDate
        } = req.body;

        if (
            typeof enabled !==
            "boolean"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "حالة العطلة غير صحيحة"
                });
        }

        if (enabled) {

            if (
                !startDate ||
                !endDate
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "يجب تحديد تاريخ بداية ونهاية العطلة"
                    });
            }

            if (
                String(startDate) >
                String(endDate)
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "تاريخ النهاية يجب أن يكون بعد البداية"
                    });
            }
        }

        const database =
            readDatabase();

        const doctor =
            database.doctors.find(
                item =>
                    Number(item.id) ===
                    Number(req.doctor.id)
            );

        doctor.vacation = {

            enabled,

            startDate:
                startDate || "",

            endDate:
                endDate || ""

        };

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم حفظ إعدادات العطلة",

            vacation:
                doctor.vacation

        });
    }
);

// ============================================================
// DOCTOR NOTIFICATIONS - GET
// ============================================================

app.get(
    "/api/doctor/notifications",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const notifications =
            database.notifications
                .filter(
                    notification =>
                        Number(
                            notification.doctorId
                        ) ===
                        Number(
                            req.doctor.id
                        )
                )
                .sort(
                    (a, b) =>
                        new Date(
                            b.createdAt
                        ) -
                        new Date(
                            a.createdAt
                        )
                )
                .slice(
                    0,
                    100
                );

        res.json({

            success: true,

            notifications

        });
    }
);

// ============================================================
// DOCTOR NOTIFICATION - MARK READ
// ============================================================

app.post(
    "/api/doctor/notifications/:id/read",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const notification =
            database.notifications.find(
                item =>
                    Number(item.id) ===
                        Number(
                            req.params.id
                        ) &&
                    Number(
                        item.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        )
            );

        if (!notification) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الإشعار غير موجود"
                });
        }

        notification.read = true;

        notification.readAt =
            new Date().toISOString();

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم تحديد الإشعار كمقروء"

        });
    }
);

// ============================================================
// DOCTOR NOTIFICATION - DELETE ONE
// ============================================================

app.delete(
    "/api/doctor/notifications/:id",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const notificationIndex =
            database.notifications.findIndex(
                notification =>
                    String(
                        notification.id
                    ) ===
                        String(
                            req.params.id
                        ) &&
                    Number(
                        notification.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        )
            );

        if (
            notificationIndex === -1
        ) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الإشعار غير موجود"
                });
        }

        database.notifications.splice(
            notificationIndex,
            1
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم حذف الإشعار بنجاح"

        });
    }
);

// ============================================================
// DOCTOR NOTIFICATIONS - DELETE ALL
// ============================================================

app.delete(
    "/api/doctor/notifications",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const doctorId =
            Number(
                req.doctor.id
            );

        const beforeCount =
            database.notifications.length;

        database.notifications =
            database.notifications.filter(
                notification =>
                    Number(
                        notification.doctorId
                    ) !== doctorId
            );

        const deletedCount =
            beforeCount -
            database.notifications.length;

        if (
            deletedCount > 0
        ) {
            saveDatabase(
                database
            );
        }

        res.json({

            success: true,

            message:
                deletedCount > 0
                    ? "تم حذف جميع الإشعارات بنجاح"
                    : "لا توجد إشعارات للحذف",

            deletedCount

        });
    }
);

// ============================================================
// PATIENT NOTIFICATIONS - GET
// ============================================================

app.get(
    "/api/patient/notifications",
    (req, res) => {

        const phone =
            normalizePhone(
                req.query.phone
            );

        if (!phone) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "رقم الهاتف مطلوب"
                });
        }

        const database =
            readDatabase();

        const notifications =
            database.notifications
                .filter(
    notification =>
        notification.doctorId === null &&
        normalizePhone(
            notification.patientPhone
        ) === phone
)
                .sort(
                    (a, b) =>
                        new Date(
                            b.createdAt
                        ) -
                        new Date(
                            a.createdAt
                        )
                )
                .slice(
                    0,
                    100
                );

        res.json({

            success: true,

            notifications

        });
    }
);

// ============================================================
// PATIENT UNREAD COUNT
// ============================================================

app.get(
    "/api/patient/notifications/unread-count",
    (req, res) => {

        const phone =
            normalizePhone(
                req.query.phone
            );

        if (!phone) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "رقم الهاتف مطلوب"
                });
        }

        const database =
            readDatabase();

        const count =
            database.notifications.filter(
                notification =>
                    normalizePhone(
                        notification.patientPhone
                    ) === phone &&
                    !notification.read
            ).length;

        res.json({

            success: true,

            count

        });
    }
);

// ============================================================
// PATIENT NOTIFICATION - MARK READ
// ============================================================

app.post(
    "/api/patient/notifications/:id/read",
    (req, res) => {

        const phone =
            normalizePhone(
                req.body.phone
            );

        if (!phone) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "رقم الهاتف مطلوب"
                });
        }

        const database =
            readDatabase();

        const notification =
            database.notifications.find(
                item =>
                    Number(item.id) ===
                        Number(
                            req.params.id
                        ) &&
                    normalizePhone(
                        item.patientPhone
                    ) === phone
            );

        if (!notification) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الإشعار غير موجود"
                });
        }

        notification.read = true;

        notification.readAt =
            new Date().toISOString();

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم تحديد الإشعار كمقروء"

        });
    }
);

// ============================================================
// CREATE APPOINTMENT
// ============================================================

app.post(
    "/api/appointments",
    (req, res) => {

        try {

            const {

                patientName,
                patientPhone,
                patientAge,
                patientGender,
                reason,
                doctorId,
                date,
                time,
                notes

            } = req.body;

            if (
                !patientName ||
                !patientPhone ||
                !doctorId ||
                !date ||
                !time
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "الاسم والهاتف والطبيب والتاريخ والوقت مطلوبة"
                    });
            }

            const database =
                readDatabase();

            const doctor =
                database.doctors.find(
                    item =>
                        Number(item.id) ===
                        Number(doctorId)
                );

            if (!doctor) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "الطبيب غير موجود"
                    });
            }

            if (
                doctor.active === false
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "الطبيب غير متاح حاليا"
                    });
            }

            // ------------------------------------------------
            // Working hours
            // ------------------------------------------------

            const workingHours =
                doctor.workingHours || {

                    enabled: true,

                    days: [
                        0,
                        1,
                        2,
                        3,
                        4
                    ],

                    open: "08:00",

                    close: "17:00"

                };

            const appointmentDate =
                new Date(
                    `${date}T${time}:00+01:00`
                );

            if (
                Number.isNaN(
                    appointmentDate.getTime()
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "التاريخ أو الوقت غير صحيح"
                    });
            }

            if (
                appointmentDate.getTime() <=
                Date.now()
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "لا يمكن حجز موعد في وقت مضى"
                    });
            }

            if (
                workingHours.enabled
            ) {

                const day =
                    appointmentDate.getDay();

                if (
                    !workingHours.days
                        .map(Number)
                        .includes(day)
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                "الطبيب لا يعمل في هذا اليوم"
                        });
                }

                if (
                    String(time) <
                        String(
                            workingHours.open
                        ) ||
                    String(time) >=
                        String(
                            workingHours.close
                        )
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                "الوقت خارج أوقات عمل الطبيب"
                        });
                }
            }

            // ------------------------------------------------
            // Vacation
            // ------------------------------------------------

            const vacation =
                doctor.vacation || {

                    enabled: false,

                    startDate: "",

                    endDate: ""

                };

            if (
                vacation.enabled &&
                vacation.startDate &&
                vacation.endDate &&
                String(date) >=
                    String(
                        vacation.startDate
                    ) &&
                String(date) <=
                    String(
                        vacation.endDate
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "الطبيب في عطلة خلال هذا التاريخ"
                    });
            }

            // ------------------------------------------------
            // Active statuses
            // ------------------------------------------------

            const activeStatuses = [

                "pending",
                "confirmed",
                "accepted",
                "started",
                "in_progress",
                "waiting"

            ];

            // ------------------------------------------------
            // Duplicate patient appointment
            // ------------------------------------------------

            const normalizedPatientPhone =
                normalizePhone(
                    patientPhone
                );

            const duplicatePatient =
                database.appointments.find(
                    appointment =>
                        Number(
                            appointment.doctorId
                        ) === Number(doctorId) &&

                        String(
                            appointment.date
                        ) === String(date) &&

                        String(
                            appointment.time
                        ) === String(time) &&

                        normalizePhone(
                            appointment.patientPhone
                        ) ===
                            normalizedPatientPhone &&

                        activeStatuses.includes(
                            appointment.status
                        )
                );

            if (
                duplicatePatient
            ) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "لديك موعد محجوز مسبقا في هذا الوقت"
                    });
            }

            // ------------------------------------------------
            // Doctor time conflict
            // ------------------------------------------------

            const duplicateDoctor =
                database.appointments.find(
                    appointment =>
                        Number(
                            appointment.doctorId
                        ) === Number(doctorId) &&

                        String(
                            appointment.date
                        ) === String(date) &&

                        String(
                            appointment.time
                        ) === String(time) &&

                        activeStatuses.includes(
                            appointment.status
                        )
                );

            if (
                duplicateDoctor
            ) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "هذا الوقت محجوز مسبقا"
                    });
            }

            // ------------------------------------------------
            // Queue number
            // ------------------------------------------------

            const sameDayAppointments =
                database.appointments.filter(
                    appointment =>
                        Number(
                            appointment.doctorId
                        ) === Number(doctorId) &&

                        String(
                            appointment.date
                        ) === String(date) &&

                        activeStatuses.includes(
                            appointment.status
                        )
                );

            const queueNumber =
                sameDayAppointments.length === 0
                    ? 1
                    : Math.max(
                        ...sameDayAppointments.map(
                            appointment =>
                                Number(
                                    appointment.queueNumber
                                ) || 0
                        )
                    ) + 1;

            // ------------------------------------------------
            // Create appointment
            // ------------------------------------------------

            const bookingNumber =
                generateBookingNumber();

            const appointment = {

                id:
                    generateId(
                        database.appointments
                    ),

                bookingNumber,

                patientName:
                    String(
                        patientName
                    ).trim(),

                patientPhone:
                    normalizedPatientPhone,

                patientAge:
                    patientAge ?? "",

                patientGender:
                    patientGender || "",

                reason:
                    reason || "",

                notes:
                    notes || "",

                doctorId:
                    Number(doctorId),

                doctorName:
                    doctor.name,

                doctorSpecialty:
                    doctor.specialty,

                date:
                    String(date),

                time:
                    String(time),

                queueNumber,

                status:
                    "pending",

                createdAt:
                    new Date().toISOString(),

                updatedAt:
                    new Date().toISOString()

            };

            database.appointments.push(
                appointment
            );

            // ------------------------------------------------
            // Doctor notification
            // ------------------------------------------------

            createNotification(
                database,
                {

                    doctorId:
                        doctor.id,

                    appointmentId:
                        appointment.id,

                    bookingNumber,

                    type:
                        "new_appointment",

                    title:
                        "حجز موعد جديد 🩺",

                    message:
                        `لديك طلب حجز جديد من ${appointment.patientName} بتاريخ ${appointment.date} على الساعة ${appointment.time}.`

                }
            );

            // ------------------------------------------------
            // Patient notification
            // ------------------------------------------------

            createNotification(
                database,
                {

                    appointmentId:
                        appointment.id,

                    patientPhone:
                        appointment.patientPhone,

                    bookingNumber,

                    type:
                        "appointment_created",

                    title:
                        "تم إرسال طلب الحجز",

                    message:
                        `تم تسجيل طلب موعدك مع ${doctor.name}. رقم الحجز: ${bookingNumber}`

                }
            );

            saveDatabase(
                database
            );

            res
                .status(201)
                .json({

                    success: true,

                    message:
                        "تم إرسال طلب الحجز بنجاح",

                    bookingNumber,

                    queueNumber,

                    appointment

                });

        } catch (error) {

            console.error(
                "Create appointment error:",
                error
            );

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        "حدث خطأ أثناء إنشاء الموعد"
                });
        }
    }
);

// ============================================================
// TRACK APPOINTMENT
// ============================================================

app.get(
    "/api/appointments/:bookingNumber",
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                    String(
                        req.params.bookingNumber
                    )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "رقم الحجز غير موجود"
                });
        }

        const doctorId =
            Number(
                appointment.doctorId
            );

        const appointmentDate =
            String(
                appointment.date
            );

        // ----------------------------------------------------
        // Same doctor + same date
        // ----------------------------------------------------

        const sameDay =
            database.appointments
                .filter(
                    item =>
                        Number(
                            item.doctorId
                        ) === doctorId &&

                        String(
                            item.date
                        ) === appointmentDate
                )
                .sort(
                    (a, b) =>
                        Number(
                            a.queueNumber || 0
                        ) -
                        Number(
                            b.queueNumber || 0
                        )
                );

        // ----------------------------------------------------
        // Current turn
        //
        // 1. Started patient = current turn
        // 2. If nobody started yet = first waiting patient
        // 3. Otherwise = 0
        // ----------------------------------------------------

        const startedAppointment =
            sameDay.find(
                item =>
                    item.status ===
                    "started"
            );

        const waitingAppointments =
            sameDay.filter(
                item =>
                    item.status === "pending" ||
                    item.status === "confirmed" ||
                    item.status === "accepted"
            );

        let currentTurn = 0;

        if (startedAppointment) {

            currentTurn =
                Number(
                    startedAppointment.queueNumber
                );

        } else if (
            waitingAppointments.length > 0
        ) {

            currentTurn =
                Number(
                    waitingAppointments[0]
                        .queueNumber
                );

        }

        // ----------------------------------------------------
        // Patients before this patient
        // ----------------------------------------------------

        const patientsBefore =
            sameDay.filter(
                item =>
                    (
                        item.status ===
                            "pending" ||
                        item.status ===
                            "confirmed" ||
                        item.status ===
                            "accepted" ||
                        item.status ===
                            "started"
                    ) &&

                    Number(
                        item.queueNumber
                    ) <
                    Number(
                        appointment.queueNumber
                    )
            ).length;

        // ----------------------------------------------------
        // Next waiting patient
        // ----------------------------------------------------

        const nextAppointment =
            sameDay
                .filter(
                    item =>
                        (
                            item.status ===
                                "confirmed" ||
                            item.status ===
                                "accepted"
                        ) &&

                        Number(
                            item.queueNumber
                        ) >
                        Number(
                            appointment.queueNumber
                        )
                )
                .sort(
                    (a, b) =>
                        Number(
                            a.queueNumber
                        ) -
                        Number(
                            b.queueNumber
                        )
                )[0] || null;

        // ----------------------------------------------------
        // Doctor
        // ----------------------------------------------------

        const doctor =
            database.doctors.find(
                item =>
                    Number(item.id) ===
                    doctorId
            );

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        res.json({

            success: true,

            bookingNumber:
                appointment.bookingNumber,

            queueNumber:
                appointment.queueNumber,

            currentTurn,

            patientsBefore,

            nextQueue:
                nextAppointment
                    ? nextAppointment.queueNumber
                    : null,

            doctorName:
                doctor
                    ? doctor.name
                    : appointment.doctorName,

            status:
                appointment.status,

            date:
                appointment.date || null,

            time:
                appointment.time || null,

            appointment

        });
    }
);
// ============================================================
// DOCTOR APPOINTMENTS
// ============================================================

app.get(
    "/api/doctors/:id/appointments",
    checkDoctorAuth,
    (req, res) => {

        if (
            Number(
                req.params.id
            ) !==
            Number(
                req.doctor.id
            )
        ) {

            return res
                .status(403)
                .json({
                    success: false,
                    message:
                        "غير مصرح"
                });
        }

        const database =
            readDatabase();

        const appointments =
            database.appointments
                .filter(
                    appointment =>
                        Number(
                            appointment.doctorId
                        ) ===
                        Number(
                            req.doctor.id
                        )
                )
                .sort(
                    (a, b) => {

                        const dateA =
                            `${a.date} ${a.time}`;

                        const dateB =
                            `${b.date} ${b.time}`;

                        return dateA.localeCompare(
                            dateB
                        );
                    }
                );

        res.json({

            success: true,

            appointments

        });
    }
);

// ============================================================
// DELETE SINGLE DOCTOR APPOINTMENT
// ============================================================

app.delete(
    "/api/doctor/appointments/:bookingNumber",
    checkDoctorAuth,
    async (req, res) => {

        try {

            const database =
                readDatabase();

            const bookingNumber =
                String(
                    req.params.bookingNumber
                );

            const doctorId =
                Number(
                    req.doctor.id
                );

            const appointmentIndex =
                database.appointments.findIndex(
                    appointment =>
                        String(
                            appointment.bookingNumber
                        ) === bookingNumber &&
                        Number(
                            appointment.doctorId
                        ) === doctorId
                );

            if (
                appointmentIndex === -1
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "الموعد غير موجود"
                    });
            }

            const deletedAppointment =
                database.appointments[
                    appointmentIndex
                ];

            database.appointments.splice(
                appointmentIndex,
                1
            );

            await saveDatabase(
                database
            );

            res.json({

                success: true,

                message:
                    "تم حذف الموعد بنجاح",

                bookingNumber:
                    deletedAppointment.bookingNumber

            });

        } catch (error) {

            console.error(
                "خطأ في حذف الموعد:",
                error
            );

            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "حدث خطأ أثناء حذف الموعد"

                });
        }
    }
);

// ============================================================
// ACCEPT APPOINTMENT
// ============================================================

app.post(
    "/api/appointments/:bookingNumber/accept",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                        String(
                            req.params.bookingNumber
                        ) &&
                    Number(
                        item.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الموعد غير موجود"
                });
        }

        if (
            appointment.status !==
            "pending"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "لا يمكن قبول هذا الموعد في حالته الحالية"
                });
        }

        appointment.status =
            "confirmed";

        appointment.confirmedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        createNotification(
            database,
            {

                doctorId:
    null,

                appointmentId:
                    appointment.id,

                patientPhone:
                    appointment.patientPhone,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "appointment_confirmed",

                title:
                    "تم تأكيد موعدك ✅",

                message:
                    `تم تأكيد موعدك مع ${req.doctor.name} بتاريخ ${appointment.date} على الساعة ${appointment.time}.`

            }
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم قبول الموعد",

            appointment

        });
    }
);

// ============================================================
// REJECT APPOINTMENT
// ============================================================

app.post(
    "/api/appointments/:bookingNumber/reject",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                        String(
                            req.params.bookingNumber
                        ) &&
                    Number(
                        item.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الموعد غير موجود"
                });
        }

        const allowedStatuses = [

            "pending",
            "confirmed",
            "accepted"

        ];

        if (
            !allowedStatuses.includes(
                appointment.status
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "لا يمكن رفض هذا الموعد في حالته الحالية"
                });
        }

        const reason =
            req.body.reason ||
            "لم يتم قبول الموعد";

        appointment.status =
            "rejected";

        appointment.rejectionReason =
            reason;

        appointment.rejectedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        createNotification(
            database,
            {

                doctorId:
    null,

                appointmentId:
                    appointment.id,

                patientPhone:
                    appointment.patientPhone,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "appointment_rejected",

                title:
                    "تم رفض الموعد",

                message:
                    `تم رفض موعدك مع ${req.doctor.name}. السبب: ${reason}`

            }
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم رفض الموعد",

            appointment

        });
    }
);

// ============================================================
// START APPOINTMENT
// ============================================================

app.post(
    "/api/appointments/:bookingNumber/start",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                        String(
                            req.params.bookingNumber
                        ) &&
                    Number(
                        item.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الموعد غير موجود"
                });
        }

        if (
            ![
                "confirmed",
                "accepted"
            ].includes(
                appointment.status
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "لا يمكن بدء هذا الموعد حاليا"
                });
        }

        // ----------------------------------------------------
        // Prevent multiple started patients
        // ----------------------------------------------------

        const alreadyStarted =
            database.appointments.find(
                item =>
                    Number(
                        item.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        ) &&

                    String(
                        item.date
                    ) ===
                        String(
                            appointment.date
                        ) &&

                    item.status ===
                        "started" &&

                    Number(
                        item.id
                    ) !==
                        Number(
                            appointment.id
                        )
            );

        if (
            alreadyStarted
        ) {

            return res
                .status(409)
                .json({
                    success: false,
                    message:
                        "يوجد مريض قيد الفحص حاليا"
                });
        }

        appointment.status =
            "started";

        appointment.startedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        createNotification(
            database,
            {

                doctorId:
    null,
                appointmentId:
                    appointment.id,

                patientPhone:
                    appointment.patientPhone,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "appointment_started",

                title:
                    "حان دورك الآن 🩺",

                message:
                    `حان دورك مع ${req.doctor.name}.`

            }
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم بدء الموعد",

            appointment

        });
    }
);

// ============================================================
// COMPLETE APPOINTMENT
// ============================================================

app.post(
    "/api/appointments/:bookingNumber/complete",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                        String(
                            req.params.bookingNumber
                        ) &&
                    Number(
                        item.doctorId
                    ) ===
                        Number(
                            req.doctor.id
                        )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الموعد غير موجود"
                });
        }

        if (
            appointment.status !==
            "started"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "لا يمكن إنهاء الموعد قبل بدء الفحص"
                });
        }

        appointment.status =
            "completed";

        appointment.completedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        createNotification(
            database,
            {

                doctorId:
                    req.doctor.id,

                appointmentId:
                    appointment.id,

                patientPhone:
                    appointment.patientPhone,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "appointment_completed",

                title:
                    "تم إنهاء الموعد",

                message:
                    `تم إنهاء موعدك مع ${req.doctor.name} بنجاح.`

            }
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم إنهاء الموعد",

            appointment

        });
    }
);

// ============================================================
// DELETE OLD DOCTOR APPOINTMENTS
// ============================================================

app.delete(
    "/api/doctor/appointments/old",
    checkDoctorAuth,
    async (req, res) => {

        try {

            const database =
                readDatabase();

            const doctorId =
                Number(
                    req.doctor.id
                );

            // الوقت الحالي بتوقيت الجزائر
            const now =
                new Date();

            const today =
                new Intl.DateTimeFormat(
                    "en-CA",
                    {
                        timeZone:
                            "Africa/Algiers"
                    }
                ).format(now);

            const currentTime =
                new Intl.DateTimeFormat(
                    "en-GB",
                    {
                        timeZone:
                            "Africa/Algiers",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false
                    }
                ).format(now);

            const oldAppointments =
                database.appointments.filter(
                    appointment => {

                        // نتعامل فقط مع مواعيد هذا الطبيب
                        if (
                            Number(
                                appointment.doctorId
                            ) !== doctorId
                        ) {
                            return false;
                        }

                        if (
                            !appointment.date ||
                            !appointment.time
                        ) {
                            return false;
                        }

                        const appointmentDate =
                            String(
                                appointment.date
                            ).trim();

                        const appointmentTime =
                            String(
                                appointment.time
                            ).trim();

                        // تاريخ أقدم من اليوم
                        if (
                            appointmentDate <
                            today
                        ) {
                            return true;
                        }

                        // تاريخ اليوم والساعة فاتت
                        if (
                            appointmentDate ===
                            today &&
                            appointmentTime <=
                            currentTime
                        ) {
                            return true;
                        }

                        return false;
                    }
                );

            const deletedCount =
                oldAppointments.length;

            // حذف المواعيد القديمة فقط
            database.appointments =
                database.appointments.filter(
                    appointment => {

                        if (
                            Number(
                                appointment.doctorId
                            ) !== doctorId
                        ) {
                            return true;
                        }

                        if (
                            !appointment.date ||
                            !appointment.time
                        ) {
                            return true;
                        }

                        const appointmentDate =
                            String(
                                appointment.date
                            ).trim();

                        const appointmentTime =
                            String(
                                appointment.time
                            ).trim();

                        const isOld =
                            appointmentDate <
                            today ||
                            (
                                appointmentDate ===
                                today &&
                                appointmentTime <=
                                currentTime
                            );

                        return !isOld;
                    }
                );

            if (
                deletedCount > 0
            ) {

                await saveDatabase(
                    database
                );
            }

            res.json({

                success: true,

                message:
                    deletedCount > 0
                        ? `تم حذف ${deletedCount} موعد قديم`
                        : "لا توجد مواعيد قديمة للحذف",

                deletedCount,

                today,

                currentTime

            });

        } catch (error) {

            console.error(
                "خطأ في حذف المواعيد القديمة:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء حذف المواعيد القديمة"

            });
        }
    }
);

// ============================================================
// ADMIN LOGIN
// ============================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        const providedKey =
            req.body.key ||
            req.body.adminKey ||
            req.headers["x-admin-key"];

        if (
            !providedKey ||
            providedKey !== ADMIN_KEY
        ) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "مفتاح الإدارة غير صحيح"
                });
        }

        res.json({

            success: true,

            token:
                ADMIN_KEY,

            message:
                "تم تسجيل الدخول بنجاح"

        });
    }
);

// ============================================================
// ADMIN STATS
// ============================================================

app.get(
    "/api/admin/stats",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const appointments =
            database.appointments;

        const doctors =
            database.doctors;

        res.json({

            success: true,

            stats: {

                doctors:
                    doctors.length,

                activeDoctors:
                    doctors.filter(
                        doctor =>
                            doctor.active !== false
                    ).length,

                onlineDoctors:
                    doctors.filter(
                        doctor =>
                            doctor.online === true
                    ).length,

                appointments:
                    appointments.length,

                pending:
                    appointments.filter(
                        item =>
                            item.status ===
                            "pending"
                    ).length,

                confirmed:
                    appointments.filter(
                        item =>
                            [
                                "confirmed",
                                "accepted"
                            ].includes(
                                item.status
                            )
                    ).length,

                started:
                    appointments.filter(
                        item =>
                            item.status ===
                            "started"
                    ).length,

                completed:
                    appointments.filter(
                        item =>
                            item.status ===
                            "completed"
                    ).length,

                rejected:
                    appointments.filter(
                        item =>
                            item.status ===
                            "rejected"
                    ).length

            }

        });
    }
);

// ============================================================
// ADMIN APPOINTMENTS
// ============================================================

app.get(
    "/api/admin/appointments",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const {
            status,
            doctorId,
            date,
            search
        } = req.query;

        let appointments =
            [...database.appointments];

        if (status) {

            appointments =
                appointments.filter(
                    appointment =>
                        appointment.status ===
                        status
                );
        }

        if (doctorId) {

            appointments =
                appointments.filter(
                    appointment =>
                        Number(
                            appointment.doctorId
                        ) ===
                        Number(
                            doctorId
                        )
                );
        }

        if (date) {

            appointments =
                appointments.filter(
                    appointment =>
                        String(
                            appointment.date
                        ) ===
                        String(date)
                );
        }

        if (search) {

            const query =
                String(
                    search
                )
                .toLowerCase()
                .trim();

            appointments =
                appointments.filter(
                    appointment => {

                        return (

                            String(
                                appointment.patientName
                            )
                            .toLowerCase()
                            .includes(query) ||

                            String(
                                appointment.patientPhone
                            )
                            .toLowerCase()
                            .includes(query) ||

                            String(
                                appointment.bookingNumber
                            )
                            .toLowerCase()
                            .includes(query)

                        );

                    }
                );
        }

        appointments.sort(
            (a, b) =>
                new Date(
                    b.createdAt || 0
                ) -
                new Date(
                    a.createdAt || 0
                )
        );

        res.json({

            success: true,

            count:
                appointments.length,

            appointments

        });
    }
);

// ============================================================
// ADMIN DOCTORS
// ============================================================

app.get(
    "/api/admin/doctors",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        res.json({

            success: true,

            count:
                database.doctors.length,

            doctors:
                cleanDoctors(
                    database.doctors
                )

        });
    }
);

// ============================================================
// ADMIN ADD DOCTOR
// ============================================================

app.post(
    "/api/admin/doctors",
    checkAdminKey,
    (req, res) => {

        const {

            name,
            specialty,
            wilaya,
            municipality,
            phone,
            whatsapp,
            duration,
            password,
            loginPassword

        } = req.body;

        if (
            !name ||
            !specialty ||
            !wilaya ||
            !municipality ||
            !phone
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "الاسم والتخصص والولاية والبلدية والهاتف مطلوبة"
                });
        }

        const database =
            readDatabase();

        const normalizedPhone =
            normalizePhone(
                phone
            );

        const normalizedWhatsapp =
            normalizePhone(
                whatsapp ||
                phone
            );

        const duplicate =
            database.doctors.find(
                doctor => {

                    const existingPhone =
                        normalizePhone(
                            doctor.phone
                        );

                    const existingWhatsapp =
                        normalizePhone(
                            doctor.whatsapp
                        );

                    return (
                        existingPhone ===
                            normalizedPhone ||

                        existingWhatsapp ===
                            normalizedPhone ||

                        existingPhone ===
                            normalizedWhatsapp ||

                        existingWhatsapp ===
                            normalizedWhatsapp
                    );
                }
            );

        if (duplicate) {

            return res
                .status(409)
                .json({
                    success: false,
                    message:
                        "رقم الهاتف موجود مسبقا"
                });
        }

        const doctor = {

            id:
                generateId(
                    database.doctors
                ),

            name:
                String(name).trim(),

            specialty:
                String(
                    specialty
                ).trim(),

            wilaya:
                String(
                    wilaya
                ).trim(),

            municipality:
                String(
                    municipality
                ).trim(),

            phone:
                normalizedPhone,

            whatsapp:
                normalizedWhatsapp,

            duration:
                Number(duration) ||
                15,

            active: true,

            online: false,

            loginPassword:
                password ||
                loginPassword ||
                "123456",

            workingHours: {

                enabled: true,

                days: [
                    0,
                    1,
                    2,
                    3,
                    4
                ],

                open: "08:00",

                close: "17:00"

            },

            vacation: {

                enabled: false,

                startDate: "",

                endDate: ""

            },

            createdAt:
                new Date().toISOString()

        };

        database.doctors.push(
            doctor
        );

        saveDatabase(
            database
        );

        res
            .status(201)
            .json({

                success: true,

                message:
                    "تمت إضافة الطبيب بنجاح",

                doctor:
                    cleanDoctor(
                        doctor
                    )

            });
    }
);

// ============================================================
// ADMIN UPDATE DOCTOR
// ============================================================

app.put(
    "/api/admin/doctors/:id",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const doctor =
            database.doctors.find(
                item =>
                    Number(item.id) ===
                    Number(req.params.id)
            );

        if (!doctor) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الطبيب غير موجود"
                });
        }

        const body =
            req.body;

        // ----------------------------------------------------
        // Check duplicate phone when changing
        // ----------------------------------------------------

        if (
            body.phone !== undefined
        ) {

            const newPhone =
                normalizePhone(
                    body.phone
                );

            const duplicate =
                database.doctors.find(
                    item =>
                        Number(item.id) !==
                            Number(
                                doctor.id
                            ) &&
                        normalizePhone(
                            item.phone
                        ) === newPhone
                );

            if (duplicate) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "رقم الهاتف موجود عند طبيب آخر"
                    });
            }

            doctor.phone =
                newPhone;
        }

        if (
            body.whatsapp !== undefined
        ) {

            doctor.whatsapp =
                normalizePhone(
                    body.whatsapp
                );
        }

        if (
            body.name !== undefined
        ) {
            doctor.name =
                String(
                    body.name
                ).trim();
        }

        if (
            body.specialty !== undefined
        ) {
            doctor.specialty =
                String(
                    body.specialty
                ).trim();
        }

        if (
            body.wilaya !== undefined
        ) {
            doctor.wilaya =
                String(
                    body.wilaya
                ).trim();
        }

        if (
            body.municipality !== undefined
        ) {
            doctor.municipality =
                String(
                    body.municipality
                ).trim();
        }

        if (
            body.duration !== undefined
        ) {

            const duration =
                Number(
                    body.duration
                );

            if (
                Number.isFinite(
                    duration
                ) &&
                duration > 0
            ) {

                doctor.duration =
                    duration;
            }
        }

        if (
            body.active !== undefined
        ) {

            doctor.active =
                Boolean(
                    body.active
                );

            if (
                doctor.active === false
            ) {

                doctor.online =
                    false;

                // Remove active sessions
                for (
                    const [
                        token,
                        session
                    ]
                    of doctorSessions
                ) {

                    if (
                        Number(
                            session.doctorId
                        ) ===
                        Number(
                            doctor.id
                        )
                    ) {

                        doctorSessions.delete(
                            token
                        );
                    }
                }
            }
        }

        if (
            body.password ||
            body.loginPassword
        ) {

            doctor.loginPassword =
                body.password ||
                body.loginPassword;
        }

        if (
            body.workingHours &&
            typeof body.workingHours ===
                "object"
        ) {

            doctor.workingHours =
                body.workingHours;
        }

        if (
            body.vacation &&
            typeof body.vacation ===
                "object"
        ) {

            doctor.vacation =
                body.vacation;
        }

        doctor.updatedAt =
            new Date().toISOString();

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم تحديث بيانات الطبيب",

            doctor:
                cleanDoctor(
                    doctor
                )

        });
    }
);

// ============================================================
// ADMIN DELETE DOCTOR
// ============================================================

app.delete(
    "/api/admin/doctors/:id",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const doctorIndex =
            database.doctors.findIndex(
                doctor =>
                    Number(
                        doctor.id
                    ) ===
                    Number(
                        req.params.id
                    )
            );

        if (
            doctorIndex === -1
        ) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الطبيب غير موجود"
                });
        }

        const doctor =
            database.doctors[
                doctorIndex
            ];

        // ----------------------------------------------------
        // Delete doctor sessions
        // ----------------------------------------------------

        for (
            const [
                token,
                session
            ]
            of doctorSessions
        ) {

            if (
                Number(
                    session.doctorId
                ) ===
                Number(
                    doctor.id
                )
            ) {

                doctorSessions.delete(
                    token
                );
            }
        }

        // ----------------------------------------------------
        // Keep appointments history
        // ----------------------------------------------------

        database.doctors.splice(
            doctorIndex,
            1
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم حذف الطبيب مع الحفاظ على سجل المواعيد"

        });
    }
);

// ============================================================
// ADMIN ACCEPT APPOINTMENT
// ============================================================

app.post(
    "/api/admin/appointments/:bookingNumber/accept",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                    String(
                        req.params.bookingNumber
                    )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الموعد غير موجود"
                });
        }

        if (
            appointment.status !==
            "pending"
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "لا يمكن قبول الموعد في حالته الحالية"
                });
        }

        appointment.status =
            "confirmed";

        appointment.confirmedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        createNotification(
            database,
            {

                doctorId:
                    appointment.doctorId,

                appointmentId:
                    appointment.id,

                patientPhone:
                    appointment.patientPhone,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "appointment_confirmed",

                title:
                    "تم تأكيد الموعد من الإدارة",

                message:
                    `تم تأكيد موعدك مع ${appointment.doctorName}.`

            }
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم قبول الموعد",

            appointment

        });
    }
);

// ============================================================
// ADMIN REJECT APPOINTMENT
// ============================================================

app.post(
    "/api/admin/appointments/:bookingNumber/reject",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                item =>
                    String(
                        item.bookingNumber
                    ) ===
                    String(
                        req.params.bookingNumber
                    )
            );

        if (!appointment) {

            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "الموعد غير موجود"
                });
        }

        const allowedStatuses = [

            "pending",
            "confirmed",
            "accepted"

        ];

        if (
            !allowedStatuses.includes(
                appointment.status
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "لا يمكن رفض الموعد في حالته الحالية"
                });
        }

        const reason =
            req.body.reason ||
            "تم رفض الموعد من الإدارة";

        appointment.status =
            "rejected";

        appointment.rejectionReason =
            reason;

        appointment.rejectedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        createNotification(
            database,
            {

                doctorId:
                    appointment.doctorId,

                appointmentId:
                    appointment.id,

                patientPhone:
                    appointment.patientPhone,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "appointment_rejected",

                title:
                    "تم رفض الموعد",

                message:
                    `تم رفض موعدك. السبب: ${reason}`

            }
        );

        saveDatabase(
            database
        );

        res.json({

            success: true,

            message:
                "تم رفض الموعد",

            appointment

        });
    }
);

// ============================================================
// ADMIN NOTIFICATIONS - GET
// ============================================================

app.get(
    "/api/admin/notifications",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const notifications =
            [...database.notifications]
                .sort(
                    (a, b) =>
                        new Date(
                            b.createdAt
                        ) -
                        new Date(
                            a.createdAt
                        )
                )
                .slice(
                    0,
                    200
                );

        res.json({

            success: true,

            notifications

        });
    }
);

// ============================================================
// ADMIN NOTIFICATION - CREATE
// ============================================================

app.post(
    "/api/admin/notifications",
    checkAdminKey,
    (req, res) => {

        const {

            doctorId,
            patientPhone,
            bookingNumber,
            type,
            title,
            message

        } = req.body;

        if (
            !title ||
            !message
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "العنوان والرسالة مطلوبان"
                });
        }

        const database =
            readDatabase();

        const notification =
            createNotification(
                database,
                {

                    doctorId:
                        doctorId === undefined ||
                        doctorId === null ||
                        doctorId === ""
                            ? null
                            : Number(
                                doctorId
                            ),

                    patientPhone:
                        patientPhone || "",

                    bookingNumber:
                        bookingNumber || "",

                    type:
                        type || "admin",

                    title,

                    message

                }
            );

        saveDatabase(
            database
        );

        res
            .status(201)
            .json({

                success: true,

                message:
                    "تم إنشاء الإشعار",

                notification

            });
    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/api/health",
    (req, res) => {

        const database =
            readDatabase();

        res.json({

            success: true,

            app:
                "TABIBK",

            message:
                "سيرفر طبيبك يعمل بنجاح 🩺",

            version:
                "1.0.0",

            status:
                databaseReady
                    ? "online"
                    : "starting",

            database:
                pgPool
                    ? "postgresql"
                    : "not-configured",

            doctors:
                database.doctors.length,

            appointments:
                database.appointments.length,

            time:
                new Date().toISOString()

        });
    }
);

// ============================================================
// PATIENT REMINDERS
// ============================================================

function processPatientReminders() {

    try {

        const database =
            readDatabase();

        const now =
            Date.now();

        let changed = false;

        const appointments =
            database.appointments.filter(
                appointment =>
                    [
                        "confirmed",
                        "accepted"
                    ].includes(
                        appointment.status
                    )
            );

        for (
            const appointment
            of appointments
        ) {

            if (
                !appointment.date ||
                !appointment.time
            ) {
                continue;
            }

            const appointmentTime =
                new Date(
                    `${appointment.date}T${appointment.time}:00+01:00`
                ).getTime();

            if (
                Number.isNaN(
                    appointmentTime
                )
            ) {
                continue;
            }

            const minutesLeft =
                (
                    appointmentTime -
                    now
                ) /
                (
                    60 *
                    1000
                );

            // ------------------------------------------------
            // 24-hour reminder
            // ------------------------------------------------

            if (
                minutesLeft <= 1440 &&
                minutesLeft > 60 &&
                !appointment.reminder24hSent
            ) {

                createNotification(
                    database,
                    {

                        appointmentId:
                            appointment.id,

                        patientPhone:
                            appointment.patientPhone,

                        bookingNumber:
                            appointment.bookingNumber,

                        type:
                            "reminder_24h",

                        title:
                            "تذكير بموعدك 📅",

                        message:
                            `تذكير: لديك موعد مع ${appointment.doctorName} غدا بتاريخ ${appointment.date} على الساعة ${appointment.time}.`

                    }
                );

                appointment.reminder24hSent =
                    true;

                changed = true;
            }

            // ------------------------------------------------
            // 1-hour reminder
            // ------------------------------------------------

            if (
                minutesLeft <= 60 &&
                minutesLeft > 0 &&
                !appointment.reminder1hSent
            ) {

                createNotification(
                    database,
                    {

                        appointmentId:
                            appointment.id,

                        patientPhone:
                            appointment.patientPhone,

                        bookingNumber:
                            appointment.bookingNumber,

                        type:
                            "reminder_1h",

                        title:
                            "موعدك بعد قليل ⏰",

                        message:
                            `تذكير: موعدك مع ${appointment.doctorName} بعد أقل من ساعة، على الساعة ${appointment.time}.`

                    }
                );

                appointment.reminder1hSent =
                    true;

                changed = true;
            }
        }

        if (changed) {

            saveDatabase(
                database
            );
        }

    } catch (error) {

        console.error(
            "Reminder processing error:",
            error
        );
    }
}

// ============================================================
// CLEAN EXPIRED SESSIONS
// ============================================================

function cleanExpiredSessions() {

    const now =
        Date.now();

    const database =
        readDatabase();

    for (
        const [
            token,
            session
        ]
        of doctorSessions
    ) {

        if (
            now >
            session.expiresAt
        ) {

            doctorSessions.delete(
                token
            );

            const doctor =
                database.doctors.find(
                    item =>
                        Number(
                            item.id
                        ) ===
                        Number(
                            session.doctorId
                        )
                );

            if (doctor) {

                doctor.online =
                    false;
            }
        }
    }

    saveDatabase(
        database
    );
}

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res
            .status(404)
            .json({

                success: false,

                message:
                    "المسار غير موجود"

            });
    }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );

        res
            .status(500)
            .json({

                success: false,

                message:
                    "حدث خطأ داخلي في السيرفر"

            });
    }
);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {

    try {

        await initializeDatabase();

        // Process reminders once at startup
        processPatientReminders();

        // Reminders every minute
        setInterval(
            processPatientReminders,
            60 * 1000
        );

        // Clean expired doctor sessions hourly
        setInterval(
            cleanExpiredSessions,
            60 * 60 * 1000
        );

        app.listen(
            PORT,
            () => {

                console.log(
                    "================================================"
                );

                console.log(
                    "TABIBK SERVER STARTED"
                );

                console.log(
                    `PORT: ${PORT}`
                );

                console.log(
                    "DATABASE: PostgreSQL"
                );

                console.log(
                    "STATUS: ONLINE 🩺"
                );

                console.log(
                    "================================================"
                );

            }
        );

    } catch (error) {

        console.error(
            "Failed to start TABIBK:",
            error
        );

        process.exit(1);
    }
}

startServer();
