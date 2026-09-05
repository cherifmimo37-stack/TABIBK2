// ============================================================
// TABIBK | Medical Appointment Booking System
// server.js - Version 3.0
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

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

const doctorSessions = new Map();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json({
    limit: "2mb"
}));

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(
    path.join(__dirname, "public")
));

// ============================================================
// DATABASE - POSTGRESQL
// ============================================================

let databaseCache = null;
let databaseReady = false;
let databaseInitPromise = null;
let pgPool = null;


// ============================================================
// POSTGRESQL CONNECTION
// ============================================================

if (process.env.DATABASE_URL) {

    const { Pool } = require("pg");

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

                name: "ورڤلة",

                municipalities: [

                    "ورڤلة",
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

    database =
        database &&
        typeof database === "object"

            ? database

            : createEmptyDatabase();


    database.wilayas =
        Array.isArray(database.wilayas)

            ? database.wilayas

            : [];


    database.doctors =
        Array.isArray(database.doctors)

            ? database.doctors

            : [];


    database.appointments =
        Array.isArray(database.appointments)

            ? database.appointments

            : [];


    database.notifications =
        Array.isArray(database.notifications)

            ? database.notifications

            : [];


    return database;

}


// ============================================================
// READ OLD DATABASE.JSON
// ============================================================

function readLegacyDatabase() {

    try {

        if (
            typeof DATABASE_FILE === "string" &&
            fs.existsSync(DATABASE_FILE)
        ) {

            const content =
                fs.readFileSync(
                    DATABASE_FILE,
                    "utf8"
                );


            if (content.trim()) {

                return normalizeDatabase(
                    JSON.parse(content)
                );

            }

        }

    } catch (error) {

        console.error(
            "Legacy database read error:",
            error
        );

    }


    return createEmptyDatabase();

}


// ============================================================
// READ DATABASE
// ============================================================

function readDatabase() {

    if (!databaseCache) {

        databaseCache =
            createEmptyDatabase();

    }

    return databaseCache;

}


// ============================================================
// SAVE DATABASE
// ============================================================

function saveDatabase(database) {

    database =
        normalizeDatabase(database);


    databaseCache =
        database;


    if (
        !pgPool ||
        !databaseReady
    ) {

        console.error(
            "Database is not ready for saving."
        );

        return false;

    }


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

        ON CONFLICT (id)

        DO UPDATE SET

            data = EXCLUDED.data,

            updated_at = NOW()
        `,

        [
            JSON.stringify(database)
        ]

    )

    .then(() => {

        console.log(
            "Database saved successfully."
        );

    })

    .catch(error => {

        console.error(
            "Database save error:",
            error
        );

    });


    return true;

}


// ============================================================
// INITIALIZE POSTGRESQL
// ============================================================

async function initializeDatabase() {

    if (databaseInitPromise) {

        return databaseInitPromise;

    }


    databaseInitPromise =
        (async () => {

            if (!pgPool) {

                throw new Error(
                    "DATABASE_URL is not configured."
                );

            }


            console.log(
                "Connecting to PostgreSQL..."
            );


            await pgPool.query(
                "SELECT 1"
            );


            console.log(
                "PostgreSQL connection successful."
            );


            // ------------------------------------------------
            // CREATE TABLE
            // ------------------------------------------------

            await pgPool.query(

                `
                CREATE TABLE IF NOT EXISTS tabibk_data (

                    id INTEGER PRIMARY KEY,

                    data JSONB NOT NULL,

                    updated_at
                    TIMESTAMPTZ
                    NOT NULL
                    DEFAULT NOW()

                )
                `

            );


            console.log(
                "TABIBK PostgreSQL table ready."
            );


            // ------------------------------------------------
            // CHECK EXISTING DATA
            // ------------------------------------------------

            const result =
                await pgPool.query(

                    `
                    SELECT data

                    FROM tabibk_data

                    WHERE id = 1

                    LIMIT 1
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
                    "TABIBK data loaded from PostgreSQL."
                );

            } else {

                // --------------------------------------------
                // FIRST MIGRATION FROM database.json
                // --------------------------------------------

                databaseCache =
                    readLegacyDatabase();


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
                    "Legacy database.json migrated to PostgreSQL."
                );

            }


            databaseReady = true;


            console.log(
                "TABIBK DATABASE READY."
            );


            return databaseCache;

        })();


    return databaseInitPromise;

}
// ============================================================
// HELPERS
// ============================================================

