const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const DATABASE_FILE = path.join(__dirname, "database.json");


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));


// ==================================================
// DATABASE FUNCTIONS
// ==================================================

function readDatabase() {

    try {

        if (!fs.existsSync(DATABASE_FILE)) {

            const emptyDatabase = {
                wilayas: [],
                doctors: [],
                appointments: [],
                notifications: []
            };

            fs.writeFileSync(
                DATABASE_FILE,
                JSON.stringify(emptyDatabase, null, 2),
                "utf8"
            );

            return emptyDatabase;
        }

        const data = fs.readFileSync(
            DATABASE_FILE,
            "utf8"
        );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Database read error:",
            error
        );

        return {
            wilayas: [],
            doctors: [],
            appointments: [],
            notifications: []
        };
    }
}


function saveDatabase(database) {

    try {

        fs.writeFileSync(
            DATABASE_FILE,
            JSON.stringify(database, null, 2),
            "utf8"
        );

        return true;

    } catch (error) {

        console.error(
            "Database save error:",
            error
        );

        return false;
    }
}


// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {

    res.json({

        success: true,

        app: "TABIBK",

        message:
            "سيرفر طبيبك يعمل بنجاح 🩺",

        version: "1.0.0",

        status: "online"

    });

});


// ==================================================
// WILAYAS
// ==================================================

app.get("/api/wilayas", (req, res) => {

    const database = readDatabase();

    res.json({

        success: true,

        count: database.wilayas.length,

        wilayas: database.wilayas

    });

});


// ==================================================
// MUNICIPALITIES
// ==================================================

app.get(
    "/api/wilayas/:wilayaId/municipalities",
    (req, res) => {

        const database = readDatabase();

        const wilaya = database.wilayas.find(
            w =>
                w.id === Number(req.params.wilayaId)
        );

        if (!wilaya) {

            return res.status(404).json({

                success: false,

                message: "الولاية غير موجودة"

            });

        }

        res.json({

            success: true,

            wilaya: wilaya.name,

            municipalities:
                wilaya.municipalities || []

        });

    }
);


// ==================================================
// DOCTORS
// ==================================================

app.get("/api/doctors", (req, res) => {

    const database = readDatabase();

    let doctors = database.doctors || [];

    const {
        wilaya,
        municipality,
        specialty
    } = req.query;


    if (wilaya) {

        doctors = doctors.filter(
            doctor =>
                doctor.wilaya === wilaya
        );

    }


    if (municipality) {

        doctors = doctors.filter(
            doctor =>
                doctor.municipality === municipality
        );

    }


    if (specialty) {

        doctors = doctors.filter(
            doctor =>
                doctor.specialty === specialty
        );

    }


    res.json({

        success: true,

        count: doctors.length,

        doctors

    });

});


// ==================================================
// SINGLE DOCTOR
// ==================================================

app.get(
    "/api/doctors/:id",
    (req, res) => {

        const database = readDatabase();

        const doctor = database.doctors.find(
            d =>
                d.id === Number(req.params.id)
        );


        if (!doctor) {

            return res.status(404).json({

                success: false,

                message: "الطبيب غير موجود"

            });

        }


        res.json({

            success: true,

            doctor

        });

    }
);


// ==================================================
// CREATE APPOINTMENT
// ==================================================

app.post(
    "/api/appointments",
    (req, res) => {

        const database = readDatabase();


        const {
            patientName,
            patientPhone,
            doctorId,
            reason
        } = req.body;


        // التحقق من البيانات

        if (
            !patientName ||
            !patientPhone ||
            !doctorId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "يرجى إدخال اسم المريض ورقم الهاتف والطبيب"

            });

        }


        // البحث عن الطبيب

        const doctor = database.doctors.find(
            d =>
                d.id === Number(doctorId)
        );


        if (!doctor) {

            return res.status(404).json({

                success: false,

                message: "الطبيب غير موجود"

            });

        }


        // حساب رقم الحجز

        const appointmentNumber =
            database.appointments.length + 1;


        const currentYear =
            new Date().getFullYear();


        const bookingNumber =
            `TBK-${currentYear}-${String(
                appointmentNumber
            ).padStart(4, "0")}`;


        // حساب رقم الدور عند الطبيب

        const doctorQueue =
            database.appointments.filter(
                appointment =>
                    appointment.doctorId === doctor.id &&
                    appointment.status !== "rejected"
            );


        const queueNumber =
            doctorQueue.length + 1;


        // إنشاء الحجز

        const appointment = {

            id: Date.now(),

            bookingNumber,

            patientName,

            patientPhone,

            doctorId: doctor.id,

            doctorName: doctor.name,

            specialty: doctor.specialty,

            wilaya: doctor.wilaya,

            municipality: doctor.municipality,

            reason: reason || "",

            status: "pending",

            queueNumber,

            createdAt:
                new Date().toISOString()

        };


        database.appointments.push(
            appointment
        );


        // إشعار للطبيب

        database.notifications.push({

            id: Date.now() + 1,

            type: "new_appointment",

            bookingNumber,

            doctorId: doctor.id,

            message:
                `طلب حجز جديد عند ${doctor.name}`,

            read: false,

            createdAt:
                new Date().toISOString()

        });


        saveDatabase(database);


        res.status(201).json({

            success: true,

            message:
                "تم إرسال طلب الحجز بنجاح 🎉",

            appointment

        });

    }
);


