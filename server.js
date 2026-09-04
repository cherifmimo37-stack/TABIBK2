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
// DATABASE
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

        const database = JSON.parse(data);

        database.wilayas ||= [];
        database.doctors ||= [];
        database.appointments ||= [];
        database.notifications ||= [];

        return database;

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
// ADMIN AUTHENTICATION
// ==================================================

function checkAdminKey(req, res, next) {

    const adminKey =
        req.headers["x-admin-key"];

    const serverKey =
        process.env.ADMIN_KEY;

    if (!serverKey) {

        return res.status(500).json({

            success: false,

            message:
                "ADMIN_KEY غير مضبوط في السيرفر"

        });
    }

    if (
        !adminKey ||
        adminKey !== serverKey
    ) {

        return res.status(401).json({

            success: false,

            message:
                "غير مصرح بالدخول"

        });
    }

    next();
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

        version: "2.0.0",

        status: "online"

    });

});


// ==================================================
// WILAYAS
// ==================================================

app.get("/api/wilayas", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        count:
            database.wilayas.length,

        wilayas:
            database.wilayas

    });

});


// ==================================================
// MUNICIPALITIES
// ==================================================

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

                message:
                    "الولاية غير موجودة"

            });
        }

        res.json({

            success: true,

            wilaya:
                wilaya.name,

            municipalities:
                wilaya.municipalities || []

        });

    }
);


// ==================================================
// PUBLIC DOCTORS
// ==================================================

app.get("/api/doctors", (req, res) => {

    const database =
        readDatabase();

    let doctors =
        (database.doctors || [])
        .filter(
            doctor =>
                doctor.status !== "deleted"
        );

    const {
        wilaya,
        municipality,
        specialty
    } = req.query;


    if (wilaya) {

        doctors =
            doctors.filter(
                doctor =>
                    doctor.wilaya === wilaya
            );

    }


    if (municipality) {

        doctors =
            doctors.filter(
                doctor =>
                    doctor.municipality === municipality
            );

    }


    if (specialty) {

        doctors =
            doctors.filter(
                doctor =>
                    doctor.specialty === specialty
            );

    }


    res.json({

        success: true,

        count:
            doctors.length,

        doctors

    });

});


