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
// Trim defensively: a stray trailing newline or surrounding quotes from
// copy-pasting into Vercel's env var UI produces an access key/secret with
// an invalid character, which breaks SigV4 header construction with
// "TypeError: Invalid character in header content [\"authorization\"]".
function clean(value: string | undefined): string | undefined {
  return value?.trim().replace(/^["']|["']$/g, "");
}

// Logs shape/format info only (never the actual secret) so we can diagnose
// "Invalid character in header content" from Vercel runtime logs without
// printing credentials anywhere.
function checkFormat(name: string, value: string | undefined, expected: RegExp) {
  if (!value) return;
  const invalidChars = [...value]
    .filter((ch) => ch.charCodeAt(0) < 0x21 || ch.charCodeAt(0) > 0x7e)
    .map((ch) => `0x${ch.charCodeAt(0).toString(16)}`);
  if (invalidChars.length > 0) {
    console.warn(
      `[aws-credentials] ${name} contains non-printable/control characters: [${invalidChars.join(", ")}] (length ${value.length})`,
    );
  } else if (!expected.test(value)) {
    console.warn(
      `[aws-credentials] ${name} has length ${value.length} and doesn't match the expected AWS format — double check it was pasted correctly.`,
    );
  }
}

export const awsRegion = clean(process.env.APP_AWS_REGION) ?? clean(process.env.AWS_REGION);

const accessKeyId = clean(process.env.APP_AWS_ACCESS_KEY_ID);
const secretAccessKey = clean(process.env.APP_AWS_SECRET_ACCESS_KEY);

checkFormat("APP_AWS_ACCESS_KEY_ID", accessKeyId, /^[A-Z0-9]{16,32}$/);
checkFormat("APP_AWS_SECRET_ACCESS_KEY", secretAccessKey, /^[A-Za-z0-9/+=]{30,60}$/);

export const awsCredentials =
  accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
