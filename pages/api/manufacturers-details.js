// @ts-nocheck
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import retry from 'async-retry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function readSupabaseData(runOption, selectedIds) {
    try {
        let query = supabase.from("acc_portal_company_duplicate").select("*");

        if (runOption === 'selected' && selectedIds.length > 0) {
            query = query.in('id', selectedIds);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error reading data from 'ManufacturersDetails' table: ${error.message}`);
        }
        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}

async function upsertManufacturerDetails(data) {
    try {
        console.log("Upserting data into ManufacturersDetails table:", data);
        const { data: existingData, error: fetchError } = await supabase
            .from("ManufacturersDetails")
            .select("*")
            .eq("company_name", data.company_name)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error(`Error fetching existing data: ${fetchError.message}`);
            throw new Error(`Error fetching existing data: ${fetchError.message}`);
        }

        if (existingData) {
            console.log("Data exists for:", data.company_name, "- Updating record.");
            const { error: updateError } = await supabase
                .from("ManufacturersDetails")
                .update(data)
                .eq("company_name", data.company_name);

            if (updateError) {
                console.error(`Error updating data in ManufacturersDetails: ${updateError.message}`);
                throw new Error(`Error updating data in ManufacturersDetails: ${updateError.message}`);
            }
            console.log("Data updated successfully:", data);
            return true;
        } else {
            console.log("Inserting new data into ManufacturersDetails:", data);
            const { error: insertError } = await supabase
                .from("ManufacturersDetails")
                .insert(data);

            if (insertError) {
                console.error(`Error inserting data into ManufacturersDetails: ${insertError.message}`);
                throw new Error(`Error inserting data into ManufacturersDetails: ${insertError.message}`);
            }
            console.log("Data inserted successfully:", data);
            return true;
        }
    } catch (error) {
        console.error("Error upserting into Supabase:", error);
        throw error;
    }
}

async function updateSupabaseStatus(id, updateData) {
    try {
        const { error } = await supabase
            .from("ManufacturersDetails")
            .update({ ...updateData, last_checked_at: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            throw new Error(`Error updating status in Supabase: ${error.message}`);
        }
        console.log("Status updated successfully for id:", id);
    } catch (error) {
        console.error("Error updating Supabase:", error);
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { runOption, selectedIds } = req.body;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("AAA-MANUFACTURER DETAILS REPORT");
    worksheet.columns = [
        { header: "Company", key: "company_name" },
        { header: "KRA PIN", key: "kra_pin" },
        { header: "Manufacturer Name", key: "manufacturer_name" },
        { header: "Mobile number", key: "mobile_number" },
        { header: "Main Email Address", key: "main_email_address" },
        { header: "Business Reg Cert No", key: "business_reg_cert_no" },
        { header: "Business Reg Date", key: "business_reg_date" },
        { header: "Business Commencement Date", key: "business_commencement_date" },
        { header: "Postal Code", key: "postal_code" },
        { header: "P.O.Box", key: "po_box" },
        { header: "Town", key: "town" },
        { header: "Descriptive Address", key: "desc_addr" },
        { header: "Last Checked At", key: "last_checked_at" }
    ];

    let browser;
    let context;
    let page;

    try {
        const data = await readSupabaseData(runOption, selectedIds);
        browser = await chromium.launch({
            headless: true,
            channel: "msedge",
            // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        });
        context = await browser.newContext();
        page = await context.newPage();

        for (const [index, manufacturerData] of data.entries()) {
            console.log(`Processing ${index + 1} of ${data.length}`);

            try {
                console.log(`Checking details for ${manufacturerData.company_name}.`);

                if (!manufacturerData.kra_pin) {
                    console.log(`KRA PIN missing for ${manufacturerData.company_name}. Updating Excel with PIN MISSING.`);
                    manufacturerData.kra_pin = "PIN MISSING";
                } else {
                    await page.goto("https://itax.kra.go.ke/KRA-Portal/");

                    await page.locator("#logid").click();
                    await page.evaluate(() => manufacturerAuthorization());
                    await page.locator("#mfrPinResi").fill(manufacturerData.kra_pin);
                    await page.click("#nextBtn");
                    await page.waitForTimeout(1000);
                    await page.click("#nextBtn");

                    // Check if the page has an error text
                    const errorText = await page.innerText('.tablerowhead');
                    if (errorText.includes('An Error has occurred')) {
                        throw new Error('An error has occurred');
                    }

                    const scrapedData = {
                        manufacturer_name: await page.inputValue("#taxpayerNameResi") || "MISSING",
                        mobile_number: await page.inputValue("#mobileNumber") || "MISSING",
                        main_email_address: await page.inputValue("#mainEmailId") || "MISSING",
                        business_reg_cert_no: await page.inputValue("#businessRegCertiNo") || "MISSING",
                        business_reg_date: await page.inputValue("#busiRegDt") || "MISSING",
                        business_commencement_date: await page.inputValue("#busiCommencedDt") || "MISSING",
                        desc_addr: await page.inputValue("#DescAddr") || "MISSING",
                        postal_code: await page.inputValue('input[name="manAuthDTO.manAddRDtlDTO.postalCode"]') || "MISSING",
                        po_box: await page.inputValue('input[name="manAuthDTO.manAddRDtlDTO.poBox"]') || "MISSING",
                        town: await page.inputValue('input[name="manAuthDTO.manAddRDtlDTO.town"]') || "MISSING"
                    };

                    // Log the data that is about to be inserted or updated
                    console.log("Scraped Data for Manufacturer:", manufacturerData.company_name, scrapedData);

                    await updateSupabaseStatus(manufacturerData.id, scrapedData);
                    const inserted = await upsertManufacturerDetails({
                        ...scrapedData,
                        kra_pin: manufacturerData.kra_pin,
                        company_name: manufacturerData.company_name
                    });

                    if (inserted) {
                        worksheet.addRow({
                            company_name: manufacturerData.company_name,
                            kra_pin: manufacturerData.kra_pin,
                            ...scrapedData,
                            last_checked_at: new Date().toISOString()
                        });
                    }
                }

            } catch (error) {
                console.error(`Error processing data for ${manufacturerData.company_name}:`, error);
                worksheet.addRow({
                    company_name: manufacturerData.company_name,
                    kra_pin: manufacturerData.kra_pin,
                    manufacturer_name: "ERROR",
                    mobile_number: "ERROR",
                    main_email_address: "ERROR",
                    last_checked_at: new Date().toISOString()
                });
                await updateSupabaseStatus(manufacturerData.id, { error: error.message });
            }
        }

        const currentDate = new Date();
        const formattedDate = `${currentDate.getDate().toString().padStart(2, '0')}.${(currentDate.getMonth() + 1).toString().padStart(2, '0')}.${currentDate.getFullYear()}`;
        const excelDir = path.join(os.homedir(), "Downloads", `AUTO EXTRACT MANUFACTURER DETAILS KRA ${formattedDate}`);
        await fs.mkdir(excelDir, { recursive: true });

        const excelFilePath = path.join(excelDir, `MANUFACTURER_DETAILS COMPANIES ${formattedDate}.xlsx`);
        await workbook.xlsx.writeFile(excelFilePath);

        console.log(`Download report for all manufacturers generated successfully.`);
        res.status(200).json({ message: "Manufacturers details check completed successfully." });
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).json({ message: "An error occurred during the manufacturers details check." });
    } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
    }
}
