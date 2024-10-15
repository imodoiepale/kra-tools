import { chromium } from "playwright";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Constants for directories, Supabase URL, and API keys
const now = new Date();
const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;


const supabaseUrl = "https://zyszsqgdlrpnunkegipk.supabase.co";
const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c3pzcWdkbHJwbnVua2VnaXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODMyNzg5NCwiZXhwIjoyMDIzOTAzODk0fQ.7ICIGCpKqPMxaSLiSZ5MNMWRPqrTr5pHprM0lBaNing";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Modify the loginToNSSF function
async function loginToNSSF(page, company) {
    await page.goto("https://eservice.nssfkenya.co.ke/eSF24/faces/login.xhtml");
    await page.getByLabel('Username:').fill(company.identifier);
    await page.getByLabel('Password:').fill(company.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForLoadState("networkidle");
    console.log("Login successful");
}

// Modify the readSupabaseData function to fetch NSSF credentials
const readSupabaseData = async () => {
    console.log("Reading data from Supabase...");
    try {
        const { data, error } = await supabase
            .from("nssf_companies")
            .select("*")
            .eq('name', 'AKASH DISTRIBUTORS (K) LIMITED')
            .order('id');

        if (error) {
            throw new Error(`Error reading data from 'PasswordChecker' table: ${error.message}`);
        }

        console.log("Data successfully retrieved from Supabase");
        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
};

// Main function
(async () => {
    console.log("Starting the main function...");
    const data = await readSupabaseData();

    if (data.length === 0) {
        console.log("Company not found or details don't match.");
        return;
    }

    const company = data[0];
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("COMPANY:", company.name);
    console.log("NSSF Username:", company.identifier);
    console.log("NSSF Password:", company.password);

    try {
        await loginToNSSF(page, company);


    } catch (error) {
        console.error("An error occurred:", error);
        console.log("Stopping the code due to incorrect details.");
    } finally {
        console.log("Closing browser...");
        await page.close();
        await context.close();
        await new Promise(resolve => setTimeout(resolve, 100000)); // Wait for 100 seconds
        await browser.close();
        console.log("Browser closed. Script execution completed.");
    }
})();