// ==================================================
// SINGLE DOCTOR
// ==================================================

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


        if (
            !doctor ||
            doctor.status === "deleted"
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "الطبيب غير موجود"

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

        const database =
            readDatabase();


        const {
            patientName,
            patientPhone,
            doctorId,
            reason
        } = req.body;


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


        const doctor =
            database.doctors.find(
                d =>
                    Number(d.id) ===
                    Number(doctorId) &&
                    d.status !== "deleted"
            );


        if (!doctor) {

            return res.status(404).json({

                success: false,

                message:
                    "الطبيب غير موجود"

            });
        }


        const appointmentNumber =
            database.appointments.length + 1;


        const currentYear =
            new Date().getFullYear();


        const bookingNumber =
            `TBK-${currentYear}-${String(
                appointmentNumber
            ).padStart(4, "0")}`;


        const doctorQueue =
            database.appointments.filter(
                appointment =>
                    Number(appointment.doctorId) ===
                    Number(doctor.id) &&
                    appointment.status !== "rejected"
            );


        const queueNumber =
            doctorQueue.length + 1;


        const appointment = {

            id: Date.now(),

            bookingNumber,

            patientName:
                String(patientName).trim(),

            patientPhone:
                String(patientPhone).trim(),

            doctorId:
                doctor.id,

            doctorName:
                doctor.name,

            specialty:
                doctor.specialty,

            wilaya:
                doctor.wilaya,

            municipality:
                doctor.municipality,

            reason:
                reason || "",

            status:
                "pending",

            queueNumber,

            createdAt:
                new Date().toISOString()

        };


        database.appointments.push(
            appointment
        );


        database.notifications.push({

            id:
                Date.now() + 1,

            type:
                "new_appointment",

            bookingNumber,

            doctorId:
                doctor.id,

            message:
                `طلب حجز جديد عند ${doctor.name}`,

            read:
                false,

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

        const database =
            readDatabase();


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


        const doctorAppointments =
            database.appointments.filter(
                a =>
                    Number(a.doctorId) ===
                    Number(appointment.doctorId) &&
                    a.status !== "rejected"
            );


        const completedAppointments =
            doctorAppointments.filter(
                a =>
                    a.status === "completed"
            );


        const currentTurn =
            completedAppointments.length + 1;


        const patientsBefore =
            Math.max(
                0,
                Number(appointment.queueNumber) -
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

        const database =
            readDatabase();


        const doctorId =
            Number(req.params.id);


        const doctor =
            database.doctors.find(
                d =>
                    Number(d.id) ===
                    doctorId
            );


        if (
            !doctor ||
            doctor.status === "deleted"
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "الطبيب غير موجود"

            });
        }


        const appointments =
            database.appointments.filter(
                appointment =>
                    Number(appointment.doctorId) ===
                    doctorId
            );


        res.json({

            success: true,

            doctor:
                doctor.name,

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

        const database =
            readDatabase();


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

            id:
                Date.now(),

            type:
                "appointment_accepted",

            bookingNumber:
                appointment.bookingNumber,

            patientPhone:
                appointment.patientPhone,

            message:
                "تم تأكيد موعدك من طرف الطبيب ✅",

            read:
                false,

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

        const database =
            readDatabase();


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

            id:
                Date.now(),

            type:
                "appointment_rejected",

            bookingNumber:
                appointment.bookingNumber,

            patientPhone:
                appointment.patientPhone,

            message:
                "تم رفض طلب الحجز ❌",

            read:
                false,

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

        const database =
            readDatabase();


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

        const database =
            readDatabase();


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

            id:
                Date.now(),

            type:
                "appointment_completed",

            bookingNumber:
                appointment.bookingNumber,

            patientPhone:
                appointment.patientPhone,

            message:
                "تم إنهاء الموعد بنجاح ✅",

            read:
                false,

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
// ADMIN LOGIN
// ==================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        try {

            const {
                key
            } = req.body;


            const serverKey =
                process.env.ADMIN_KEY;


            if (!serverKey) {

                return res.status(500).json({

                    success: false,

                    message:
                        "ADMIN_KEY غير مضبوط في السيرفر"

                });
            }


            if (
                !key ||
                key !== serverKey
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "كلمة السر غير صحيحة"

                });
            }


            res.json({

                success: true,

                message:
                    "تم تسجيل الدخول بنجاح"

            });

        } catch (error) {

            console.error(
                "ADMIN LOGIN ERROR:",
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


// ==================================================
// ADMIN - ALL APPOINTMENTS
// ==================================================

app.get(
    "/api/appointments",
    checkAdminKey,
    (req, res) => {

        try {

            const database =
                readDatabase();


            const appointments =
                database.appointments || [];


            const doctors =
                database.doctors || [];


            const result =
                appointments.map(
                    appointment => {

                        const doctor =
                            doctors.find(
                                d =>
                                    Number(d.id) ===
                                    Number(
                                        appointment.doctorId
                                    )
                            );


                        return {

                            ...appointment,

                            doctorName:
                                doctor
                                    ? doctor.name
                                    : appointment.doctorName ||
                                      "طبيب غير معروف",

                            doctorSpecialty:
                                doctor
                                    ? doctor.specialty
                                    : appointment.specialty ||
                                      ""

                        };

                    }
                );


            res.json({

                success: true,

                count:
                    result.length,

                appointments:
                    result

            });

        } catch (error) {

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

    }
);


// ==================================================
// ADMIN - GET DOCTORS
// ==================================================

app.get(
    "/api/admin/doctors",
    checkAdminKey,
    (req, res) => {

        try {

            const database =
                readDatabase();


            const doctors =
                (database.doctors || [])
                .filter(
                    doctor =>
                        doctor.status !== "deleted"
                );


            res.json({

                success: true,

                count:
                    doctors.length,

                doctors

            });

        } catch (error) {

            console.error(
                "ADMIN DOCTORS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء تحميل الأطباء"

            });

        }

    }
);


// ==================================================
// ADMIN - GET SINGLE DOCTOR
// ==================================================

app.get(
    "/api/admin/doctors/:id",
    checkAdminKey,
    (req, res) => {

        try {

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


            res.json({

                success: true,

                doctor

            });

        } catch (error) {

            console.error(
                "GET DOCTOR ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء تحميل بيانات الطبيب"

            });

        }

    }
);


// ==================================================
// ADMIN - ADD DOCTOR
// ==================================================

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
                consultationDuration
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
                        "يرجى ملء جميع البيانات المطلوبة"

                });
            }


            const doctors =
                database.doctors || [];


            const newId =
                doctors.length > 0
                    ? Math.max(
                        ...doctors.map(
                            d =>
                                Number(d.id) || 0
                        )
                    ) + 1
                    : 1;


            const doctor = {

                id:
                    newId,

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
                    String(
                        whatsapp || phone
                    ).trim(),

                status:
                    "active",

                consultationDuration:
                    Number(
                        consultationDuration
                    ) || 15

            };


            doctors.push(
                doctor
            );


            database.doctors =
                doctors;


            saveDatabase(
                database
            );


            res.status(201).json({

                success: true,

                message:
                    "تمت إضافة الطبيب بنجاح ✅",

                doctor

            });

        } catch (error) {

            console.error(
                "ADMIN ADD DOCTOR ERROR:",
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


// ==================================================
// ADMIN - EDIT DOCTOR
// ==================================================

app.put(
    "/api/admin/doctors/:id",
    checkAdminKey,
    (req, res) => {

        try {

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


            const {
                name,
                specialty,
                wilaya,
                municipality,
                phone,
                whatsapp,
                consultationDuration,
                status
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
                        "يرجى ملء جميع البيانات المطلوبة"

                });
            }


            doctor.name =
                String(name).trim();


            doctor.specialty =
                String(specialty).trim();


            doctor.wilaya =
                String(wilaya).trim();


            doctor.municipality =
                String(municipality).trim();


            doctor.phone =
                String(phone).trim();


            doctor.whatsapp =
                String(
                    whatsapp || phone
                ).trim();


            doctor.consultationDuration =
                Number(
                    consultationDuration
                ) || 15;


            if (status) {

                doctor.status =
                    String(status);

            } else {

                doctor.status =
                    "active";

            }


            saveDatabase(
                database
            );


            res.json({

                success: true,

                message:
                    "تم تعديل بيانات الطبيب بنجاح ✅",

                doctor

            });

        } catch (error) {

            console.error(
                "ADMIN EDIT DOCTOR ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء تعديل الطبيب"

            });

        }

    }
);


