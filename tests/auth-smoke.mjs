import pg from "pg";

const { Pool } = pg;
const BASE_URL = process.env.TABIBK_TEST_URL || "http://127.0.0.1:10000";
const ADMIN_KEY = process.env.ADMIN_KEY || "tabibk-ci-test-admin-key";
const PASSWORD = "StrongPass!2026";
const RESET_PASSWORD = "ResetPass!2026";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, key, token } = {}) {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (key) headers["x-admin-key"] = key;
    if (token) headers.authorization = `Bearer ${token}`;

    const response = await fetch(BASE_URL + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    let data = {};
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
}

async function waitForServer() {
    let lastError;
    for (let i = 0; i < 60; i++) {
        try {
            const result = await request("/api/health");
            if (result.status === 200 && result.data.status === "online") return;
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error("Server did not become healthy in time: " + (lastError?.message || "database not ready"));
}

async function main() {
    await waitForServer();

    let result = await request("/api/doctor/login", {
        method: "POST",
        body: { phone: "0555000000", password: "LegacyPass123" }
    });
    assert(result.status === 200 && result.data.success === true, "Legacy plaintext-password doctor should still be able to log in");

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    let migrated = false;
    for (let attempt = 0; attempt < 20; attempt++) {
        const dbResult = await pool.query("SELECT data FROM tabibk_data WHERE id = 1");
        const legacyDoctor = dbResult.rows[0]?.data?.doctors?.find(doctor => Number(doctor.id) === 9001);
        if (legacyDoctor && !legacyDoctor.password &&
            typeof legacyDoctor.loginPassword === "string" &&
            legacyDoctor.loginPassword.startsWith("scrypt$")) {
            migrated = true;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    await pool.end();
    assert(migrated, "Successful legacy login should upgrade plaintext password to a scrypt hash and remove the old field");

    result = await request("/api/admin/login", { method: "POST", body: { key: "wrong-key" } });
    assert(result.status === 401, "Wrong admin key should return 401");

    result = await request("/api/admin/login", { method: "POST", body: { key: ADMIN_KEY } });
    assert(result.status === 200 && result.data.success === true, "Correct admin key should log in");
    assert(result.data.token === ADMIN_KEY, "Admin login should return configured admin token");

    result = await request("/api/admin/doctors");
    assert(result.status === 401, "Admin doctors endpoint should reject missing admin key");

    result = await request("/api/admin/doctors", { key: ADMIN_KEY });
    assert(result.status === 200 && Array.isArray(result.data.doctors), "Admin doctors endpoint should accept valid admin key");

    result = await request("/api/doctor/register", {
        method: "POST",
        body: {
            name: "CI Test Doctor",
            gender: "male",
            specialty: "General Medicine",
            wilaya: "Relizane",
            municipality: "Oued Rhiou",
            phone: "0555000001",
            whatsapp: "0555000001",
            password: "weak"
        }
    });
    assert(result.status === 400, "Registration should reject passwords shorter than 8 characters");

    result = await request("/api/doctor/register", {
        method: "POST",
        body: {
            name: "CI Test Doctor",
            gender: "male",
            specialty: "General Medicine",
            wilaya: "Relizane",
            municipality: "Oued Rhiou",
            phone: "0555000001",
            whatsapp: "0555000001",
            password: PASSWORD
        }
    });
    assert(result.status === 201 && result.data.status === "pending", "Doctor registration should create a pending account");
    const doctorId = result.data.doctor.id;
    assert(!("password" in result.data.doctor) && !("loginPassword" in result.data.doctor), "Doctor response must not expose password fields");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000001", password: PASSWORD } });
    assert(result.status === 403, "Pending doctor should not be allowed to log in");

    result = await request(`/api/admin/doctors/${doctorId}/approve`, { method: "POST", key: ADMIN_KEY, body: {} });
    assert(result.status === 200 && result.data.doctor.status === "approved" && result.data.doctor.active === true, "Admin should approve doctor");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000001", password: "incorrect" } });
    assert(result.status === 401, "Incorrect doctor password should be rejected");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000001", password: PASSWORD } });
    assert(result.status === 200 && result.data.success === true && result.data.token, "Approved doctor should log in with correct password");

    result = await request(`/api/admin/doctors/${doctorId}`, {
        method: "PUT",
        key: ADMIN_KEY,
        body: { status: "inactive", active: false }
    });
    assert(result.status === 200 && result.data.doctor.active === false, "Admin should deactivate doctor");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000001", password: PASSWORD } });
    assert(result.status === 403, "Inactive doctor should not log in");

    result = await request(`/api/admin/doctors/${doctorId}`, {
        method: "PUT",
        key: ADMIN_KEY,
        body: { status: "active", active: true }
    });
    assert(result.status === 200 && result.data.doctor.active === true, "Admin should reactivate doctor");

    result = await request(`/api/admin/doctors/${doctorId}`, {
        method: "PUT",
        key: ADMIN_KEY,
        body: { password: RESET_PASSWORD }
    });
    assert(result.status === 200, "Admin should reset doctor password");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000001", password: PASSWORD } });
    assert(result.status === 401, "Old password should stop working after reset");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000001", password: RESET_PASSWORD } });
    assert(result.status === 200 && result.data.success === true, "New password should work after reset");

    result = await request("/api/doctor/register", {
        method: "POST",
        body: {
            name: "CI Rejected Doctor",
            specialty: "General Medicine",
            wilaya: "Relizane",
            municipality: "Oued Rhiou",
            phone: "0555000002",
            password: PASSWORD
        }
    });
    assert(result.status === 201, "Second test doctor should register");
    const rejectedDoctorId = result.data.doctor.id;

    result = await request(`/api/admin/doctors/${rejectedDoctorId}/reject`, { method: "POST", key: ADMIN_KEY, body: {} });
    assert(result.status === 200 && result.data.doctor.status === "rejected", "Admin should reject doctor");

    result = await request("/api/doctor/login", { method: "POST", body: { phone: "0555000002", password: PASSWORD } });
    assert(result.status === 403, "Rejected doctor should not log in");

    result = await request("/api/admin/doctors", {
        method: "POST",
        key: ADMIN_KEY,
        body: {
            name: "CI Admin Created Doctor",
            specialty: "General Medicine",
            wilaya: "Relizane",
            municipality: "Oued Rhiou",
            phone: "0555000003",
            password: PASSWORD
        }
    });
    assert(result.status === 201 && result.data.success === true, "Admin should be able to create a doctor without async-handler errors");
    assert(!("password" in result.data.doctor) && !("loginPassword" in result.data.doctor), "Admin-created doctor response must not expose password fields");

    console.log("PASS: admin key, registration, password hashing/login, approval/rejection, deactivation/reactivation, password reset, and admin doctor creation");
}

main().catch(error => {
    console.error("TABIBK auth smoke test failed:", error);
    process.exitCode = 1;
});
