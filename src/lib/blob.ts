import { put } from "@vercel/blob";

export async function uploadPdfToBlob(fileName: string, data: Buffer): Promise<string | null> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

    const blob = await put(fileName, data, {
        access: "public",
        contentType: "application/pdf",
        token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return blob.url;
}
