// automations/api/controller.js
import { runPinCheckerAutomation, getPinCheckerProgress, stopPinCheckerAutomation } from '../pin-checker/index.js';
// Import other automations when implemented
// import { runPasswordCheckerAutomation } from '../password-checker/index.js';
// import { runManufacturerDetailsAutomation } from '../manufacturer-details/index.js';

export async function handleAutomationRequest(req, res) {
    const { automation, action, runOption, selectedIds } = req.body;

    console.log(`Handling automation request: ${automation} - ${action}`);

    if (!automation) {
        return res.status(400).json({ error: "Missing 'automation' parameter" });
    }

    try {
        switch (automation) {
            case "pin-checker":
                return await handlePinCheckerRequest(req, res);
            case "password-checker":
                return res.status(501).json({ error: "Password checker automation not implemented yet" });
            case "manufacturer-details":
                return res.status(501).json({ error: "Manufacturer details automation not implemented yet" });
            default:
                return res.status(400).json({ error: `Invalid automation type: ${automation}` });
        }
    } catch (error) {
        console.error(`Error handling ${automation} automation:`, error);
        return res.status(500).json({ error: `Server error processing ${automation} automation`, message: error.message });
    }
}

async function handlePinCheckerRequest(req, res) {
    const { action, runOption, selectedIds } = req.body;

    try {
        if (action === "getProgress") {
            const progress = await getPinCheckerProgress();
            return res.status(200).json(progress);
        }

        if (action === "start") {
            // Validate required parameters
            if (!runOption) {
                return res.status(400).json({ error: "runOption parameter is required" });
            }

            // Validate selectedIds for 'selected' mode
            if (runOption === 'selected' && (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0)) {
                return res.status(400).json({
                    error: "selectedIds must be a non-empty array when runOption is 'selected'"
                });
            }

            console.log(`Starting PIN Checker automation with runOption: ${runOption}, selectedIds count: ${selectedIds?.length || 0}`);

            // Start the automation asynchronously 
            runPinCheckerAutomation(runOption, selectedIds).catch(error => {
                console.error("Error in PIN Checker automation:", error);
            });

            return res.status(200).json({
                message: "PIN Checker automation started",
                timestamp: new Date().toISOString()
            });
        }

        if (action === "stop") {
            await stopPinCheckerAutomation();
            return res.status(200).json({
                message: "PIN Checker automation stop requested",
                timestamp: new Date().toISOString()
            });
        }

        return res.status(400).json({ error: `Invalid action: ${action}` });
    } catch (error) {
        console.error(`Error in handlePinCheckerRequest (${action}):`, error);
        return res.status(500).json({
            error: `Server error processing PIN Checker ${action} request`,
            message: error.message
        });
    }
}