import React from 'react';
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';
import '@cyntler/react-doc-viewer/dist/index.css';
import { file } from 'jszip';

function ExcelViewer() {
    // Define the documents to be displayed
    const docs = [
        // Remote Excel file
        {
            uri: "https://mawingupayroll.winguapps.co.ke//GeneratedReports/NHIF_ByProduct_File_4047_AGROLT SOLUTIONS PRIVATE LIMITED_November_2024.xlsx",
            fileType: "xlsx",
            fileName: "NHIF_ByProduct_File_4047_AGROLT SOLUTIONS PRIVATE LIMITED_November_2024.xlsx",
        },
        // Example local file, update path as necessary
        // { uri: require("./example-files/pdf.pdf") },
    ];

    return (
        <div style={{ width: "100%", height: "100vh" }}>
            {/* DocViewer component to display documents */}
            <DocViewer documents={docs} pluginRenderers={DocViewerRenderers}
            style={{ width: "100%", height: "100vh" }}
            />
        </div>
    );
}

export default ExcelViewer;