function generateBookingNumber() {

    const now =
        new Date();

    const date =
        now.getFullYear().toString() +
        String(
            now.getMonth() + 1
        ).padStart(2, "0") +
        String(
            now.getDate()
        ).padStart(2, "0");

    const random =
        Math.floor(
            100000 +
            Math.random() * 900000
        );

    return `TBK-${date}-${random}`;
}


function generateId(array) {

    if (!array.length) {
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


function cleanDoctor(doctor) {

    if (!doctor) {
        return null;
    }

    const safeDoctor = {
        ...doctor
    };

    delete safeDoctor.password;
    delete safeDoctor.loginPassword;

    return safeDoctor;
}


function cleanDoctors(doctors) {

    return doctors.map(
        cleanDoctor
    );
}


function getDoctorPassword(doctor) {

    if (!doctor) {
        return null;
    }

    return (
        doctor.password ||
        doctor.loginPassword ||
        "123456"
    );
}


function normalizePhone(phone) {

    return String(
        phone || ""
    )
        .replace(/\s+/g, "")
        .replace(/^00/, "+");
}


function createDoctorToken() {

    return crypto.randomBytes(48)
        .toString("hex");
}


function getTokenFromRequest(req) {

    const authorization =
        req.headers.authorization;

    if (
        !authorization ||
        !authorization.startsWith("Bearer ")
    ) {

        return null;
    }

    return authorization.substring(7);
}


// ============================================================
// ADMIN AUTH
// ============================================================

function checkAdminKey(req, res, next) {

    const key =
        req.headers["x-admin-key"];

    if (!key || key !== ADMIN_KEY) {

        return res.status(401).json({

            success: false,

            message: "غير مصرح بالدخول إلى لوحة الإدارة"
        });
    }

    next();
}


// ============================================================
// DOCTOR AUTH
// ============================================================

function checkDoctorAuth(req, res, next) {

    const token =
        getTokenFromRequest(req);

    if (!token) {

        return res.status(401).json({

            success: false,

            message: "يجب تسجيل دخول الطبيب"
        });
    }

    const session =
        doctorSessions.get(token);

    if (!session) {

        return res.status(401).json({

            success: false,

            message: "جلسة الطبيب غير صالحة"
        });
    }

    if (
        Date.now() >
        session.expiresAt
    ) {

        doctorSessions.delete(token);

        return res.status(401).json({

            success: false,

            message: "انتهت جلسة الطبيب، أعد تسجيل الدخول"
        });
    }

    const database =
        readDatabase();

    const doctor =
        database.doctors.find(
            d =>
                Number(d.id) ===
                Number(session.doctorId)
        );

    if (!doctor) {

        doctorSessions.delete(token);

        return res.status(401).json({

            success: false,

            message: "الطبيب غير موجود"
        });
    }

    if (
        doctor.status &&
        doctor.status !== "active"
    ) {

        return res.status(403).json({

            success: false,

            message: "حساب الطبيب غير مفعل"
        });
    }

    req.doctor =
        doctor;

    req.doctorToken =
        token;

    next();
}


// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {

    const indexPath =
        path.join(
            __dirname,
            "public",
            "index.html"
        );

    if (fs.existsSync(indexPath)) {

        return res.sendFile(indexPath);
    }

    res.json({

        success: true,

        app: "TABIBK",

        message:
            "نظام حجز المواعيد الطبية يعمل بنجاح"
    });
});


// ============================================================
// WILAYAS
// ============================================================

app.get(
    "/api/wilayas",
    (req, res) => {

        const database =
            readDatabase();

        res.json({

            success: true,

            wilayas:
                database.wilayas
        });
    }
);


// ============================================================
// MUNICIPALITIES
// ============================================================