// ==================================================
// TRACK APPOINTMENT
// ==================================================

app.get(
    "/api/appointments/:bookingNumber",
    (req, res) => {

        const database = readDatabase();


        const bookingNumber =
            String(
                req.params.bookingNumber
            ).toUpperCase();


        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    bookingNumber
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "رقم الحجز غير موجود"

            });

        }


        // حجوزات نفس الطبيب

        const doctorAppointments =
            database.appointments.filter(
                a =>
                    a.doctorId ===
                    appointment.doctorId &&
                    a.status !== "rejected"
            );


        // الحجوزات المكتملة

        const completedAppointments =
            doctorAppointments.filter(
                a =>
                    a.status === "completed"
            );


        // الدور الحالي

        const currentTurn =
            completedAppointments.length + 1;


        // عدد المرضى قبل المريض

        const patientsBefore =
            Math.max(
                0,
                appointment.queueNumber -
                currentTurn
            );


        res.json({

            success: true,

            bookingNumber:
                appointment.bookingNumber,

            patientName:
                appointment.patientName,

            patientPhone:
                appointment.patientPhone,

            doctorName:
                appointment.doctorName,

            specialty:
                appointment.specialty,

            wilaya:
                appointment.wilaya,

            municipality:
                appointment.municipality,

            status:
                appointment.status,

            queueNumber:
                appointment.queueNumber,

            currentTurn,

            patientsBefore,

            createdAt:
                appointment.createdAt

        });

    }
);


// ==================================================
// DOCTOR APPOINTMENTS
// ==================================================

app.get(
    "/api/doctors/:id/appointments",
    (req, res) => {

        const database = readDatabase();


        const doctorId =
            Number(req.params.id);


        const doctor =
            database.doctors.find(
                d =>
                    d.id === doctorId
            );


        if (!doctor) {

            return res.status(404).json({

                success: false,

                message:
                    "الطبيب غير موجود"

            });

        }


        const appointments =
            database.appointments.filter(
                appointment =>
                    appointment.doctorId ===
                    doctorId
            );


        res.json({

            success: true,

            doctor: doctor.name,

            count:
                appointments.length,

            appointments

        });

    }
);


// ==================================================
// ACCEPT APPOINTMENT
// ==================================================

app.post(
    "/api/appointments/:bookingNumber/accept",
    (req, res) => {

        const database = readDatabase();


        const bookingNumber =
            String(
                req.params.bookingNumber
            ).toUpperCase();


        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    bookingNumber
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الحجز غير موجود"

            });

        }


        appointment.status =
            "confirmed";


        database.notifications.push({

            id: Date.now(),

            type:
                "appointment_accepted",

            bookingNumber:
                appointment.bookingNumber,

            patientPhone:
                appointment.patientPhone,

            message:
                "تم تأكيد موعدك من طرف الطبيب ✅",

            read: false,

            createdAt:
                new Date().toISOString()

        });


        saveDatabase(database);


        res.json({

            success: true,

            message:
                "تم تأكيد الحجز بنجاح ✅",

            appointment

        });

    }
);


// ==================================================
// REJECT APPOINTMENT
// ==================================================

app.post(
    "/api/appointments/:bookingNumber/reject",
    (req, res) => {

        const database = readDatabase();


        const bookingNumber =
            String(
                req.params.bookingNumber
            ).toUpperCase();


        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    bookingNumber
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الحجز غير موجود"

            });

        }


        appointment.status =
            "rejected";


        database.notifications.push({

            id: Date.now(),

            type:
                "appointment_rejected",

            bookingNumber:
                appointment.bookingNumber,

            patientPhone:
                appointment.patientPhone,

            message:
                "تم رفض طلب الحجز ❌",

            read: false,

            createdAt:
                new Date().toISOString()

        });


        saveDatabase(database);


        res.json({

            success: true,

            message:
                "تم رفض الحجز ❌",

            appointment

        });

    }
);


