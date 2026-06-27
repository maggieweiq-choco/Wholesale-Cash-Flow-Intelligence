import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsCredentials, awsRegion } from "@/lib/aws-credentials";

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION ?? awsRegion,
  credentials: awsCredentials,
});

export async function embedText(text: string): Promise<number[]> {
  const response = await client.send(
    new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v2:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text }),
    })
  );

  const payload = JSON.parse(new TextDecoder().decode(response.body));
  return payload.embedding;
}
