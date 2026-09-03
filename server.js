const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const DATABASE_FILE = path.join(__dirname, "database.json");

app.use(express.json());


// ================= DATABASE =================

function readDatabase() {

    try {

        const data = fs.readFileSync(
            DATABASE_FILE,
            "utf8"
        );

        return JSON.parse(data);

    } catch (error) {

        return {
            wilayas: [],
            doctors: [],
            appointments: [],
            notifications: []
        };

    }

}


function saveDatabase(database) {

    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(database, null, 2),
        "utf8"
    );

}


// ================= HOME =================

app.get("/", (req, res) => {

    res.json({

        success: true,

        app: "TABIBK",

        message: "سيرفر طبيبك يعمل بنجاح 🩺",

        version: "1.0.0"

    });

});


// ================= WILAYAS =================

app.get("/api/wilayas", (req, res) => {

    const database = readDatabase();

    res.json({

        success: true,

        wilayas: database.wilayas

    });

});


// ================= DOCTORS =================

app.get("/api/doctors", (req, res) => {

    const database = readDatabase();

    let doctors = database.doctors;

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


// ================= SINGLE DOCTOR =================

app.get("/api/doctors/:id", (req, res) => {

    const database = readDatabase();

    const doctor = database.doctors.find(
        d => d.id === Number(req.params.id)
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

});


// ================= CREATE APPOINTMENT =================

app.post("/api/appointments", (req, res) => {

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

            message: "يرجى إدخال جميع المعلومات المطلوبة"

        });

    }


    // البحث عن الطبيب

    const doctor = database.doctors.find(
        d => d.id === Number(doctorId)
    );


    if (!doctor) {

        return res.status(404).json({

            success: false,

            message: "الطبيب غير موجود"

        });

    }


    // إنشاء رقم حجز

    const appointmentNumber =
        database.appointments.length + 1;


    const bookingNumber =
        `TBK-${new Date().getFullYear()}-${String(appointmentNumber).padStart(4, "0")}`;


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

        queueNumber:
            database.appointments.filter(
                appointment =>
                    appointment.doctorId === doctor.id &&
                    appointment.status !== "rejected"
            ).length + 1,

        createdAt:
            new Date().toISOString()

    };


    database.appointments.push(
        appointment
    );


    saveDatabase(database);


    // إشعار

    database.notifications.push({

        id: Date.now(),

        type: "new_appointment",

        bookingNumber,

        message:
            `طلب حجز جديد عند ${doctor.name}`,

        createdAt:
            new Date().
