import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root .env.local
const envPath = path.resolve(__dirname, "../../../.env.local");
console.log(`Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const endpoint = process.env.R2_ENDPOINT; // Usually https://<accountid>.r2.cloudflarestorage.com

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 environment variables.");
  console.log("R2_ACCOUNT_ID:", accountId ? "Set" : "Missing");
  console.log("R2_ACCESS_KEY_ID:", accessKeyId ? "Set" : "Missing");
  console.log("R2_SECRET_ACCESS_KEY:", secretAccessKey ? "Set" : "Missing");
  console.log("R2_BUCKET:", bucket ? "Set" : "Missing");
  process.exit(1);
}

// Ensure endpoint is set or construct it
const r2Endpoint = endpoint || `https://${accountId}.r2.cloudflarestorage.com`;

console.log(`Connecting to R2 Bucket: ${bucket} at ${r2Endpoint}`);

const S3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

async function main() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 5,
    });
    
    console.log("Sending ListObjectsV2 command...");
    const data = await S3.send(command);
    
    console.log("Success! Connection established.");
    console.log("Objects found:");
    if (data.Contents) {
      data.Contents.forEach((obj) => {
        console.log(` - ${obj.Key} (${obj.Size} bytes)`);
      });
    } else {
      console.log(" - No objects found in bucket (empty).");
    }
  } catch (err) {
    console.error("Error connecting to R2:");
    console.error(err);
  }
}

main();
