# Setup — connect AWS and load data

## 0. Prerequisites
- Node 18+ and the repo installed: `npm install`
- AWS CLI configured (`aws configure`) with the same account you'll use
- An Anthropic API key

## 1. Provision AWS (one time)

### DynamoDB (raw store)
Create a table:
- Name: `cashflow-raw`
- Partition key: `companyId` (String)
- Sort key: `rowId` (String)
- Capacity: On-demand

### Aurora PostgreSQL Serverless v2 (structured store)
- Create an Aurora PostgreSQL Serverless v2 cluster.
- **Enable the Data API** (RDS → cluster → Modify → "RDS Data API"). The code talks to Aurora through the Data API, so this is required.
- Database name: `cashflow`.
- In Secrets Manager, create/confirm a secret holding the cluster's username + password. Copy its ARN.
- Copy the **cluster ARN** and **secret ARN**.

### Bedrock (embeddings — optional but on-brand)
- In the Bedrock console, request access to `amazon.titan-embed-text-v2:0` in your region.

## 2. Configure env
Copy `.env.example` to `.env.local` and fill in:
- `ANTHROPIC_API_KEY`
- `AWS_REGION`
- `DYNAMO_TABLE_NAME=cashflow-raw`
- `AURORA_DATABASE=cashflow`, `AURORA_CLUSTER_ARN`, `AURORA_SECRET_ARN`
- `BEDROCK_REGION`
- `CRON_SECRET` (any long random string)

## 3. Create the Aurora tables
```bash
npm run db:push      # drizzle-kit push, applies db/schema.ts
```

## 4. Run the app
```bash
npm run dev
```

## 5. Load the sample data (end to end)
With the app running, in another terminal:
```bash
./seed.sh
```
This uploads the CSVs in `seed/` to DynamoDB, normalizes them into Aurora,
then runs the 90-day forecast through Claude. Open http://localhost:3000 and
use company id `acme` on the pages.

To load against the deployed app instead:
```bash
BASE_URL=https://your-app.vercel.app COMPANY=acme ./seed.sh
```

## Pipeline recap
```
/api/upload   CSV  -> DynamoDB (raw)
/api/normalize     DynamoDB -> Aurora (clean tables + derived customers)
/api/forecast      Aurora -> Claude (90-day forecast) -> Aurora
/api/inventory     Aurora -> Claude (dead stock ranking)
/api/receivables   Aurora -> Claude (collections priority)
/api/financing     Aurora + worst gap -> Claude (financing options)
/api/cron          daily refresh of every company's forecast
```

## Note on AWS credentials in production
On Vercel, set the same env vars in the project settings. For AWS auth in a
serverless deploy, the simplest path is an IAM user's access keys
(`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) scoped to DynamoDB, RDS Data
API, and Bedrock. Take the "AWS Console showing your resource" screenshot the
hackathon requires while you're in there.