// ==================================================
// START APPOINTMENT
// ==================================================

app.post(
    "/api/appointments/:bookingNumber/start",
    (req, res) => {

        const database = readDatabase();


        const bookingNumber =
            String(
                req.params.bookingNumber
            ).toUpperCase();


        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    bookingNumber
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الحجز غير موجود"

            });

        }


        appointment.status =
            "in_progress";


        saveDatabase(database);


        res.json({

            success: true,

            message:
                "بدأت معاينة المريض 🩺",

            appointment

        });

    }
);


// ==================================================
// COMPLETE APPOINTMENT
// ==================================================

app.post(
    "/api/appointments/:bookingNumber/complete",
    (req, res) => {

        const database = readDatabase();


        const bookingNumber =
            String(
                req.params.bookingNumber
            ).toUpperCase();


        const appointment =
            database.appointments.find(
                a =>
                    String(
                        a.bookingNumber
                    ).toUpperCase() ===
                    bookingNumber
            );


        if (!appointment) {

            return res.status(404).json({

                success: false,

                message:
                    "الحجز غير موجود"

            });

        }


        appointment.status =
            "completed";


        database.notifications.push({

            id: Date.now(),

            type:
                "appointment_completed",

            bookingNumber:
                appointment.bookingNumber,

            patientPhone:
                appointment.patientPhone,

            message:
                "تم إنهاء الموعد بنجاح ✅",

            read: false,

            createdAt:
                new Date().toISOString()

        });


        saveDatabase(database);


        res.json({

            success: true,

            message:
                "تم إنهاء الموعد بنجاح ✅",

            appointment

        });

    }
);


// ==================================================
// NOTIFICATIONS
// ==================================================

app.get(
    "/api/notifications",
    (req, res) => {

        const database = readDatabase();


        res.json({

            success: true,

            count:
                database.notifications.length,

            notifications:
                database.notifications

        });

    }
);


// ==================================================
// HEALTH CHECK
// ==================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            server: "TABIBK",

            status: "online",

            time:
                new Date().toISOString()

        });

    }
);


// ==================================================
// 404
// ==================================================
// =====================================================
// TABIBK ADMIN API
// =====================================================

// عرض جميع المواعيد للإدارة
app.get("/api/appointments", (req, res) => {

    try {

        const database = readDatabase();

        const appointments =
            database.appointments || [];

        const doctors =
            database.doctors || [];

        const result =
            appointments.map(appointment => {

                const doctor =
                    doctors.find(
                        d =>
                            Number(d.id) ===
                            Number(appointment.doctorId)
                    );

                return {

                    ...appointment,

                    doctorName:
                        doctor
                            ? doctor.name
                            : "طبيب غير معروف",

                    doctorSpecialty:
                        doctor
                            ? doctor.specialty
                            : ""

                };

            });


        res.json({

            success: true,

            count: result.length,

            appointments: result

        });

    }

    catch (error) {

        console.error(
            "ADMIN APPOINTMENTS ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "حدث خطأ أثناء تحميل المواعيد"

        });

    }

});


// =====================================================
// إحصائيات الإدارة
// =====================================================

app.get("/api/admin/stats", (req, res) => {

    try {

        const database = readDatabase();

        const appointments =
            database.appointments || [];

        const doctors =
            database.doctors || [];


        const stats = {

            totalAppointments:
                appointments.length,

            pending:
                appointments.filter(
                    a =>
                        a.status === "pending"
                ).length,

            confirmed:
                appointments.filter(
                    a =>
                        a.status === "confirmed"
                ).length,

            inProgress:
                appointments.filter(
                    a =>
                        a.status === "in_progress"
                ).length,

            completed:
                appointments.filter(
                    a =>
                        a.status === "completed"
                ).length,

            rejected:
                appointments.filter(
                    a =>
                        a.status === "rejected"
                ).length,

            totalDoctors:
                doctors.length,

            activeDoctors:
                doctors.filter(
                    d =>
                        d.status === "active"
                ).length

        };


        res.json({

            success: true,

            stats

        });

    }

    catch (error) {

        console.error(
            "ADMIN STATS ERROR:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "حدث خطأ أثناء تحميل الإحصائيات"

        });

    }

});

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


// ==================================================
// START SERVER
// ==================================================

app.listen(
    PORT,
    () => {

        console.log(
            `TABIBK Server running on port ${PORT}`
        );

    }
);
