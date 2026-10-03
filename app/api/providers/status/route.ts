import { MockProvider } from "@/src/providers/mock";

export async function GET() {
  const providers = [new MockProvider()];
  const results = await Promise.all(providers.map(async provider => ({
    provider: provider.name,
    ...(await provider.health()),
  })));
  return Response.json({ providers: results, generatedAt: new Date().toISOString() });
}