app.get(
    "/api/wilayas/:wilayaId/municipalities",
    (req, res) => {

        const database =
            readDatabase();

        const wilaya =
            database.wilayas.find(
                w =>
                    Number(w.id) ===
                    Number(req.params.wilayaId)
            );

        if (!wilaya) {

            return res.status(404).json({

                success: false,

                message: "الولاية غير موجودة"
            });
        }

        res.json({

            success: true,

            municipalities:
                wilaya.municipalities || []
        });
    }
);


// ============================================================
// PUBLIC DOCTORS
// ============================================================

app.get(
    "/api/doctors",
    (req, res) => {

        const database =
            readDatabase();

        let doctors =
            database.doctors;

        const {
            wilaya,
            municipality,
            specialty,
            status
        } = req.query;

        if (wilaya) {

            doctors =
                doctors.filter(
                    doctor =>
                        doctor.wilaya ===
                        wilaya
                );
        }

        if (municipality) {

            doctors =
                doctors.filter(
                    doctor =>
                        doctor.municipality ===
                        municipality
                );
        }

        if (specialty) {

            doctors =
                doctors.filter(
                    doctor =>
                        doctor.specialty ===
                        specialty
                );
        }

        if (status) {

            doctors =
                doctors.filter(
                    doctor =>
                        doctor.status ===
                        status
                );
        }

        res.json({

            success: true,

            doctors:
                cleanDoctors(doctors)
        });
    }
);


// ============================================================
// PUBLIC SINGLE DOCTOR
// ============================================================

