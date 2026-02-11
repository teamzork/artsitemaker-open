#!/usr/bin/env node
/**
 * R2 Image Migration Script
 * 
 * Copies all images from artsitemaker/ folder to kazyamazya/ folder in R2
 * 
 * Usage: 
 *   node scripts/r2-migrate-images.mjs
 * 
 * Prerequisites:
 *   - AWS SDK: npm install @aws-sdk/client-s3
 *   - R2 credentials in environment or content/.env
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from content/.env
config({ path: path.join(__dirname, '../content/.env') });

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('❌ Missing R2 credentials. Check content/.env');
    process.exit(1);
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
        accessKeyId,
        secretAccessKey
    }
});

const SOURCE_PREFIX = 'artsitemaker/';
const TARGET_PREFIX = 'kazyamazya/';

async function listObjects(prefix, continuationToken = null) {
    const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken
    });
    return s3.send(command);
}

async function copyObject(sourceKey, targetKey) {
    const command = new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${sourceKey}`,
        Key: targetKey
    });
    return s3.send(command);
}

async function migrate() {
    console.log('🔄 R2 Image Migration');
    console.log(`   Bucket: ${bucketName}`);
    console.log(`   From:   ${SOURCE_PREFIX}`);
    console.log(`   To:     ${TARGET_PREFIX}`);
    console.log('');

    let continuationToken = null;
    let totalCopied = 0;
    let totalSkipped = 0;

    do {
        const response = await listObjects(SOURCE_PREFIX, continuationToken);
        const objects = response.Contents || [];

        for (const obj of objects) {
            const sourceKey = obj.Key;
            const targetKey = sourceKey.replace(SOURCE_PREFIX, TARGET_PREFIX);

            try {
                await copyObject(sourceKey, targetKey);
                console.log(`   ✓ ${sourceKey} → ${targetKey}`);
                totalCopied++;
            } catch (err) {
                console.log(`   ✗ Failed: ${sourceKey} - ${err.message}`);
                totalSkipped++;
            }
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken);

    console.log('');
    console.log(`✅ Migration complete: ${totalCopied} copied, ${totalSkipped} skipped`);
    console.log('');
    console.log('⚠️  Note: This script COPIES objects, it does not delete the source.');
    console.log('   After verifying, you can manually delete the artsitemaker/ folder in R2.');
}

migrate().catch(console.error);
