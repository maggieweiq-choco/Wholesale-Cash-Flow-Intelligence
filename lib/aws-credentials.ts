// Vercel's serverless runtime pre-populates AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
// AWS_SESSION_TOKEN / AWS_REGION with its own internal Lambda execution role —
// even when you never set them yourself (see
// https://vercel.com/docs/environment-variables/reserved-environment-variables).
// The AWS SDK's default credential chain then mixes your access key with
// Vercel's mismatched session token and fails with
// "Could not load credentials from any providers".
//
// To sidestep that entirely, our own keys live under APP_AWS_* names and get
// passed to each client explicitly. Locally those vars are unset, so we omit
// `credentials` and let the SDK fall back to `~/.aws/credentials` as usual.
export const awsRegion = process.env.APP_AWS_REGION ?? process.env.AWS_REGION;

export const awsCredentials =
  process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;