app.get(
    "/api/doctors/:id",
    (req, res) => {

        const database =
            readDatabase();

        const doctor =
            database.doctors.find(
                d =>
                    Number(d.id) ===
                    Number(req.params.id)
            );

        if (!doctor) {

            return res.status(404).json({

                success: false,

                message: "الطبيب غير موجود"
            });
        }

        res.json({

            success: true,

            doctor:
                cleanDoctor(doctor)
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

            const database =
                readDatabase();

            const phone =
                normalizePhone(
                    req.body.phone
                );

            const password =
                String(
                    req.body.password || ""
                );

            if (!phone || !password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "أدخل رقم الهاتف وكلمة المرور"
                });
            }

            const doctor =
                database.doctors.find(
                    d =>
                        normalizePhone(
                            d.phone
                        ) === phone ||
                        normalizePhone(
                            d.whatsapp
                        ) === phone
                );

            if (!doctor) {

                return res.status(401).json({

                    success: false,

                    message:
                        "رقم الهاتف أو كلمة المرور غير صحيحة"
                });
            }

            if (
                doctor.status &&
                doctor.status !== "active"
            ) {

                return res.status(403).json({

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
                String(doctorPassword) !==
                password
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "رقم الهاتف أو كلمة المرور غير صحيحة"
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
                        Number(doctor.id),

                    expiresAt
                }
            );

            doctor.lastLoginAt =
                new Date().toISOString();

            doctor.online = true;

            saveDatabase(database);

            res.json({

                success: true,

                message:
                    "تم تسجيل الدخول بنجاح",

                token,

                expiresAt,

                doctor:
                    cleanDoctor(doctor)
            });

        } catch (error) {

            console.error(
                "Doctor login error:",
                error
            );

            res.status(500).json({

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

        const database =
            readDatabase();

        doctorSessions.delete(
            req.doctorToken
        );

        const doctor =
            database.doctors.find(
                d =>
                    Number(d.id) ===
                    Number(req.doctor.id)
            );

        if (doctor) {

            doctor.online = false;

            doctor.updatedAt =
                new Date().toISOString();

            saveDatabase(database);
        }

        res.json({

            success: true,

            message:
                "تم تسجيل الخروج"
        });
    }
);


// ============================================================
// CURRENT DOCTOR
// ============================================================

app.get(
    "/api/doctor/me",
    checkDoctorAuth,
    (req, res) => {

        res.json({

            success: true,

            doctor:
                cleanDoctor(req.doctor)
        });
    }
);


// ============================================================
// DOCTOR NOTIFICATIONS
// ============================================================

app.get(
    "/api/doctor/notifications",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const notifications =
            database.notifications.filter(
                notification =>
                    Number(
                        notification.doctorId
                    ) ===
                    Number(req.doctor.id)
            );

        res.json({

            success: true,

            notifications:
                notifications
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt) -
                            new Date(a.createdAt)
                    )
                    .slice(0, 100)
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

            const database =
                readDatabase();

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
                !doctorId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "الاسم ورقم الهاتف والطبيب مطلوبة"
                });
            }

            const doctor =
                database.doctors.find(
                    d =>
                        Number(d.id) ===
                        Number(doctorId)
                );

            if (!doctor) {

                return res.status(404).json({

                    success: false,

                    message:
                        "الطبيب غير موجود"
                });
            }

            if (
                doctor.status &&
                doctor.status !== "active"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "هذا الطبيب غير متاح حالياً"
                });
            }

            let queueNumber = 1;

            const today =
                date ||
                new Date()
                    .toISOString()
                    .split("T")[0];

            const doctorAppointments =
                database.appointments.filter(
                    appointment =>
                        Number(
                            appointment.doctorId
                        ) === Number(doctor.id) &&
                        appointment.date === today &&
                        [
                            "pending",
                            "confirmed",
                            "accepted",
                            "started"
                        ].includes(
                            appointment.status
                        )
                );

            if (
                doctorAppointments.length
            ) {

                queueNumber =
                    Math.max(
                        ...doctorAppointments.map(
                            appointment =>
                                Number(
                                    appointment.queueNumber
                                ) || 0
                        )
                    ) + 1;
            }

            const appointment = {

                id:
                    generateId(
                        database.appointments
                    ),

                bookingNumber:
                    generateBookingNumber(),

                patientName:
                    String(patientName).trim(),

                patientPhone:
                    String(patientPhone).trim(),

                patientAge:
                    patientAge
                        ? Number(patientAge)
                        : null,

                patientGender:
                    patientGender || "",

                reason:
                    reason || "",

                doctorId:
                    Number(doctor.id),

                doctorName:
                    doctor.name,

                specialty:
                    doctor.specialty,

                wilaya:
                    doctor.wilaya,

                municipality:
                    doctor.municipality,

                date:
                    today,

                time:
                    time || "",

                queueNumber,

                status:
                    "pending",

                notes:
                    notes || "",

                createdAt:
                    new Date().toISOString(),

                updatedAt:
                    new Date().toISOString()
            };

            database.appointments.push(
                appointment
            );

            database.notifications.push({

                id:
                    generateId(
                        database.notifications
                    ),

                doctorId:
                    Number(doctor.id),

                appointmentId:
                    appointment.id,

                bookingNumber:
                    appointment.bookingNumber,

                type:
                    "new_appointment",

                title:
                    "موعد جديد",

                message:
                    `لديك طلب موعد جديد من ${appointment.patientName}`,

                read:
                    false,

                createdAt:
                    new Date().toISOString()
            });

            saveDatabase(database);

            res.status(201).json({

                success: true,

                message:
                    "تم إرسال طلب الموعد بنجاح",

                appointment
            });

        } catch (error) {

            console.error(
                "Create appointment error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء إنشاء الموعد"
            });
        }
    }
);


// ============================================================
// GET APPOINTMENT BY BOOKING NUMBER
// ============================================================

app.get(
    "/api/appointments/:bookingNumber",
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "رقم الحجز غير موجود"
            });
        }

        res.json({

            success: true,

            appointment
        });
    }
);


// ============================================================
// GET DOCTOR APPOINTMENTS
// ============================================================

