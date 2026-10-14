import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the isolated test seed");

const pool = new Pool({ connectionString });

async function main() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tabibk_data (
            id INTEGER PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const data = {
        wilayas: [],
        doctors: [{
            id: 9001,
            name: "CI Legacy Doctor",
            specialty: "General Medicine",
            wilaya: "Relizane",
            municipality: "Oued Rhiou",
            phone: "0555000000",
            whatsapp: "0555000000",
            duration: 15,
            active: true,
            status: "approved",
            online: false,
            password: "LegacyPass123",
            workingHours: { enabled: true, days: [0, 1, 2, 3, 4], open: "08:00", close: "17:00" },
            vacation: { enabled: false, startDate: "", endDate: "" }
        }],
        appointments: [],
        notifications: [],
        patientAd: { enabled: false, imageData: "", targetUrl: "", title: "", updatedAt: "" },
        patientAds: []
    };

    await pool.query(
        `INSERT INTO tabibk_data (id, data, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [JSON.stringify(data)]
    );

    console.log("Seeded one legacy plaintext-password doctor in the isolated test database.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(async () => {
    await pool.end();
});
