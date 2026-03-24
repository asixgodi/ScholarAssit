import fs from "fs/promises";
import path from "path";

export async function uploadPdfToBlob(fileName: string, data: Buffer): Promise<string | null> {
    try {
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadDir, { recursive: true });

        const baseName = path.basename(fileName);
        const normalizedName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const safeName = `${Date.now()}-${normalizedName}`;
        const filePath = path.join(uploadDir, safeName);

        await fs.writeFile(filePath, data);

        return `/uploads/${safeName}`;
    } catch (error) {
        console.error("Local PDF upload failed", error);
        return null;
    }
}