app.get(
    "/api/doctors/:id/appointments",
    checkDoctorAuth,
    (req, res) => {

        const requestedDoctorId =
            Number(req.params.id);

        if (
            requestedDoctorId !==
            Number(req.doctor.id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "لا يمكنك الوصول إلى مواعيد طبيب آخر"
            });
        }

        const database =
            readDatabase();

        const appointments =
            database.appointments.filter(
                appointment =>
                    Number(
                        appointment.doctorId
                    ) === requestedDoctorId
            );

        res.json({

            success: true,

            appointments:
                appointments.sort(
                    (a, b) => {

                        const queueA =
                            Number(
                                a.queueNumber
                            ) || 0;

                        const queueB =
                            Number(
                                b.queueNumber
                            ) || 0;

                        return queueA - queueB;
                    }
                )
        });
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
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الموعد غير موجود"
            });
        }

        if (
            Number(
                appointment.doctorId
            ) !==
            Number(req.doctor.id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "غير مصرح لك بتعديل هذا الموعد"
            });
        }

        appointment.status =
            "confirmed";

        appointment.confirmedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        database.notifications.push({

            id:
                generateId(
                    database.notifications
                ),

            doctorId:
                Number(req.doctor.id),

            appointmentId:
                appointment.id,

            bookingNumber:
                appointment.bookingNumber,

            type:
                "appointment_confirmed",

            title:
                "تم تأكيد الموعد",

            message:
                `تم تأكيد موعد ${appointment.patientName}`,

            read:
                false,

            createdAt:
                new Date().toISOString()
        });

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم تأكيد الموعد",

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
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الموعد غير موجود"
            });
        }

        if (
            Number(
                appointment.doctorId
            ) !==
            Number(req.doctor.id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "غير مصرح لك بتعديل هذا الموعد"
            });
        }

        appointment.status =
            "rejected";

        appointment.rejectionReason =
            req.body.reason ||
            "تم رفض الموعد من طرف الطبيب";

        appointment.rejectedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        database.notifications.push({

            id:
                generateId(
                    database.notifications
                ),

            doctorId:
                Number(req.doctor.id),

            appointmentId:
                appointment.id,

            bookingNumber:
                appointment.bookingNumber,

            type:
                "appointment_rejected",

            title:
                "تم رفض الموعد",

            message:
                `تم رفض موعد ${appointment.patientName}`,

            read:
                false,

            createdAt:
                new Date().toISOString()
        });

        saveDatabase(database);

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
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الموعد غير موجود"
            });
        }

        if (
            Number(
                appointment.doctorId
            ) !==
            Number(req.doctor.id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "غير مصرح لك بتعديل هذا الموعد"
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

            return res.status(400).json({

                success: false,

                message:
                    "لا يمكن بدء هذا الموعد حالياً"
            });
        }

        appointment.status =
            "started";

        appointment.startedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم بدء الكشف",

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
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الموعد غير موجود"
            });
        }

        if (
            Number(
                appointment.doctorId
            ) !==
            Number(req.doctor.id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "غير مصرح لك بتعديل هذا الموعد"
            });
        }

        appointment.status =
            "completed";

        appointment.completedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم إنهاء الكشف بنجاح",

            appointment
        });
    }
);


// ============================================================
// ADMIN LOGIN
// ============================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        const key =
            req.body.key ||
            req.body.password ||
            req.headers["x-admin-key"];

        if (
            !key ||
            key !== ADMIN_KEY
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "مفتاح الإدارة غير صحيح"
            });
        }

        res.json({

            success: true,

            message:
                "تم تسجيل الدخول إلى لوحة الإدارة",

            token:
                ADMIN_KEY
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

        const stats = {

            totalAppointments:
                appointments.length,

            pendingAppointments:
                appointments.filter(
                    a =>
                        a.status === "pending"
                ).length,

            confirmedAppointments:
                appointments.filter(
                    a =>
                        [
                            "confirmed",
                            "accepted"
                        ].includes(
                            a.status
                        )
                ).length,

            startedAppointments:
                appointments.filter(
                    a =>
                        a.status === "started"
                ).length,

            completedAppointments:
                appointments.filter(
                    a =>
                        a.status === "completed"
                ).length,

            rejectedAppointments:
                appointments.filter(
                    a =>
                        a.status === "rejected"
                ).length,

            totalDoctors:
                database.doctors.length,

            activeDoctors:
                database.doctors.filter(
                    doctor =>
                        doctor.status === "active"
                ).length,

            onlineDoctors:
                database.doctors.filter(
                    doctor =>
                        doctor.online === true
                ).length,

            totalNotifications:
                database.notifications.length
        };

        res.json({

            success: true,

            stats
        });
    }
);


// ============================================================
// ADMIN GET APPOINTMENTS
// ============================================================

