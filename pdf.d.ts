// types/pdf.d.ts
declare module 'pdfjs-dist/build/pdf.worker.entry'
declare global {
    interface Window {
        pdfjsWorker: any
    }
}