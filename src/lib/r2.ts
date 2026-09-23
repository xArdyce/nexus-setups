import { S3Client } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

function requiredEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(
            `${name} is not configured.`
        );
    }

    return value;
}

export function getR2BucketName() {
    return requiredEnv("R2_BUCKET_NAME");
}

export function getR2Client() {
    if (cachedClient) {
        return cachedClient;
    }

    const accountId = requiredEnv(
        "R2_ACCOUNT_ID"
    );

    cachedClient = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: requiredEnv(
                "R2_ACCESS_KEY_ID"
            ),
            secretAccessKey: requiredEnv(
                "R2_SECRET_ACCESS_KEY"
            ),
        },
    });

    return cachedClient;
}

export function sanitizeR2FileName(
    fileName: string
) {
    const sanitized = fileName
        .normalize("NFKD")
        .replace(/[^\w.\- ]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 180);

    return sanitized || "file";
}