app.get(
    "/api/admin/appointments",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        let appointments =
            database.appointments;

        const {
            status,
            doctorId,
            date,
            search
        } = req.query;

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
                        Number(doctorId)
                );
        }

        if (date) {

            appointments =
                appointments.filter(
                    appointment =>
                        appointment.date ===
                        date
                );
        }

        if (search) {

            const query =
                String(search)
                    .toLowerCase();

            appointments =
                appointments.filter(
                    appointment => {

                        return (
                            String(
                                appointment.patientName ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query)
                            ||
                            String(
                                appointment.patientPhone ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query)
                            ||
                            String(
                                appointment.bookingNumber ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query)
                        );
                    }
                );
        }

        appointments =
            appointments.sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );

        res.json({

            success: true,

            appointments
        });
    }
);


// ============================================================
// ADMIN GET DOCTORS
// ============================================================

app.get(
    "/api/admin/doctors",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        res.json({

            success: true,

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

        try {

            const database =
                readDatabase();

            const {
                name,
                specialty,
                wilaya,
                municipality,
                phone,
                whatsapp,
                status,
                consultationDuration,
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

                return res.status(400).json({

                    success: false,

                    message:
                        "الاسم والتخصص والولاية والبلدية والهاتف مطلوبة"
                });
            }

            const normalizedPhone =
                normalizePhone(phone);

            const exists =
                database.doctors.some(
                    doctor =>
                        normalizePhone(
                            doctor.phone
                        ) === normalizedPhone
                );

            if (exists) {

                return res.status(400).json({

                    success: false,

                    message:
                        "رقم الهاتف مستخدم من قبل"
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
                    String(specialty).trim(),

                wilaya:
                    String(wilaya).trim(),

                municipality:
                    String(municipality).trim(),

                phone:
                    String(phone).trim(),

                whatsapp:
                    whatsapp
                        ? String(whatsapp).trim()
                        : String(phone).trim(),

                status:
                    status || "active",

                consultationDuration:
                    Number(
                        consultationDuration
                    ) || 15,

                loginPassword:
                    String(
                        password ||
                        loginPassword ||
                        "123456"
                    ),

                online:
                    false,

                createdAt:
                    new Date().toISOString(),

                updatedAt:
                    new Date().toISOString()
            };

            database.doctors.push(
                doctor
            );

            saveDatabase(database);

            res.status(201).json({

                success: true,

                message:
                    "تم إضافة الطبيب بنجاح",

                doctor:
                    cleanDoctor(doctor)
            });

        } catch (error) {

            console.error(
                "Admin add doctor error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء إضافة الطبيب"
            });
        }
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
                d =>
                    Number(d.id) ===
                    Number(req.params.id)
            );

        if (!doctor) {

            return res.status(404).json({

                success: false,

                message:
                    "الطبيب غير موجود"
            });
        }

        const fields = [

            "name",
            "specialty",
            "wilaya",
            "municipality",
            "phone",
            "whatsapp",
            "status"

        ];

        fields.forEach(
            field => {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    doctor[field] =
                        req.body[field];
                }
            }
        );

        if (
            req.body.consultationDuration !==
            undefined
        ) {

            doctor.consultationDuration =
                Number(
                    req.body.consultationDuration
                ) || 15;
        }

        if (
            req.body.password !==
            undefined
        ) {

            doctor.loginPassword =
                String(
                    req.body.password
                );
        }

        if (
            req.body.loginPassword !==
            undefined
        ) {

            doctor.loginPassword =
                String(
                    req.body.loginPassword
                );
        }

        doctor.updatedAt =
            new Date().toISOString();

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم تحديث الطبيب بنجاح",

            doctor:
                cleanDoctor(doctor)
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
                d =>
                    Number(d.id) ===
                    Number(req.params.id)
            );

        if (
            doctorIndex === -1
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "الطبيب غير موجود"
            });
        }

        const doctor =
            database.doctors[
                doctorIndex
            ];

        database.doctors.splice(
            doctorIndex,
            1
        );

        // حذف جلسات الطبيب
        for (
            const [
                token,
                session
            ]
            of doctorSessions.entries()
        ) {

            if (
                Number(session.doctorId) ===
                Number(doctor.id)
            ) {

                doctorSessions.delete(
                    token
                );
            }
        }

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم حذف الطبيب بنجاح"
        });
    }
);


// ============================================================
// ADMIN APPOINTMENT ACTIONS
// ============================================================