// ==================================================
// ADMIN - DELETE DOCTOR
// ==================================================
//
// لا نحذف الطبيب نهائيًا من JSON
// حتى تبقى المواعيد القديمة محفوظة
//

app.delete(
    "/api/admin/doctors/:id",
    checkAdminKey,
    (req, res) => {

        try {

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


            doctor.status =
                "deleted";


            doctor.deletedAt =
                new Date().toISOString();


            saveDatabase(
                database
            );


            res.json({

                success: true,

                message:
                    "تم حذف الطبيب بنجاح 🗑️"

            });

        } catch (error) {

            console.error(
                "ADMIN DELETE DOCTOR ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "حدث خطأ أثناء حذف الطبيب"

            });

        }

    }
);


// ==================================================
// ADMIN - STATS
// ==================================================

app.get(
    "/api/admin/stats",
    checkAdminKey,
    (req, res) => {

        try {

            const database =
                readDatabase();


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
                            a.status ===
                            "pending"
                    ).length,

                confirmed:
                    appointments.filter(
                        a =>
                            a.status ===
                            "confirmed"
                    ).length,

                inProgress:
                    appointments.filter(
                        a =>
                            a.status ===
                            "in_progress"
                    ).length,

                completed:
                    appointments.filter(
                        a =>
                            a.status ===
                            "completed"
                    ).length,

                rejected:
                    appointments.filter(
                        a =>
                            a.status ===
                            "rejected"
                    ).length,

                totalDoctors:
                    doctors.filter(
                        d =>
                            d.status !==
                            "deleted"
                    ).length,

                activeDoctors:
                    doctors.filter(
                        d =>
                            d.status ===
                            "active"
                    ).length

            };


            res.json({

                success: true,

                stats

            });

        } catch (error) {

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

    }
);


// ==================================================
// NOTIFICATIONS
// ==================================================

app.get(
    "/api/notifications",
    checkAdminKey,
    (req, res) => {

        const database =
            readDatabase();


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

            server:
                "TABIBK",

            status:
                "online",

            time:
                new Date().toISOString()

        });

    }
);


// ==================================================
// 404
// ==================================================

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