app.post(
    "/api/admin/appointments/:bookingNumber/accept",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الموعد غير موجود"
            });
        }

        appointment.status =
            "confirmed";

        appointment.confirmedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم تأكيد الموعد",

            appointment
        });
    }
);


app.post(
    "/api/admin/appointments/:bookingNumber/reject",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    String(
                        req.params.bookingNumber
                    ).toUpperCase()
            );

        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الموعد غير موجود"
            });
        }

        appointment.status =
            "rejected";

        appointment.rejectionReason =
            req.body.reason ||
            "تم رفض الموعد من الإدارة";

        appointment.rejectedAt =
            new Date().toISOString();

        appointment.updatedAt =
            new Date().toISOString();

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم رفض الموعد",

            appointment
        });
    }
);


// ============================================================
// ADMIN NOTIFICATIONS
// ============================================================

app.get(
    "/api/admin/notifications",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const notifications =
            database.notifications
                .sort(
                    (a, b) =>
                        new Date(b.createdAt) -
                        new Date(a.createdAt)
                );

        res.json({

            success: true,

            notifications
        });
    }
);


app.post(
    "/api/admin/notifications",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();

        const {
            doctorId,
            title,
            message,
            type
        } = req.body;

        if (!title || !message) {

            return res.status(400).json({

                success: false,

                message:
                    "العنوان والرسالة مطلوبة"
            });
        }

        const notification = {

            id:
                generateId(
                    database.notifications
                ),

            doctorId:
                doctorId
                    ? Number(doctorId)
                    : null,

            type:
                type || "admin",

            title,

            message,

            read:
                false,

            createdAt:
                new Date().toISOString()
        };

        database.notifications.push(
            notification
        );

        saveDatabase(database);

        res.status(201).json({

            success: true,

            message:
                "تم إنشاء الإشعار",

            notification
        });
    }
);


// ============================================================
// MARK DOCTOR NOTIFICATION AS READ
// ============================================================

app.post(
    "/api/doctor/notifications/:id/read",
    checkDoctorAuth,
    (req, res) => {

        const database =
            readDatabase();

        const notification =
            database.notifications.find(
                notification =>
                    Number(
                        notification.id
                    ) ===
                    Number(req.params.id) &&
                    Number(
                        notification.doctorId
                    ) ===
                    Number(req.doctor.id)
            );

        if (!notification) {

            return res.status(404).json({

                success: false,

                message:
                    "الإشعار غير موجود"
            });
        }

        notification.read =
            true;

        notification.readAt =
            new Date().toISOString();

        saveDatabase(database);

        res.json({

            success: true,

            message:
                "تم تحديد الإشعار كمقروء"
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

            status: "online",

            app: "TABIBK",

            version: "3.0.0",

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
// 404
// ============================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "المسار غير موجود",

            path:
                req.originalUrl
        });
    }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "حدث خطأ داخلي في الخادم"
        });
    }
);


// ============================================================
// CLEAN EXPIRED DOCTOR SESSIONS
// ============================================================

setInterval(
    () => {

        const now =
            Date.now();

        for (
            const [
                token,
                session
            ]
            of doctorSessions.entries()
        ) {

            if (
                now >
                session.expiresAt
            ) {

                doctorSessions.delete(
                    token
                );
            }
        }

    },
    60 * 60 * 1000
);


// ============================================================
// START SERVER
// ============================================================

async function startServer() {

    try {

        // انتظار اتصال PostgreSQL وتجهيز قاعدة البيانات
        await initializeDatabase();


        // تشغيل السيرفر بعد نجاح قاعدة البيانات
        app.listen(
            PORT,
            () => {

                console.log(
                    "=========================================="
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
                    "Doctor authentication: ENABLED"
                );

                console.log(
                    "Persistent storage: ENABLED"
                );

                console.log(
                    "=========================================="
                );

            }
        );

    } catch (error) {

        console.error(
            "=========================================="
        );

        console.error(
            "TABIBK DATABASE STARTUP ERROR"
        );

        console.error(
            error
        );

        console.error(
            "Check DATABASE_URL in Render Environment Variables."
        );

        console.error(
            "=========================================="
        );

        process.exit(1);

    }

}


// ============================================================
// RUN SERVER
// ============================================================

startServer();
